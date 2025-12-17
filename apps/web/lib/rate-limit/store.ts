/**
 * In-Memory Rate Limit Store with Sliding Window
 *
 * This implementation uses a simple in-memory store suitable for single-instance deployments.
 * For production with multiple instances, consider using Upstash Redis:
 *
 * import { Ratelimit } from '@upstash/ratelimit';
 * import { Redis } from '@upstash/redis';
 *
 * const redis = new Redis({
 *   url: process.env.UPSTASH_REDIS_REST_URL,
 *   token: process.env.UPSTASH_REDIS_REST_TOKEN,
 * });
 *
 * export const ratelimit = new Ratelimit({
 *   redis,
 *   limiter: Ratelimit.slidingWindow(100, '1 m'),
 * });
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter?: number; // Seconds until rate limit resets
}

class InMemoryRateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start cleanup interval (runs every minute)
    if (typeof setInterval !== 'undefined') {
      this.cleanupIntervalId = setInterval(() => this.cleanup(), 60000);
    }
  }

  /**
   * Check and increment rate limit for a key
   */
  async check(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.store.get(key);

    // Check if we need to start a new window
    if (!entry || now - entry.windowStart >= windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: Math.ceil((now + windowMs) / 1000),
      };
    }

    // Increment counter in current window
    entry.count++;
    const remaining = Math.max(0, limit - entry.count);
    const resetAt = entry.windowStart + windowMs;

    if (entry.count > limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: Math.ceil(resetAt / 1000),
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }

    return {
      success: true,
      limit,
      remaining,
      reset: Math.ceil(resetAt / 1000),
    };
  }

  /**
   * Get current count for a key without incrementing
   */
  async get(key: string): Promise<number> {
    const entry = this.store.get(key);
    return entry?.count || 0;
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour max window

    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > maxAge) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval (for testing/shutdown)
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }
}

// Export singleton instance
export const rateLimitStore = new InMemoryRateLimitStore();

// Export type for use in other modules
export type { RateLimitResult };
