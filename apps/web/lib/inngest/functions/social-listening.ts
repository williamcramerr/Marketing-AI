import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeConversation, generateResponse, batchAnalyzeConversations } from '@/lib/ai/social-listening';
import { TwitterSearchConnector } from '@/lib/connectors/social-listening/twitter-search';
import { RedditSearchConnector } from '@/lib/connectors/social-listening/reddit';
import type { DiscoveredConversation } from '@/lib/connectors/social-listening/base';

/**
 * Social Listening Cron - Scans platforms for new conversations
 * Runs every 15 minutes
 */
export const socialListeningScan = inngest.createFunction(
  {
    id: 'social-listening-scan',
    retries: 2,
  },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ step }) => {
    const supabase = createAdminClient();

    // Step 1: Get all active listening configs
    const configs = await step.run('load-configs', async () => {
      const { data, error } = await supabase
        .from('social_listening_configs')
        .select(`
          *,
          products (id, name, description, positioning),
          organizations (id, name)
        `)
        .eq('active', true);

      if (error) throw error;
      return data || [];
    });

    if (configs.length === 0) {
      return { status: 'no_active_configs', scanned: 0 };
    }

    let totalConversationsFound = 0;
    let totalHighIntent = 0;

    // Step 2: Process each config
    for (const config of configs) {
      const configConversations = await step.run(`scan-config-${config.id}`, async () => {
        const allConversations: DiscoveredConversation[] = [];

        // Build search query from config
        const query = {
          keywords: config.keywords,
          negativeKeywords: config.negative_keywords || [],
          subreddits: config.subreddits || [],
          since: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
        };

        // Search each platform
        for (const platform of config.platforms) {
          try {
            let connector;

            if (platform === 'twitter') {
              // Get Twitter credentials from vault
              const { data: creds } = await supabase
                .from('connectors')
                .select('credentials')
                .eq('organization_id', config.organization_id)
                .eq('type', 'twitter')
                .eq('status', 'active')
                .single();

              if (creds?.credentials?.bearer_token) {
                connector = new TwitterSearchConnector({
                  id: `twitter-${config.id}`,
                  organizationId: config.organization_id,
                  type: 'social_listening',
                  name: 'Twitter Search',
                  credentials: {
                    bearerToken: creds.credentials.bearer_token,
                  },
                  config: {},
                  active: true,
                  rateLimit: { perHour: 100, perDay: 1000 },
                });
              }
            } else if (platform === 'reddit') {
              // Get Reddit credentials
              const { data: creds } = await supabase
                .from('connectors')
                .select('credentials')
                .eq('organization_id', config.organization_id)
                .eq('type', 'reddit')
                .eq('status', 'active')
                .single();

              if (creds?.credentials) {
                connector = new RedditSearchConnector({
                  id: `reddit-${config.id}`,
                  organizationId: config.organization_id,
                  type: 'social_listening',
                  name: 'Reddit Search',
                  credentials: {
                    clientId: creds.credentials.client_id,
                    clientSecret: creds.credentials.client_secret,
                  },
                  config: {
                    subreddits: config.subreddits || [],
                  },
                  active: true,
                  rateLimit: { perHour: 60, perDay: 1000 },
                });
              }
            }

            if (connector) {
              const result = await connector.search(query);
              allConversations.push(...result.conversations);
            }
          } catch (error) {
            console.error(`Error searching ${platform}:`, error);
          }
        }

        return allConversations;
      });

      // Step 3: Filter out existing conversations
      const newConversations = await step.run(`filter-existing-${config.id}`, async () => {
        if (configConversations.length === 0) return [];

        const externalIds = configConversations.map(c => c.externalId);

        const { data: existing } = await supabase
          .from('social_conversations')
          .select('external_id')
          .eq('config_id', config.id)
          .in('external_id', externalIds);

        const existingIds = new Set(existing?.map(e => e.external_id) || []);
        return configConversations.filter(c => !existingIds.has(c.externalId));
      }) as unknown as DiscoveredConversation[];

      if (newConversations.length === 0) continue;

      // Step 4: Analyze conversations with AI
      const analyzed = await step.run(`analyze-conversations-${config.id}`, async () => {
        const productContext = {
          name: config.products?.name || 'Unknown Product',
          description: config.products?.description || '',
          positioning: config.products?.positioning || '',
          verifiedClaims: [],
          features: [],
          benefits: [],
        };

        const analyses = await batchAnalyzeConversations(
          newConversations.map(c => ({
            platform: c.platform,
            content: c.content,
            parentContent: c.parentContent,
            authorUsername: c.authorUsername,
          })),
          productContext,
          config.keywords || []
        );

        return newConversations.map((conv, i) => ({
          conversation: conv,
          analysis: analyses.get(`${conv.platform}_${i}`)!,
        }));
      });

      // Step 5: Filter by intent threshold and save
      const savedCount = await step.run(`save-conversations-${config.id}`, async () => {
        const intentThresholds: Record<string, number> = {
          low: 30,
          medium: 50,
          high: 70,
        };
        const threshold = intentThresholds[config.intent_threshold] || 50;

        const toSave = analyzed.filter(
          a => a.analysis.isOpportunity && a.analysis.intentScore >= threshold
        );

        if (toSave.length === 0) return 0;

        const records = toSave.map(({ conversation, analysis }) => ({
          config_id: config.id,
          platform: conversation.platform,
          external_id: conversation.externalId,
          author_username: conversation.authorUsername,
          author_profile_url: conversation.authorProfileUrl,
          content: conversation.content,
          content_url: conversation.externalUrl,
          parent_content: conversation.parentContent,
          intent_score: analysis.intentScore,
          intent_level: analysis.intentLevel,
          opportunity_type: analysis.opportunityType,
          relevance_score: analysis.relevanceScore,
          ai_analysis: {
            reasoning: analysis.reasoning,
            topics: analysis.topics,
            responseApproach: analysis.responseApproach,
          },
          suggested_response: analysis.suggestedResponse,
          status: 'new',
          discovered_at: conversation.publishedAt,
        }));

        const { error } = await supabase
          .from('social_conversations')
          .insert(records);

        if (error) throw error;

        // Send events for high-intent conversations
        for (const item of toSave) {
          if (item.analysis.intentLevel === 'high') {
            await inngest.send({
              name: 'social-listening/conversation-found',
              data: {
                conversationId: item.conversation.externalId,
                configId: config.id,
                platform: item.conversation.platform,
                intentLevel: 'high',
              },
            });
            totalHighIntent++;
          }
        }

        return toSave.length;
      });

      totalConversationsFound += savedCount;
    }

    // Step 6: Update metrics
    await step.run('update-metrics', async () => {
      const today = new Date().toISOString().split('T')[0];

      for (const config of configs) {
        await supabase.rpc('increment_social_listening_metrics', {
          p_config_id: config.id,
          p_date: today,
          p_conversations_found: totalConversationsFound,
          p_high_intent_found: totalHighIntent,
        });
      }
    });

    return {
      status: 'completed',
      configsScanned: configs.length,
      conversationsFound: totalConversationsFound,
      highIntentFound: totalHighIntent,
    };
  }
);

/**
 * Handle high-intent conversation found
 * Sends notifications and generates response if auto-respond is enabled
 */
export const conversationFoundHandler = inngest.createFunction(
  {
    id: 'social-listening-conversation-found',
    retries: 2,
  },
  { event: 'social-listening/conversation-found' },
  async ({ event, step }) => {
    const { conversationId, configId, platform, intentLevel } = event.data;
    const supabase = createAdminClient();

    // Load conversation and config
    const data = await step.run('load-data', async () => {
      const { data: conversation } = await supabase
        .from('social_conversations')
        .select(`
          *,
          social_listening_configs (
            *,
            products (id, name, description, positioning),
            organizations (id, name)
          )
        `)
        .eq('external_id', conversationId)
        .eq('config_id', configId)
        .single();

      return conversation;
    });

    if (!data) {
      return { status: 'conversation_not_found' };
    }

    const config = data.social_listening_configs;

    // Generate AI response if not already suggested
    if (!data.suggested_response && config.products) {
      await step.run('generate-response', async () => {
        const response = await generateResponse({
          conversation: {
            platform: data.platform,
            content: data.content,
            parentContent: data.parent_content,
            authorUsername: data.author_username,
          },
          product: {
            name: config.products.name,
            description: config.products.description || '',
            positioning: config.products.positioning || '',
            verifiedClaims: [],
            features: [],
            benefits: [],
          },
          analysis: data.ai_analysis as any,
          tone: 'helpful',
          maxLength: data.platform === 'twitter' ? 280 : 500,
          responseGuidelines: config.response_template,
        });

        await supabase
          .from('social_conversations')
          .update({ suggested_response: response.content })
          .eq('id', data.id);
      });
    }

    // Auto-respond if enabled
    if (config.auto_respond && intentLevel === 'high') {
      await step.run('auto-create-reply', async () => {
        await supabase.from('social_replies').insert({
          conversation_id: data.id,
          content: data.suggested_response,
          ai_generated: true,
          status: 'pending_approval',
        });
      });
    }

    // Send notification (would integrate with notification system)
    await step.run('send-notification', async () => {
      // TODO: Integrate with notification system (email, Slack, etc.)
      console.log(`High-intent conversation found: ${conversationId} on ${platform}`);
    });

    return { status: 'processed', conversationId };
  }
);

/**
 * Handle reply approval - sends the reply to the platform
 */
export const replyApprovedHandler = inngest.createFunction(
  {
    id: 'social-listening-reply-approved',
    retries: 3,
  },
  { event: 'social-listening/reply-approved' },
  async ({ event, step }) => {
    const { replyId, conversationId, connectorId } = event.data;
    const supabase = createAdminClient();

    // Load reply and conversation
    const data = await step.run('load-data', async () => {
      const { data: reply } = await supabase
        .from('social_replies')
        .select(`
          *,
          social_conversations (
            *,
            social_listening_configs (organization_id, products (id, name))
          )
        `)
        .eq('id', replyId)
        .single();

      return reply;
    });

    if (!data) {
      return { status: 'reply_not_found' };
    }

    const conversation = data.social_conversations;
    const platform = conversation.platform;

    // Get connector credentials
    const credentials = await step.run('get-credentials', async () => {
      const { data: connector } = await supabase
        .from('connectors')
        .select('credentials, config')
        .eq('id', connectorId || '')
        .single();

      if (!connector && connectorId) {
        throw new Error('Connector not found');
      }

      return connector?.credentials;
    });

    // Send reply via platform connector
    const result = await step.run('send-reply', async () => {
      // This would integrate with the actual platform APIs
      // For now, we'll simulate the send
      const externalReplyId = `reply-${Date.now()}`;

      return {
        success: true,
        externalReplyId,
        platform,
      };
    });

    // Update reply status
    await step.run('update-status', async () => {
      await supabase
        .from('social_replies')
        .update({
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? new Date().toISOString() : null,
          external_reply_id: result.externalReplyId,
        })
        .eq('id', replyId);

      // Update conversation status
      await supabase
        .from('social_conversations')
        .update({ status: 'replied' })
        .eq('id', data.conversation_id);
    });

    return { status: 'sent', externalReplyId: result.externalReplyId };
  }
);

/**
 * Daily cleanup and metrics aggregation
 */
export const socialListeningDailyMaintenance = inngest.createFunction(
  {
    id: 'social-listening-daily-maintenance',
    retries: 1,
  },
  { cron: '0 2 * * *' }, // 2am daily
  async ({ step }) => {
    const supabase = createAdminClient();

    // Mark old conversations as expired
    await step.run('expire-old-conversations', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await supabase
        .from('social_conversations')
        .update({ status: 'expired' })
        .eq('status', 'new')
        .lt('discovered_at', thirtyDaysAgo.toISOString());
    });

    // Aggregate daily metrics
    await step.run('aggregate-metrics', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // Get configs and aggregate their metrics
      const { data: configs } = await supabase
        .from('social_listening_configs')
        .select('id, organization_id');

      for (const config of configs || []) {
        const { data: conversations } = await supabase
          .from('social_conversations')
          .select('status, intent_level')
          .eq('config_id', config.id)
          .gte('discovered_at', `${dateStr}T00:00:00`)
          .lt('discovered_at', `${dateStr}T23:59:59`);

        const { data: replies } = await supabase
          .from('social_replies')
          .select('status')
          .eq('conversation_id', config.id)
          .gte('created_at', `${dateStr}T00:00:00`)
          .lt('created_at', `${dateStr}T23:59:59`);

        // Upsert daily metrics
        await supabase.from('social_listening_metrics').upsert({
          config_id: config.id,
          organization_id: config.organization_id,
          date: dateStr,
          conversations_found: conversations?.length || 0,
          high_intent_found: conversations?.filter(c => c.intent_level === 'high').length || 0,
          replies_sent: replies?.filter(r => r.status === 'sent').length || 0,
          conversations_converted: conversations?.filter(c => c.status === 'converted').length || 0,
        });
      }
    });

    return { status: 'completed' };
  }
);
