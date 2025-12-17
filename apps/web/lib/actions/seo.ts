'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * SEO Content Engine Server Actions
 */

// ============================================
// KEYWORD RESEARCH
// ============================================

export async function getKeywords(filters?: {
  productId?: string;
  status?: string;
  intent?: string;
  minVolume?: number;
  maxDifficulty?: number;
  clusterId?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  let query = supabase
    .from('keyword_research')
    .select(`
      *,
      products (id, name),
      topic_clusters (id, name)
    `)
    .order('search_volume', { ascending: false, nullsFirst: false });

  if (filters?.productId) {
    query = query.eq('product_id', filters.productId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.intent) {
    query = query.eq('intent', filters.intent);
  }
  if (filters?.minVolume) {
    query = query.gte('search_volume', filters.minVolume);
  }
  if (filters?.maxDifficulty) {
    query = query.lte('keyword_difficulty', filters.maxDifficulty);
  }
  if (filters?.clusterId) {
    query = query.eq('cluster_id', filters.clusterId);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data: keywords, error } = await query;

  if (error) throw error;
  return keywords;
}

export async function getKeyword(id: string) {
  const supabase = await createClient();

  const { data: keyword, error } = await supabase
    .from('keyword_research')
    .select(`
      *,
      products (id, name),
      topic_clusters (id, name),
      serp_analysis (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return keyword;
}

export async function createKeyword(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const keyword = formData.get('keyword') as string;
  const productId = formData.get('product_id') as string;
  const searchVolume = formData.get('search_volume') ? parseInt(formData.get('search_volume') as string) : null;
  const keywordDifficulty = formData.get('keyword_difficulty') ? parseInt(formData.get('keyword_difficulty') as string) : null;
  const cpcCents = formData.get('cpc_cents') ? parseInt(formData.get('cpc_cents') as string) : null;
  const intent = formData.get('intent') as string | null;
  const source = (formData.get('source') as string) || 'manual';
  const priority = formData.get('priority') ? parseInt(formData.get('priority') as string) : 50;
  const clusterId = formData.get('cluster_id') as string | null;

  const { data: keywordData, error } = await supabase
    .from('keyword_research')
    .insert({
      product_id: productId,
      keyword: keyword.toLowerCase().trim(),
      search_volume: searchVolume,
      keyword_difficulty: keywordDifficulty,
      cpc_cents: cpcCents,
      intent,
      source,
      priority,
      cluster_id: clusterId || null,
      status: 'discovered',
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/keywords');
  return keywordData;
}

export async function importKeywords(productId: string, keywords: Array<{
  keyword: string;
  search_volume?: number;
  keyword_difficulty?: number;
  cpc_cents?: number;
  intent?: string;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const keywordsToInsert = keywords.map(k => ({
    product_id: productId,
    keyword: k.keyword.toLowerCase().trim(),
    search_volume: k.search_volume || null,
    keyword_difficulty: k.keyword_difficulty || null,
    cpc_cents: k.cpc_cents || null,
    intent: k.intent || null,
    source: 'import',
    status: 'discovered',
    priority: 50,
  }));

  const { data, error } = await supabase
    .from('keyword_research')
    .upsert(keywordsToInsert, {
      onConflict: 'product_id,keyword',
      ignoreDuplicates: true,
    })
    .select();

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/keywords');
  return data;
}

export async function updateKeywordStatus(id: string, status: string, priority?: number) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = { status };
  if (priority !== undefined) updates.priority = priority;

  const { data: keyword, error } = await supabase
    .from('keyword_research')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/keywords');
  return keyword;
}

export async function deleteKeyword(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('keyword_research')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/keywords');
}

// ============================================
// TOPIC CLUSTERS
// ============================================

export async function getTopicClusters(productId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('topic_clusters')
    .select(`
      *,
      products (id, name),
      keyword_research (id, keyword, search_volume, status)
    `)
    .order('created_at', { ascending: false });

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data: clusters, error } = await query;

  if (error) throw error;
  return clusters;
}

export async function createTopicCluster(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const name = formData.get('name') as string;
  const productId = formData.get('product_id') as string;
  const pillarKeyword = formData.get('pillar_keyword') as string;
  const description = formData.get('description') as string | null;

  const { data: cluster, error } = await supabase
    .from('topic_clusters')
    .insert({
      product_id: productId,
      name,
      pillar_keyword: pillarKeyword.toLowerCase().trim(),
      description,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/keywords');
  return cluster;
}

export async function assignKeywordToCluster(keywordId: string, clusterId: string | null) {
  const supabase = await createClient();

  const { data: keyword, error } = await supabase
    .from('keyword_research')
    .update({ cluster_id: clusterId })
    .eq('id', keywordId)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/keywords');
  return keyword;
}

// ============================================
// CONTENT BRIEFS
// ============================================

export async function getContentBriefs(filters?: {
  productId?: string;
  keywordId?: string;
  status?: string;
  limit?: number;
}) {
  const supabase = await createClient();

  let query = supabase
    .from('seo_content_briefs')
    .select(`
      *,
      products (id, name),
      keyword_research (id, keyword, search_volume, keyword_difficulty)
    `)
    .order('created_at', { ascending: false });

  if (filters?.productId) {
    query = query.eq('product_id', filters.productId);
  }
  if (filters?.keywordId) {
    query = query.eq('keyword_id', filters.keywordId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data: briefs, error } = await query;

  if (error) throw error;
  return briefs;
}

export async function getContentBrief(id: string) {
  const supabase = await createClient();

  const { data: brief, error } = await supabase
    .from('seo_content_briefs')
    .select(`
      *,
      products (id, name),
      keyword_research (id, keyword, search_volume, keyword_difficulty, intent),
      serp_analysis (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return brief;
}

export async function createContentBrief(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const productId = formData.get('product_id') as string;
  const keywordId = formData.get('keyword_id') as string | null;
  const title = formData.get('title') as string;
  const targetKeyword = formData.get('target_keyword') as string;
  const secondaryKeywords = (formData.get('secondary_keywords') as string)?.split(',').map(k => k.trim()).filter(Boolean) || [];
  const suggestedWordCount = formData.get('suggested_word_count') ? parseInt(formData.get('suggested_word_count') as string) : null;
  const outline = formData.get('outline') ? JSON.parse(formData.get('outline') as string) : null;
  const metaDescriptionSuggestion = formData.get('meta_description_suggestion') as string | null;
  const questionsToAnswer = (formData.get('questions_to_answer') as string)?.split('\n').map(q => q.trim()).filter(Boolean) || [];

  const { data: brief, error } = await supabase
    .from('seo_content_briefs')
    .insert({
      product_id: productId,
      keyword_id: keywordId || null,
      title,
      target_keyword: targetKeyword.toLowerCase().trim(),
      secondary_keywords: secondaryKeywords,
      suggested_word_count: suggestedWordCount,
      outline,
      meta_description_suggestion: metaDescriptionSuggestion,
      questions_to_answer: questionsToAnswer,
      status: 'draft',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Update keyword status if linked
  if (keywordId) {
    await supabase
      .from('keyword_research')
      .update({ status: 'assigned' })
      .eq('id', keywordId);
  }

  revalidatePath('/dashboard/growth/seo/briefs');
  return brief;
}

export async function updateContentBrief(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const title = formData.get('title');
  if (title) updates.title = title;

  const secondaryKeywords = formData.get('secondary_keywords');
  if (secondaryKeywords) {
    updates.secondary_keywords = (secondaryKeywords as string).split(',').map(k => k.trim()).filter(Boolean);
  }

  const suggestedWordCount = formData.get('suggested_word_count');
  if (suggestedWordCount) updates.suggested_word_count = parseInt(suggestedWordCount as string);

  const outline = formData.get('outline');
  if (outline) updates.outline = JSON.parse(outline as string);

  const metaDescriptionSuggestion = formData.get('meta_description_suggestion');
  if (metaDescriptionSuggestion !== null) updates.meta_description_suggestion = metaDescriptionSuggestion;

  const questionsToAnswer = formData.get('questions_to_answer');
  if (questionsToAnswer) {
    updates.questions_to_answer = (questionsToAnswer as string).split('\n').map(q => q.trim()).filter(Boolean);
  }

  const status = formData.get('status');
  if (status) updates.status = status;

  const { data: brief, error } = await supabase
    .from('seo_content_briefs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/briefs');
  revalidatePath(`/dashboard/growth/seo/briefs/${id}`);
  return brief;
}

export async function approveContentBrief(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: brief, error } = await supabase
    .from('seo_content_briefs')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/briefs');
  return brief;
}

export async function deleteContentBrief(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('seo_content_briefs')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/briefs');
}

// ============================================
// SERP ANALYSIS
// ============================================

export async function getSerpAnalysis(keywordId: string) {
  const supabase = await createClient();

  const { data: analysis, error } = await supabase
    .from('serp_analysis')
    .select('*')
    .eq('keyword_id', keywordId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
  return analysis;
}

export async function saveSerpAnalysis(keywordId: string, analysisData: {
  topResults: Array<{
    position: number;
    url: string;
    title: string;
    description: string;
    wordCount?: number;
  }>;
  featuredSnippet?: Record<string, unknown>;
  peopleAlsoAsk?: string[];
  relatedSearches?: string[];
  avgWordCount?: number;
  avgDomainAuthority?: number;
}) {
  const supabase = await createClient();

  const { data: analysis, error } = await supabase
    .from('serp_analysis')
    .upsert({
      keyword_id: keywordId,
      top_results: analysisData.topResults,
      featured_snippet: analysisData.featuredSnippet || null,
      people_also_ask: analysisData.peopleAlsoAsk || [],
      related_searches: analysisData.relatedSearches || [],
      avg_word_count: analysisData.avgWordCount,
      avg_domain_authority: analysisData.avgDomainAuthority,
      analyzed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return analysis;
}

// ============================================
// RANK TRACKING
// ============================================

export async function getRankings(filters?: {
  productId?: string;
  keywordId?: string;
  contentAssetId?: string;
  active?: boolean;
}) {
  const supabase = await createClient();

  let query = supabase
    .from('seo_rankings')
    .select(`
      *,
      products (id, name),
      keyword_research (id, keyword, search_volume),
      content_assets (id, title)
    `)
    .order('last_checked_at', { ascending: false, nullsFirst: false });

  if (filters?.productId) {
    query = query.eq('product_id', filters.productId);
  }
  if (filters?.keywordId) {
    query = query.eq('keyword_id', filters.keywordId);
  }
  if (filters?.contentAssetId) {
    query = query.eq('content_asset_id', filters.contentAssetId);
  }
  if (filters?.active !== undefined) {
    query = query.eq('active', filters.active);
  }

  const { data: rankings, error } = await query;

  if (error) throw error;
  return rankings;
}

export async function createRankTracking(formData: FormData) {
  const supabase = await createClient();

  const productId = formData.get('product_id') as string;
  const keywordId = formData.get('keyword_id') as string | null;
  const contentAssetId = formData.get('content_asset_id') as string | null;
  const trackedUrl = formData.get('tracked_url') as string;
  const trackedKeyword = formData.get('tracked_keyword') as string;

  const { data: ranking, error } = await supabase
    .from('seo_rankings')
    .insert({
      product_id: productId,
      keyword_id: keywordId || null,
      content_asset_id: contentAssetId || null,
      tracked_url: trackedUrl,
      tracked_keyword: trackedKeyword.toLowerCase().trim(),
      position_history: [],
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/rankings');
  return ranking;
}

export async function updateRankingPosition(id: string, position: number) {
  const supabase = await createClient();

  // First, get current ranking data
  const { data: current, error: fetchError } = await supabase
    .from('seo_rankings')
    .select('current_position, best_position, position_history')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const newHistoryEntry = {
    date: new Date().toISOString().split('T')[0],
    position,
  };

  const positionHistory = [...(current.position_history || []), newHistoryEntry];
  const bestPosition = current.best_position ? Math.min(current.best_position, position) : position;

  const { data: ranking, error } = await supabase
    .from('seo_rankings')
    .update({
      current_position: position,
      best_position: bestPosition,
      position_history: positionHistory,
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/rankings');
  return ranking;
}

export async function deleteRankTracking(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('seo_rankings')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/seo/rankings');
}

// ============================================
// ANALYTICS
// ============================================

export async function getSEOAnalytics(productId?: string, dateRange?: { start: Date; end: Date }) {
  const supabase = await createClient();

  let query = supabase
    .from('seo_metrics')
    .select('*')
    .order('date', { ascending: false });

  if (productId) {
    query = query.eq('product_id', productId);
  }

  if (dateRange) {
    query = query
      .gte('date', dateRange.start.toISOString().split('T')[0])
      .lte('date', dateRange.end.toISOString().split('T')[0]);
  } else {
    // Default to last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
  }

  const { data: metrics, error } = await query;

  if (error) throw error;
  return metrics;
}

export async function getSEOSummary(productId?: string) {
  const supabase = await createClient();

  // Get keyword counts by status
  let keywordQuery = supabase
    .from('keyword_research')
    .select('status');

  if (productId) {
    keywordQuery = keywordQuery.eq('product_id', productId);
  }

  const { data: keywords, error: keywordsError } = await keywordQuery;

  if (keywordsError) throw keywordsError;

  const keywordStatusCounts: Record<string, number> = {};
  keywords?.forEach(k => {
    keywordStatusCounts[k.status] = (keywordStatusCounts[k.status] || 0) + 1;
  });

  // Get brief counts by status
  let briefQuery = supabase
    .from('seo_content_briefs')
    .select('status');

  if (productId) {
    briefQuery = briefQuery.eq('product_id', productId);
  }

  const { data: briefs, error: briefsError } = await briefQuery;

  if (briefsError) throw briefsError;

  const briefStatusCounts: Record<string, number> = {};
  briefs?.forEach(b => {
    briefStatusCounts[b.status] = (briefStatusCounts[b.status] || 0) + 1;
  });

  // Get average rankings
  let rankingQuery = supabase
    .from('seo_rankings')
    .select('current_position')
    .eq('active', true)
    .not('current_position', 'is', null);

  if (productId) {
    rankingQuery = rankingQuery.eq('product_id', productId);
  }

  const { data: rankings, error: rankingsError } = await rankingQuery;

  if (rankingsError) throw rankingsError;

  const avgPosition = rankings?.length
    ? rankings.reduce((sum, r) => sum + (r.current_position || 0), 0) / rankings.length
    : null;

  const top10Count = rankings?.filter(r => (r.current_position || 100) <= 10).length || 0;

  return {
    keywordStatusCounts,
    briefStatusCounts,
    totalKeywords: keywords?.length || 0,
    totalBriefs: briefs?.length || 0,
    avgPosition: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
    top10Count,
    trackedKeywords: rankings?.length || 0,
  };
}
