/**
 * AI Usage Tracking and Cost Controls
 *
 * Tracks Claude API usage per organization, enforces limits,
 * and records costs for billing purposes.
 */

import Anthropic from '@anthropic-ai/sdk';
import { anthropic, DEFAULT_MODEL, MODELS } from './client';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSubscriptionInfo } from '@/lib/stripe/subscriptions';
import { logger } from '@/lib/logging';

/**
 * Model pricing (per 1M tokens) in cents
 * Updated for Claude 3.5 Sonnet and other models
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 300, output: 1500 }, // $3/$15 per 1M
  'claude-3-opus-20240229': { input: 1500, output: 7500 }, // $15/$75 per 1M
  'claude-3-haiku-20240307': { input: 25, output: 125 }, // $0.25/$1.25 per 1M
};

/**
 * Calculate cost in cents for a given model and token counts
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return Math.ceil(inputCost + outputCost);
}

/**
 * Check if organization has available AI tokens
 */
export async function checkUsageLimits(
  organizationId: string
): Promise<{
  allowed: boolean;
  tokensUsed: number;
  tokensRemaining: number;
  tokensLimit: number;
  isOverageAllowed: boolean;
}> {
  const supabase = createAdminClient();

  // Get subscription info
  const subscription = await getSubscriptionInfo(organizationId);
  const tokensLimit = subscription?.plan.limits.aiTokensMonthly ?? 50000;

  // Check if overage is allowed (pro and enterprise plans)
  const isOverageAllowed =
    subscription?.plan.slug === 'pro' ||
    subscription?.plan.slug === 'enterprise';

  // Get current month's usage
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const { data: monthlyUsage } = await supabase
    .from('ai_usage_monthly')
    .select('total_tokens')
    .eq('organization_id', organizationId)
    .gte('period_start', periodStart.toISOString().split('T')[0])
    .limit(1)
    .single();

  const tokensUsed = monthlyUsage?.total_tokens || 0;
  const tokensRemaining = Math.max(0, tokensLimit - tokensUsed);

  // Allow if under limit OR if overage is permitted
  const allowed = tokensRemaining > 0 || isOverageAllowed;

  return {
    allowed,
    tokensUsed,
    tokensRemaining,
    tokensLimit,
    isOverageAllowed,
  };
}

/**
 * Record AI usage in the database
 */
export async function recordAIUsage({
  organizationId,
  taskId,
  userId,
  model,
  inputTokens,
  outputTokens,
  requestType,
  metadata,
}: {
  organizationId: string;
  taskId?: string;
  userId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  requestType?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  const costCents = calculateCost(model, inputTokens, outputTokens);

  await supabase.from('ai_usage').insert({
    organization_id: organizationId,
    task_id: taskId,
    user_id: userId,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_cents: costCents,
    request_type: requestType,
    metadata: metadata || {},
  });

  logger.info('AI usage recorded', {
    organizationId,
    model,
    inputTokens,
    outputTokens,
    costCents,
    requestType,
  });
}

/**
 * Parameters for tracked AI message creation
 */
export interface TrackedMessageParams {
  organizationId: string;
  taskId?: string;
  userId?: string;
  requestType?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  messages: Anthropic.Messages.MessageParam[];
  system?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result from tracked message creation
 */
export interface TrackedMessageResult {
  message: Anthropic.Messages.Message;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costCents: number;
  };
}

/**
 * Create a message with usage tracking
 *
 * This is the primary method for making Claude API calls with
 * automatic usage tracking and limit enforcement.
 */
export async function createMessageWithTracking(
  params: TrackedMessageParams
): Promise<TrackedMessageResult> {
  const {
    organizationId,
    taskId,
    userId,
    requestType,
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    messages,
    system,
    metadata,
  } = params;

  // Check usage limits before making the request
  const limits = await checkUsageLimits(organizationId);

  if (!limits.allowed) {
    throw new AIUsageLimitError(
      'AI usage limit exceeded. Please upgrade your plan to continue.',
      {
        tokensUsed: limits.tokensUsed,
        tokensLimit: limits.tokensLimit,
        tokensRemaining: limits.tokensRemaining,
      }
    );
  }

  // Make the API call
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages,
    ...(system && { system }),
  });

  // Extract usage
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costCents = calculateCost(model, inputTokens, outputTokens);

  // Record usage
  await recordAIUsage({
    organizationId,
    taskId,
    userId,
    model,
    inputTokens,
    outputTokens,
    requestType,
    metadata: {
      ...metadata,
      stopReason: response.stop_reason,
    },
  });

  return {
    message: response,
    usage: {
      inputTokens,
      outputTokens,
      costCents,
    },
  };
}

/**
 * Custom error for AI usage limits
 */
export class AIUsageLimitError extends Error {
  public readonly tokensUsed: number;
  public readonly tokensLimit: number;
  public readonly tokensRemaining: number;

  constructor(
    message: string,
    details: {
      tokensUsed: number;
      tokensLimit: number;
      tokensRemaining: number;
    }
  ) {
    super(message);
    this.name = 'AIUsageLimitError';
    this.tokensUsed = details.tokensUsed;
    this.tokensLimit = details.tokensLimit;
    this.tokensRemaining = details.tokensRemaining;
  }
}

/**
 * Get usage statistics for an organization
 */
export async function getOrganizationUsageStats(organizationId: string) {
  const supabase = createAdminClient();

  // Get current month
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  // Get monthly aggregate
  const { data: monthlyUsage } = await supabase
    .from('ai_usage_monthly')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('period_start', periodStart.toISOString().split('T')[0])
    .limit(1)
    .single();

  // Get subscription info
  const subscription = await getSubscriptionInfo(organizationId);

  // Get daily breakdown for current month
  const { data: dailyUsage } = await supabase
    .from('ai_usage')
    .select('created_at, input_tokens, output_tokens, cost_cents')
    .eq('organization_id', organizationId)
    .gte('created_at', periodStart.toISOString())
    .order('created_at', { ascending: true });

  // Group by day
  const dailyBreakdown: Record<string, { tokens: number; cost: number; requests: number }> = {};

  for (const usage of dailyUsage || []) {
    const day = new Date(usage.created_at).toISOString().split('T')[0];
    if (!dailyBreakdown[day]) {
      dailyBreakdown[day] = { tokens: 0, cost: 0, requests: 0 };
    }
    dailyBreakdown[day].tokens += usage.input_tokens + usage.output_tokens;
    dailyBreakdown[day].cost += usage.cost_cents;
    dailyBreakdown[day].requests += 1;
  }

  return {
    currentPeriod: {
      start: periodStart.toISOString(),
      end: new Date(
        periodStart.getFullYear(),
        periodStart.getMonth() + 1,
        0
      ).toISOString(),
    },
    usage: {
      tokensUsed: monthlyUsage?.total_tokens || 0,
      tokensIncluded: subscription?.plan.limits.aiTokensMonthly || 50000,
      tokensOverage: monthlyUsage?.tokens_overage || 0,
      costCents: monthlyUsage?.total_cost_cents || 0,
      overageCostCents: monthlyUsage?.overage_cost_cents || 0,
      requestCount: monthlyUsage?.request_count || 0,
    },
    plan: subscription?.plan || null,
    dailyBreakdown,
  };
}

/**
 * Check if organization is approaching usage limit
 * Returns warning level: 'none' | 'warning' | 'critical'
 */
export async function checkUsageWarningLevel(
  organizationId: string
): Promise<'none' | 'warning' | 'critical'> {
  const limits = await checkUsageLimits(organizationId);

  const usagePercent = (limits.tokensUsed / limits.tokensLimit) * 100;

  if (usagePercent >= 100) {
    return 'critical';
  } else if (usagePercent >= 80) {
    return 'warning';
  }

  return 'none';
}
