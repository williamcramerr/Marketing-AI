'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Social Listening Server Actions
 */

// ============================================
// LISTENING CONFIGS
// ============================================

export async function getListeningConfigs() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: configs, error } = await supabase
    .from('social_listening_configs')
    .select(`
      *,
      products (id, name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return configs;
}

export async function getListeningConfig(id: string) {
  const supabase = await createClient();

  const { data: config, error } = await supabase
    .from('social_listening_configs')
    .select(`
      *,
      products (id, name),
      organizations (id, name)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return config;
}

interface CreateListeningConfigInput {
  name: string;
  organizationId?: string;
  productId?: string | null;
  platforms: string[];
  keywords: string[];
  negativeKeywords?: string[];
  subreddits?: string[];
  intentThreshold?: 'low' | 'medium' | 'high';
  autoRespond?: boolean;
  responseTemplate?: string;
}

export async function createListeningConfig(input: FormData | CreateListeningConfigInput): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  let name: string;
  let organizationId: string | null = null;
  let productId: string | null = null;
  let platforms: string[];
  let keywords: string[];
  let negativeKeywords: string[] = [];
  let subreddits: string[] = [];
  let intentThreshold = 'medium';
  let autoRespond = false;
  let responseTemplate: string | null = null;

  if (input instanceof FormData) {
    name = input.get('name') as string;
    organizationId = input.get('organization_id') as string;
    productId = input.get('product_id') as string | null;
    platforms = (input.get('platforms') as string).split(',').filter(Boolean);
    keywords = (input.get('keywords') as string).split(',').map(k => k.trim()).filter(Boolean);
    negativeKeywords = (input.get('negative_keywords') as string)?.split(',').map(k => k.trim()).filter(Boolean) || [];
    subreddits = (input.get('subreddits') as string)?.split(',').map(k => k.trim()).filter(Boolean) || [];
    intentThreshold = (input.get('intent_threshold') as string) || 'medium';
    autoRespond = input.get('auto_respond') === 'true';
    responseTemplate = input.get('response_template') as string | null;
  } else {
    name = input.name;
    organizationId = input.organizationId || null;
    productId = input.productId || null;
    platforms = input.platforms;
    keywords = input.keywords;
    negativeKeywords = input.negativeKeywords || [];
    subreddits = input.subreddits || [];
    intentThreshold = input.intentThreshold || 'medium';
    autoRespond = input.autoRespond || false;
    responseTemplate = input.responseTemplate || null;
  }

  // If no organization provided, get from user's membership
  if (!organizationId) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }
    organizationId = membership.organization_id;
  }

  const { data: config, error } = await supabase
    .from('social_listening_configs')
    .insert({
      organization_id: organizationId,
      product_id: productId || null,
      name,
      platforms,
      keywords,
      negative_keywords: negativeKeywords,
      subreddits,
      intent_threshold: intentThreshold,
      auto_respond: autoRespond,
      response_template: responseTemplate,
      active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/growth/listening');
  return { success: true, data: config };
}

export async function updateListeningConfig(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const name = formData.get('name');
  if (name) updates.name = name;

  const platforms = formData.get('platforms');
  if (platforms) updates.platforms = (platforms as string).split(',').filter(Boolean);

  const keywords = formData.get('keywords');
  if (keywords) updates.keywords = (keywords as string).split(',').map(k => k.trim()).filter(Boolean);

  const negativeKeywords = formData.get('negative_keywords');
  if (negativeKeywords !== null) {
    updates.negative_keywords = (negativeKeywords as string).split(',').map(k => k.trim()).filter(Boolean);
  }

  const active = formData.get('active');
  if (active !== null) updates.active = active === 'true';

  const { data: config, error } = await supabase
    .from('social_listening_configs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/listening');
  revalidatePath(`/dashboard/growth/listening/configs/${id}`);
  return config;
}

export async function deleteListeningConfig(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('social_listening_configs')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/listening');
}

export async function toggleListeningConfig(id: string, active: boolean) {
  const supabase = await createClient();

  const { data: config, error } = await supabase
    .from('social_listening_configs')
    .update({ active })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/listening');
  revalidatePath('/dashboard/growth/listening/configs');
  return config;
}

// ============================================
// CONVERSATIONS
// ============================================

export async function getConversations(filters?: {
  configId?: string;
  status?: string;
  intentLevel?: string;
  platform?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();

  let query = supabase
    .from('social_conversations')
    .select(`
      *,
      social_listening_configs (id, name, organization_id)
    `)
    .order('discovered_at', { ascending: false });

  if (filters?.configId) {
    query = query.eq('config_id', filters.configId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.intentLevel) {
    query = query.eq('intent_level', filters.intentLevel);
  }
  if (filters?.platform) {
    query = query.eq('platform', filters.platform);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data: conversations, error } = await query;

  if (error) throw error;
  return conversations;
}

export async function getConversation(id: string) {
  const supabase = await createClient();

  const { data: conversation, error } = await supabase
    .from('social_conversations')
    .select(`
      *,
      social_listening_configs (id, name, organization_id),
      social_replies (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return conversation;
}

export async function updateConversationStatus(
  id: string,
  status: 'new' | 'reviewing' | 'replied' | 'dismissed' | 'converted' | 'expired',
  dismissReason?: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const updates: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  };

  if (dismissReason) {
    updates.dismiss_reason = dismissReason;
  }

  const { data: conversation, error } = await supabase
    .from('social_conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/listening');
  return conversation;
}

export async function bulkUpdateConversations(
  ids: string[],
  updates: { status?: string; dismiss_reason?: string }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('social_conversations')
    .update({
      ...updates,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .in('id', ids);

  if (error) throw error;

  revalidatePath('/dashboard/growth/listening');
}

export async function reviewConversation(id: string) {
  return updateConversationStatus(id, 'reviewing');
}

export async function dismissConversation(id: string, reason?: string) {
  return updateConversationStatus(id, 'dismissed', reason);
}

export async function regenerateResponse(conversationId: string): Promise<{
  success: boolean;
  data?: { suggestedResponse: string };
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get the conversation context
  const { data: conversation, error: fetchError } = await supabase
    .from('social_conversations')
    .select(`
      *,
      social_listening_configs (
        response_template,
        products (name, description)
      )
    `)
    .eq('id', conversationId)
    .single();

  if (fetchError || !conversation) {
    return { success: false, error: 'Conversation not found' };
  }

  // Generate a basic response template (in production, this would call an AI service)
  const productName = conversation.social_listening_configs?.products?.name || 'our product';
  const template = conversation.social_listening_configs?.response_template;

  let suggestedResponse = template
    ? template.replace(/\{product\}/g, productName)
    : `Thanks for your interest! ${productName} might be a great fit for your needs. Would you like to learn more?`;

  return {
    success: true,
    data: { suggestedResponse }
  };
}

// ============================================
// REPLIES
// ============================================

interface CreateReplyInput {
  conversationId: string;
  content: string;
  status?: string;
  connectorId?: string | null;
  aiGenerated?: boolean;
  editedContent?: string | null;
}

export async function createReply(input: FormData | CreateReplyInput): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  let conversationId: string;
  let content: string;
  let connectorId: string | null = null;
  let aiGenerated = false;
  let editedContent: string | null = null;
  let status = 'draft';

  if (input instanceof FormData) {
    conversationId = input.get('conversation_id') as string;
    content = input.get('content') as string;
    connectorId = input.get('connector_id') as string | null;
    aiGenerated = input.get('ai_generated') === 'true';
    editedContent = input.get('edited_content') as string | null;
  } else {
    conversationId = input.conversationId;
    content = input.content;
    connectorId = input.connectorId ?? null;
    aiGenerated = input.aiGenerated ?? false;
    editedContent = input.editedContent ?? null;
    status = input.status ?? 'draft';
  }

  const { data: reply, error } = await supabase
    .from('social_replies')
    .insert({
      conversation_id: conversationId,
      connector_id: connectorId || null,
      content,
      ai_generated: aiGenerated,
      edited_content: editedContent,
      status,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/growth/listening');
  return { success: true, data: reply };
}

export async function updateReply(id: string, formData: FormData) {
  const supabase = await createClient();

  const content = formData.get('content') as string;
  const editedContent = formData.get('edited_content') as string | null;

  const { data: reply, error } = await supabase
    .from('social_replies')
    .update({
      content,
      edited_content: editedContent,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/listening');
  return reply;
}

export async function approveReply(id: string): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: reply, error } = await supabase
    .from('social_replies')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/growth/listening');
  return { success: true, data: reply };
}

export async function rejectReply(id: string, reason: string) {
  const supabase = await createClient();

  const { data: reply, error } = await supabase
    .from('social_replies')
    .update({
      status: 'draft',
      rejection_reason: reason,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/listening');
  return reply;
}

export async function scheduleReply(id: string, scheduledFor: Date) {
  const supabase = await createClient();

  const { data: reply, error } = await supabase
    .from('social_replies')
    .update({
      status: 'scheduled',
      scheduled_for: scheduledFor.toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/listening');
  return reply;
}

// ============================================
// ANALYTICS
// ============================================

export async function getListeningAnalytics(configId?: string, dateRange?: { start: Date; end: Date }) {
  const supabase = await createClient();

  let query = supabase
    .from('social_listening_metrics')
    .select('*')
    .order('date', { ascending: false });

  if (configId) {
    query = query.eq('config_id', configId);
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

export async function getListeningSummary() {
  const supabase = await createClient();

  // Get conversation counts by status
  const { data: statusCounts, error: statusError } = await supabase
    .from('social_conversations')
    .select('status')
    .then(result => {
      if (result.error) return { data: null, error: result.error };

      const counts: Record<string, number> = {};
      result.data?.forEach(row => {
        counts[row.status] = (counts[row.status] || 0) + 1;
      });
      return { data: counts, error: null };
    });

  if (statusError) throw statusError;

  // Get high intent conversations from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count: todayHighIntent, error: highIntentError } = await supabase
    .from('social_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('intent_level', 'high')
    .gte('discovered_at', today.toISOString());

  if (highIntentError) throw highIntentError;

  // Get replies sent this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count: repliesSentWeek, error: repliesError } = await supabase
    .from('social_replies')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', weekAgo.toISOString());

  if (repliesError) throw repliesError;

  return {
    statusCounts,
    todayHighIntent: todayHighIntent || 0,
    repliesSentWeek: repliesSentWeek || 0,
  };
}
