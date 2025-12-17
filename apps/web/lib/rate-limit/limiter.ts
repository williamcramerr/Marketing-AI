/**
 * Rate Limiting Configuration and Middleware
 *
 * Implements tiered rate limiting based on route type:
 * - API (authenticated): 100 req/min
 * - Auth routes: 10 req/15min
 * - Webhooks: 200 req/min
 * - AI generation: 20 req/min
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitStore, type RateLimitResult } from './store';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

/**
 * Rate limit configurations by route type
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Standard API routes (authenticated)
  api: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  // Authentication routes (login, signup, password reset)
  auth: {
    limit: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Webhook endpoints
  webhook: {
    limit: 200,
    windowMs: 60 * 1000, // 1 minute
  },
  // AI generation endpoints
  ai: {
    limit: 20,
    windowMs: 60 * 1000, // 1 minute
  },
  // OAuth endpoints
  oauth: {
    limit: 30,
    windowMs: 60 * 1000, // 1 minute
  },
};

/**
 * Determine the rate limit config based on the request path
 */
export function getConfigForPath(pathname: string): RateLimitConfig | null {
  // Skip rate limiting for static assets and internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    return null;
  }

  // AI generation endpoints
  if (
    pathname.startsWith('/api/ai') ||
    pathname.startsWith('/api/generate') ||
    pathname.startsWith('/api/tasks') && pathname.includes('/generate')
  ) {
    return RATE_LIMIT_CONFIGS.ai;
  }

  // Webhook endpoints
  if (pathname.startsWith('/api/webhooks') || pathname.startsWith('/api/inngest')) {
    return RATE_LIMIT_CONFIGS.webhook;
  }

  // OAuth endpoints
  if (pathname.startsWith('/api/oauth')) {
    return RATE_LIMIT_CONFIGS.oauth;
  }

  // Auth routes
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/api/auth')
  ) {
    return RATE_LIMIT_CONFIGS.auth;
  }

  // Standard API routes
  if (pathname.startsWith('/api')) {
    return RATE_LIMIT_CONFIGS.api;
  }

  // Don't rate limit page requests
  return null;
}

/**
 * Extract a unique identifier for rate limiting
 * Uses IP address for unauthenticated requests
 * Uses user ID for authenticated requests (when available)
 */
export function getRateLimitKey(
  request: NextRequest,
  pathname: string,
  userId?: string
): string {
  // Get IP address from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

  // Use user ID if available, otherwise use IP
  const identifier = userId || ip;

  // Include the route category in the key to separate rate limits
  const routeType = getRouteType(pathname);

  return `rate_limit:${routeType}:${identifier}`;
}

/**
 * Get the route type for categorizing rate limits
 */
function getRouteType(pathname: string): string {
  if (pathname.startsWith('/api/ai') || pathname.startsWith('/api/generate')) {
    return 'ai';
  }
  if (pathname.startsWith('/api/webhooks') || pathname.startsWith('/api/inngest')) {
    return 'webhook';
  }
  if (pathname.startsWith('/api/oauth')) {
    return 'oauth';
  }
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/api/auth')
  ) {
    return 'auth';
  }
  if (pathname.startsWith('/api')) {
    return 'api';
  }
  return 'page';
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toString());

  if (result.retryAfter !== undefined) {
    response.headers.set('Retry-After', result.retryAfter.toString());
  }

  return response;
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const response = NextResponse.json(
    {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: result.retryAfter,
      },
    },
    { status: 429 }
  );

  return addRateLimitHeaders(response, result);
}

/**
 * Check rate limit for a request
 * Returns null if not rate limited, or a 429 response if limited
 */
export async function checkRateLimit(
  request: NextRequest,
  userId?: string
): Promise<{ result: RateLimitResult; response?: NextResponse } | null> {
  const pathname = request.nextUrl.pathname;
  const config = getConfigForPath(pathname);

  // Skip rate limiting if no config for this path
  if (!config) {
    return null;
  }

  const key = getRateLimitKey(request, pathname, userId);
  const result = await rateLimitStore.check(key, config.limit, config.windowMs);

  if (!result.success) {
    return {
      result,
      response: createRateLimitResponse(result),
    };
  }

  return { result };
}

/**
 * Rate limiting middleware function
 * Call this at the start of middleware to check and enforce rate limits
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  userId?: string
): Promise<NextResponse | null> {
  const rateCheck = await checkRateLimit(request, userId);

  if (rateCheck?.response) {
    return rateCheck.response;
  }

  return null;
}

/**
 * Apply rate limit headers to an existing response
 * Call this after processing to add rate limit info to successful responses
 */
export async function applyRateLimitHeaders(
  request: NextRequest,
  response: NextResponse,
  userId?: string
): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const config = getConfigForPath(pathname);

  if (!config) {
    return response;
  }

  const key = getRateLimitKey(request, pathname, userId);
  const count = await rateLimitStore.get(key);

  // Add headers showing current usage
  response.headers.set('X-RateLimit-Limit', config.limit.toString());
  response.headers.set('X-RateLimit-Remaining', Math.max(0, config.limit - count).toString());

  return response;
}
