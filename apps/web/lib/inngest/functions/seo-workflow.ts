import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';
import { SerpApiConnector } from '@/lib/connectors/seo/serpapi';
import { generateContentBrief, generateSEOBlogPost } from '@/lib/ai/seo-content-writer';

/**
 * Research keyword data from SerpApi
 */
export const keywordResearchHandler = inngest.createFunction(
  {
    id: 'seo-keyword-research',
    retries: 3,
  },
  { event: 'seo/keyword-research' },
  async ({ event, step }) => {
    const { keywordId, keyword, productId } = event.data;
    const supabase = createAdminClient();

    // Get product and org info
    const product = await step.run('load-product', async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, organizations (id, settings)')
        .eq('id', productId)
        .single();

      if (error) throw error;
      return data;
    });

    // Get SerpApi credentials
    const credentials = await step.run('get-credentials', async () => {
      const { data } = await supabase
        .from('connectors')
        .select('credentials')
        .eq('organization_id', product.organization_id)
        .eq('type', 'serpapi')
        .eq('status', 'active')
        .single();

      return data?.credentials;
    });

    if (!credentials?.api_key) {
      // Update keyword with manual status
      await supabase
        .from('keyword_research')
        .update({ source: 'manual', source_data: { error: 'no_api_key' } })
        .eq('id', keywordId);

      return { status: 'no_api_key', keywordId };
    }

    const serpApi = new SerpApiConnector({
      type: 'seo',
      credentials: { apiKey: credentials.api_key },
      config: {},
    } as any);

    // Get keyword data
    const keywordData = await step.run('fetch-keyword-data', async () => {
      const result = await serpApi.search({
        keyword,
        location: product.organizations?.settings?.default_location || 'United States',
      });

      return result;
    });

    // Analyze SERP results
    const serpAnalysis = await step.run('analyze-serp', async () => {
      const analysis = await serpApi.analyzeSERP(keyword);
      return analysis;
    });

    // Get related keywords
    const relatedKeywords = await step.run('get-related', async () => {
      const suggestions = await serpApi.getAutocompleteSuggestions(keyword);
      return suggestions.slice(0, 10);
    });

    // Update keyword record
    // Note: SerpApi doesn't provide search volume/difficulty directly from SERP results
    // These would need to come from a keyword research API or be estimated
    await step.run('update-keyword', async () => {
      await supabase
        .from('keyword_research')
        .update({
          search_volume: keywordData.search_information?.total_results || null,
          related_keywords: relatedKeywords,
          source: 'serpapi',
          source_data: {
            fetched_at: new Date().toISOString(),
            location: product.organizations?.settings?.default_location || 'United States',
            total_results: keywordData.search_information?.total_results,
          },
        })
        .eq('id', keywordId);
    });

    // Save SERP analysis
    await step.run('save-serp-analysis', async () => {
      await supabase.from('serp_analysis').upsert({
        keyword_id: keywordId,
        top_results: serpAnalysis.organicResults?.slice(0, 10) || [],
        featured_snippet: serpAnalysis.featuredSnippet,
        people_also_ask: serpAnalysis.relatedQuestions || [],
        related_searches: serpAnalysis.relatedSearches || [],
        avg_word_count: serpAnalysis.avgWordCount,
        analyzed_at: new Date().toISOString(),
      });
    });

    return {
      status: 'completed',
      keywordId,
      totalResults: keywordData.search_information?.total_results,
    };
  }
);

/**
 * Generate content brief from keyword
 */
export const briefGeneratedHandler = inngest.createFunction(
  {
    id: 'seo-brief-generated',
    retries: 2,
  },
  { event: 'seo/brief-generated' },
  async ({ event, step }) => {
    const { briefId, keywordId, productId } = event.data;
    const supabase = createAdminClient();

    // Load data
    const data = await step.run('load-data', async () => {
      const [briefResult, keywordResult, productResult] = await Promise.all([
        supabase.from('seo_content_briefs').select('*').eq('id', briefId).single(),
        supabase.from('keyword_research').select('*').eq('id', keywordId).single(),
        supabase.from('products').select('*, organizations (*)').eq('id', productId).single(),
      ]);

      return {
        brief: briefResult.data,
        keyword: keywordResult.data,
        product: productResult.data,
      };
    });

    if (!data.keyword || !data.product) {
      return { status: 'missing_data', briefId };
    }

    // Load SERP analysis
    const serpAnalysis = await step.run('load-serp', async () => {
      const { data } = await supabase
        .from('serp_analysis')
        .select('*')
        .eq('keyword_id', keywordId)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .single();

      return data;
    });

    // Generate AI content brief
    const generatedBrief = await step.run('generate-brief', async () => {
      const productContext = {
        name: data.product.name,
        description: data.product.description || '',
        positioning: data.product.positioning || '',
        verifiedClaims: data.product.verified_claims || [],
        features: data.product.features || [],
        benefits: data.product.benefits || [],
      };

      // Transform database SERP analysis to match SerpAnalysis interface
      const transformedSerpAnalysis = serpAnalysis
        ? {
            keyword: data.keyword.keyword,
            organicResults: serpAnalysis.top_results || [],
            relatedQuestions: serpAnalysis.people_also_ask || [],
            relatedSearches: serpAnalysis.related_searches || [],
            featuredSnippet: serpAnalysis.featured_snippet,
            hasLocalPack: false,
            hasKnowledgePanel: false,
            hasAds: false,
            avgWordCount: serpAnalysis.avg_word_count,
            topDomains: [],
          }
        : undefined;

      const brief = await generateContentBrief({
        keyword: data.keyword.keyword,
        serpAnalysis: transformedSerpAnalysis,
        product: productContext,
      });

      return brief;
    });

    // Update brief with generated content
    await step.run('update-brief', async () => {
      await supabase
        .from('seo_content_briefs')
        .update({
          title: generatedBrief.title || data.brief?.title,
          secondary_keywords: generatedBrief.secondaryKeywords,
          suggested_word_count: generatedBrief.suggestedWordCount,
          suggested_headings: generatedBrief.suggestedHeadings,
          outline: generatedBrief.outline,
          meta_description_suggestion: generatedBrief.metaDescriptionSuggestion,
          questions_to_answer: generatedBrief.questionsToAnswer,
          serp_analysis: {
            content_gaps: generatedBrief.competitorGaps,
            unique_angle: generatedBrief.uniqueAngle,
          },
          status: 'draft',
        })
        .eq('id', briefId);

      // Update keyword status
      await supabase
        .from('keyword_research')
        .update({ status: 'assigned' })
        .eq('id', keywordId);
    });

    return { status: 'completed', briefId };
  }
);

/**
 * Daily rank tracking
 */
export const seoRankTracking = inngest.createFunction(
  {
    id: 'seo-rank-tracking',
    retries: 2,
  },
  { cron: '0 6 * * *' }, // 6am daily
  async ({ step }) => {
    const supabase = createAdminClient();

    // Get all active rankings to track
    const rankings = await step.run('load-rankings', async () => {
      const { data } = await supabase
        .from('seo_rankings')
        .select(`
          *,
          products (organization_id)
        `)
        .eq('active', true);

      return data || [];
    });

    if (rankings.length === 0) {
      return { status: 'no_rankings', checked: 0 };
    }

    // Group by organization to batch API calls
    const byOrg = rankings.reduce((acc, r) => {
      const orgId = r.products?.organization_id;
      if (orgId) {
        if (!acc[orgId]) acc[orgId] = [];
        acc[orgId].push(r);
      }
      return acc;
    }, {} as Record<string, typeof rankings>);

    let totalChecked = 0;
    let totalImproved = 0;

    for (const [orgId, orgRankings] of Object.entries(byOrg) as [string, typeof rankings][]) {
      await step.run(`check-rankings-${orgId}`, async () => {
        // Get SerpApi credentials
        const { data: creds } = await supabase
          .from('connectors')
          .select('credentials')
          .eq('organization_id', orgId)
          .eq('type', 'serpapi')
          .eq('status', 'active')
          .single();

        if (!creds?.credentials?.api_key) return;

        const serpApi = new SerpApiConnector({
          type: 'seo',
          credentials: { apiKey: creds.credentials.api_key },
          config: {},
        } as any);

        for (const ranking of orgRankings) {
          try {
            const result = await serpApi.checkRanking({
              keyword: ranking.tracked_keyword,
              url: ranking.tracked_url,
            });
            const newPosition = result.position || 101; // 101 = not found

            // Update ranking
            const newHistory = [
              ...(ranking.position_history || []),
              { date: new Date().toISOString().split('T')[0], position: newPosition },
            ].slice(-90); // Keep last 90 days

            const bestPosition = ranking.best_position
              ? Math.min(ranking.best_position, newPosition)
              : newPosition;

            await supabase
              .from('seo_rankings')
              .update({
                current_position: newPosition,
                best_position: bestPosition,
                position_history: newHistory,
                last_checked_at: new Date().toISOString(),
              })
              .eq('id', ranking.id);

            totalChecked++;
            if (ranking.current_position && newPosition < ranking.current_position) {
              totalImproved++;
            }
          } catch (error) {
            console.error(`Failed to check ranking for ${ranking.id}:`, error);
          }

          // Rate limit: 1 request per second
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      });
    }

    return { status: 'completed', checked: totalChecked, improved: totalImproved };
  }
);

/**
 * Weekly SEO metrics aggregation
 */
export const seoWeeklyMetrics = inngest.createFunction(
  {
    id: 'seo-weekly-metrics',
    retries: 1,
  },
  { cron: '0 7 * * 1' }, // 7am on Mondays
  async ({ step }) => {
    const supabase = createAdminClient();

    await step.run('aggregate-weekly-metrics', async () => {
      // Get all products with SEO content
      const { data: products } = await supabase
        .from('products')
        .select('id, organization_id');

      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const dateStr = lastWeek.toISOString().split('T')[0];

      for (const product of products || []) {
        // Count keywords
        const { count: totalKeywords } = await supabase
          .from('keyword_research')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id);

        const { count: keywordsWithContent } = await supabase
          .from('keyword_research')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .eq('status', 'completed');

        // Get ranking stats
        const { data: rankings } = await supabase
          .from('seo_rankings')
          .select('current_position')
          .eq('product_id', product.id)
          .eq('active', true)
          .not('current_position', 'is', null);

        const avgPosition = rankings?.length
          ? rankings.reduce((sum, r) => sum + (r.current_position || 100), 0) / rankings.length
          : null;

        const top10Count = rankings?.filter(r => (r.current_position || 100) <= 10).length || 0;
        const top3Count = rankings?.filter(r => (r.current_position || 100) <= 3).length || 0;

        // Count briefs
        const { count: totalBriefs } = await supabase
          .from('seo_content_briefs')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id);

        const { count: completedBriefs } = await supabase
          .from('seo_content_briefs')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .eq('status', 'completed');

        // Upsert weekly metrics
        await supabase.from('seo_metrics').upsert({
          product_id: product.id,
          organization_id: product.organization_id,
          date: dateStr,
          total_keywords: totalKeywords || 0,
          keywords_with_content: keywordsWithContent || 0,
          avg_position: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
          top_10_keywords: top10Count,
          top_3_keywords: top3Count,
          total_briefs: totalBriefs || 0,
          completed_briefs: completedBriefs || 0,
          tracked_keywords: rankings?.length || 0,
        });
      }
    });

    return { status: 'completed' };
  }
);

/**
 * Bulk keyword research
 */
export const bulkKeywordResearch = inngest.createFunction(
  {
    id: 'seo-bulk-keyword-research',
    retries: 1,
  },
  { event: 'seo/bulk-research' as any },
  async ({ event, step }) => {
    const { keywordIds, productId, organizationId } = event.data as any;
    const supabase = createAdminClient();

    // Get credentials once
    const credentials = await step.run('get-credentials', async () => {
      const { data } = await supabase
        .from('connectors')
        .select('credentials')
        .eq('organization_id', organizationId)
        .eq('type', 'serpapi')
        .eq('status', 'active')
        .single();

      return data?.credentials;
    });

    if (!credentials?.api_key) {
      return { status: 'no_api_key', processed: 0 };
    }

    // Process keywords in batches
    let processed = 0;
    for (const keywordId of keywordIds) {
      await step.run(`research-${keywordId}`, async () => {
        const { data: keyword } = await supabase
          .from('keyword_research')
          .select('keyword')
          .eq('id', keywordId)
          .single();

        if (keyword) {
          await inngest.send({
            name: 'seo/keyword-research',
            data: {
              keywordId,
              keyword: keyword.keyword,
              productId,
            },
          });
          processed++;
        }
      });

      // Rate limit between keywords
      await step.sleep(`rate-limit-${keywordId}`, '2s');
    }

    return { status: 'completed', processed };
  }
);
