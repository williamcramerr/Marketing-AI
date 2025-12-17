/**
 * Organization-specific Rate Limits
 *
 * Provides different rate limits based on subscription plan.
 * These are multipliers on top of the base rate limits.
 */

import { RateLimitConfig, RATE_LIMIT_CONFIGS } from './limiter';

export type PlanTier = 'free' | 'pro' | 'enterprise';

/**
 * Rate limit multipliers by plan
 * Higher tiers get more generous rate limits
 */
export const PLAN_RATE_MULTIPLIERS: Record<PlanTier, number> = {
  free: 1,
  pro: 3,
  enterprise: 10,
};

/**
 * Get rate limit config adjusted for organization's plan
 */
export function getOrgRateLimitConfig(
  baseConfig: RateLimitConfig,
  planTier: PlanTier
): RateLimitConfig {
  const multiplier = PLAN_RATE_MULTIPLIERS[planTier] || 1;

  return {
    limit: Math.floor(baseConfig.limit * multiplier),
    windowMs: baseConfig.windowMs,
  };
}

/**
 * Plan-specific overrides for certain route types
 * Some routes may have specific limits regardless of plan
 */
export const PLAN_SPECIFIC_LIMITS: Record<PlanTier, Partial<Record<string, RateLimitConfig>>> = {
  free: {
    ai: {
      limit: 10,
      windowMs: 60 * 1000, // 10 AI requests per minute for free
    },
  },
  pro: {
    ai: {
      limit: 50,
      windowMs: 60 * 1000, // 50 AI requests per minute for pro
    },
  },
  enterprise: {
    ai: {
      limit: 200,
      windowMs: 60 * 1000, // 200 AI requests per minute for enterprise
    },
  },
};

/**
 * Get the effective rate limit for an organization and route type
 */
export function getEffectiveRateLimit(
  routeType: string,
  planTier: PlanTier
): RateLimitConfig {
  // Check for plan-specific override first
  const override = PLAN_SPECIFIC_LIMITS[planTier]?.[routeType];
  if (override) {
    return override;
  }

  // Fall back to base config with multiplier
  const baseConfig = RATE_LIMIT_CONFIGS[routeType] || RATE_LIMIT_CONFIGS.api;
  return getOrgRateLimitConfig(baseConfig, planTier);
}

/**
 * Check if an organization has exceeded their daily request quota
 * This is separate from per-minute rate limiting
 */
export const DAILY_REQUEST_LIMITS: Record<PlanTier, number> = {
  free: 1000,
  pro: 50000,
  enterprise: -1, // Unlimited
};

/**
 * Get daily request limit for a plan
 * Returns -1 for unlimited
 */
export function getDailyRequestLimit(planTier: PlanTier): number {
  return DAILY_REQUEST_LIMITS[planTier] || DAILY_REQUEST_LIMITS.free;
}
