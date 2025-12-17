/**
 * Twitter/X Social Media Connector
 *
 * Implements social media posting functionality using the Twitter API v2.
 * Supports text posts, media attachments, scheduling, threads, and engagement metrics.
 * Includes rate limiting, error handling, and OAuth 2.0 authentication.
 */

import {
  BaseConnector,
  ConnectorConfig,
  ConnectorResult,
  ConnectorStatus,
  SocialConnector,
} from '../base';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Twitter API v2 Configuration
 */
interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken?: string;
}

interface TwitterConfig {
  maxRetries?: number;
  retryDelay?: number;
  defaultHashtags?: string[];
}

interface TwitterMediaUploadResponse {
  media_id_string: string;
}

interface TwitterPostResponse {
  data: {
    id: string;
    text: string;
  };
}

interface TwitterEngagementMetrics {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  url_link_clicks?: number;
  user_profile_clicks?: number;
}

/**
 * Twitter API Error Response
 */
interface TwitterError {
  title: string;
  detail: string;
  type: string;
  status?: number;
}

export class TwitterConnector extends BaseConnector implements SocialConnector {
  private credentials: TwitterCredentials;
  private connectorConfig: TwitterConfig;
  private apiBaseUrl = 'https://api.twitter.com/2';
  private apiV1BaseUrl = 'https://upload.twitter.com/1.1';
  private maxRetries: number;
  private retryDelay: number;

  // Rate limit tracking
  private rateLimitRemaining: number = 0;
  private rateLimitReset: number = 0;

  constructor(config: ConnectorConfig) {
    super(config);

    // Extract credentials
    this.credentials = {
      apiKey: config.credentials.apiKey as string,
      apiSecret: config.credentials.apiSecret as string,
      accessToken: config.credentials.accessToken as string,
      accessTokenSecret: config.credentials.accessTokenSecret as string,
      bearerToken: config.credentials.bearerToken as string | undefined,
    };

    // Extract connector config
    this.connectorConfig = config.config as TwitterConfig;
    this.maxRetries = this.connectorConfig.maxRetries || 3;
    this.retryDelay = this.connectorConfig.retryDelay || 1000;

    // Validate required credentials
    if (!this.credentials.apiKey || !this.credentials.apiSecret) {
      throw new Error('Twitter API key and secret are required');
    }
    if (!this.credentials.accessToken || !this.credentials.accessTokenSecret) {
      throw new Error('Twitter access token and secret are required');
    }
  }

  /**
   * Test the Twitter API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Verify credentials by getting authenticated user info
      const response = await this.makeRequest<{ data: { id: string; username: string } }>(
        'GET',
        '/users/me'
      );

      return !!response.data?.id;
    } catch (error) {
      console.error('Twitter connection test failed:', error);
      return false;
    }
  }

  /**
   * Get the current status of the connector
   */
  async getStatus(): Promise<ConnectorStatus> {
    if (!this.config.active) {
      return 'inactive';
    }

    try {
      const canConnect = await this.testConnection();
      if (!canConnect) {
        return 'error';
      }

      // Check rate limits
      const stats = await this.getUsageStats('hour');
      if (stats.remaining <= 0) {
        return 'rate_limited';
      }

      // Check Twitter API rate limits
      if (this.rateLimitRemaining === 0 && Date.now() < this.rateLimitReset) {
        return 'rate_limited';
      }

      return 'active';
    } catch (error) {
      console.error('Error checking Twitter status:', error);
      return 'error';
    }
  }

  /**
   * Validate Twitter configuration
   */
  async validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];

    // Validate API credentials
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      errors.push('API key is required');
    }
    if (!config.apiSecret || typeof config.apiSecret !== 'string') {
      errors.push('API secret is required');
    }
    if (!config.accessToken || typeof config.accessToken !== 'string') {
      errors.push('Access token is required');
    }
    if (!config.accessTokenSecret || typeof config.accessTokenSecret !== 'string') {
      errors.push('Access token secret is required');
    }

    // Validate optional bearer token format
    if (config.bearerToken && typeof config.bearerToken !== 'string') {
      errors.push('Invalid bearer token format');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Post to Twitter
   */
  async post(params: {
    content: string;
    media?: string[];
    taskId?: string;
    scheduledTime?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorResult> {
    try {
      // Check if we can execute
      const canExecute = await this.canExecute();
      if (!canExecute) {
        return {
          success: false,
          error: 'Connector is not active or rate limit exceeded',
        };
      }

      // Handle scheduled posts
      if (params.scheduledTime && params.scheduledTime > new Date()) {
        return await this.schedulePost(params);
      }

      // Check if this is a thread (split by newlines or detect multiple tweets)
      const tweets = this.splitIntoTweets(params.content);

      // Upload media if provided
      let mediaIds: string[] = [];
      if (params.media && params.media.length > 0) {
        mediaIds = await this.uploadMedia(params.media);
      }

      // Post tweet(s)
      let postId: string | undefined;
      if (tweets.length === 1) {
        // Single tweet
        postId = await this.postSingleTweet(tweets[0], mediaIds);
      } else {
        // Thread
        postId = await this.postThread(tweets, mediaIds);
      }

      // Record usage
      await this.recordUsage(params.taskId);

      return {
        success: true,
        externalId: postId,
        messageId: postId,
        metadata: {
          platform: 'twitter',
          type: tweets.length > 1 ? 'thread' : 'single',
          tweetCount: tweets.length,
          hasMedia: mediaIds.length > 0,
          postedAt: new Date().toISOString(),
          url: `https://twitter.com/i/web/status/${postId}`,
        },
      };
    } catch (error: any) {
      console.error('Error posting to Twitter:', error);

      // Log error to connector
      await this.recordError(error.message, params.taskId);

      return {
        success: false,
        error: error.message || 'Failed to post to Twitter',
        metadata: {
          errorType: error.name,
          errorDetails: error.response?.data,
        },
      };
    }
  }

  /**
   * Get engagement metrics for a tweet
   */
  async getEngagement(postId: string): Promise<{
    likes: number;
    shares: number;
    comments: number;
    impressions: number;
  }> {
    try {
      // Twitter API v2 endpoint for tweet metrics
      const response = await this.makeRequest<{
        data: {
          id: string;
          public_metrics: {
            retweet_count: number;
            reply_count: number;
            like_count: number;
            quote_count: number;
            impression_count: number;
          };
        };
      }>(
        'GET',
        `/tweets/${postId}?tweet.fields=public_metrics`
      );

      const metrics = response.data?.public_metrics;

      if (!metrics) {
        throw new Error('Unable to fetch engagement metrics');
      }

      return {
        likes: metrics.like_count || 0,
        shares: metrics.retweet_count + metrics.quote_count || 0,
        comments: metrics.reply_count || 0,
        impressions: metrics.impression_count || 0,
      };
    } catch (error) {
      console.error('Error fetching Twitter engagement:', error);
      throw error;
    }
  }

  /**
   * Post a single tweet
   */
  private async postSingleTweet(text: string, mediaIds?: string[]): Promise<string> {
    const payload: any = { text };

    if (mediaIds && mediaIds.length > 0) {
      payload.media = {
        media_ids: mediaIds,
      };
    }

    const response = await this.makeRequest<TwitterPostResponse>(
      'POST',
      '/tweets',
      payload
    );

    if (!response.data?.id) {
      throw new Error('Failed to create tweet');
    }

    return response.data.id;
  }

  /**
   * Post a thread (multiple connected tweets)
   */
  private async postThread(tweets: string[], mediaIds?: string[]): Promise<string> {
    let previousTweetId: string | undefined;
    let firstTweetId: string | undefined;

    for (let i = 0; i < tweets.length; i++) {
      const payload: any = { text: tweets[i] };

      // Add media to first tweet only
      if (i === 0 && mediaIds && mediaIds.length > 0) {
        payload.media = {
          media_ids: mediaIds,
        };
      }

      // Reply to previous tweet to create thread
      if (previousTweetId) {
        payload.reply = {
          in_reply_to_tweet_id: previousTweetId,
        };
      }

      const response = await this.makeRequest<TwitterPostResponse>(
        'POST',
        '/tweets',
        payload
      );

      if (!response.data?.id) {
        throw new Error(`Failed to create tweet ${i + 1} in thread`);
      }

      previousTweetId = response.data.id;

      if (i === 0) {
        firstTweetId = response.data.id;
      }

      // Small delay between thread posts to avoid rate limiting
      if (i < tweets.length - 1) {
        await this.delay(500);
      }
    }

    return firstTweetId!;
  }

  /**
   * Upload media to Twitter
   */
  private async uploadMedia(mediaUrls: string[]): Promise<string[]> {
    const mediaIds: string[] = [];

    for (const url of mediaUrls) {
      try {
        // Download media from URL
        const mediaBuffer = await this.downloadMedia(url);

        // Upload to Twitter
        const mediaId = await this.uploadMediaToTwitter(mediaBuffer);
        mediaIds.push(mediaId);
      } catch (error) {
        console.error(`Error uploading media ${url}:`, error);
        throw error;
      }
    }

    return mediaIds;
  }

  /**
   * Download media from URL
   */
  private async downloadMedia(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Upload media to Twitter API
   */
  private async uploadMediaToTwitter(mediaBuffer: Buffer): Promise<string> {
    // Twitter media upload uses a different endpoint and OAuth 1.0a
    // This is a simplified version - production code should use chunked upload for large files
    const formData = new FormData();
    formData.append('media', new Blob([new Uint8Array(mediaBuffer)]));

    const response = await fetch(`${this.apiV1BaseUrl}/media/upload.json`, {
      method: 'POST',
      headers: this.getOAuth1Headers('POST', `${this.apiV1BaseUrl}/media/upload.json`),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload media: ${response.statusText}`);
    }

    const data = await response.json() as TwitterMediaUploadResponse;
    return data.media_id_string;
  }

  /**
   * Schedule a post for later
   */
  private async schedulePost(params: {
    content: string;
    media?: string[];
    taskId?: string;
    scheduledTime?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorResult> {
    try {
      const supabase = createAdminClient();

      // Store scheduled post in database
      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({
          connector_id: this.config.id,
          organization_id: this.config.organizationId,
          task_id: params.taskId,
          platform: 'twitter',
          content: params.content,
          media_urls: params.media,
          scheduled_time: params.scheduledTime?.toISOString(),
          metadata: params.metadata,
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to schedule post: ${error?.message}`);
      }

      return {
        success: true,
        externalId: data.id,
        messageId: data.id,
        metadata: {
          scheduled: true,
          scheduledTime: params.scheduledTime?.toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error scheduling Twitter post:', error);
      throw error;
    }
  }

  /**
   * Split content into tweet-sized chunks (respecting 280 char limit)
   */
  private splitIntoTweets(content: string): string[] {
    const maxLength = 280;
    const tweets: string[] = [];

    // First, try splitting by explicit separators (double newline or ----)
    const explicitSplits = content.split(/\n{2,}|----+/);

    for (const section of explicitSplits) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      if (trimmed.length <= maxLength) {
        tweets.push(trimmed);
      } else {
        // Need to split further
        const words = trimmed.split(' ');
        let currentTweet = '';

        for (const word of words) {
          if ((currentTweet + ' ' + word).trim().length <= maxLength) {
            currentTweet = (currentTweet + ' ' + word).trim();
          } else {
            if (currentTweet) {
              tweets.push(currentTweet);
            }
            currentTweet = word;
          }
        }

        if (currentTweet) {
          tweets.push(currentTweet);
        }
      }
    }

    return tweets.length > 0 ? tweets : [content.substring(0, maxLength)];
  }

  /**
   * Make authenticated request to Twitter API v2
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    retryCount: number = 0
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${endpoint}`;

    try {
      const headers = this.getOAuth1Headers(method, url, body);

      const options: RequestInit = {
        method,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      };

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      // Update rate limit info from headers
      this.updateRateLimitInfo(response.headers);

      if (!response.ok) {
        const errorData = await response.json() as { errors?: TwitterError[] };
        const errorMessage = errorData.errors?.[0]?.detail || response.statusText;

        // Handle rate limiting with retry
        if (response.status === 429 && retryCount < this.maxRetries) {
          const resetTime = this.rateLimitReset;
          const waitTime = Math.max(resetTime - Date.now(), this.retryDelay);

          console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
          await this.delay(waitTime);

          return this.makeRequest<T>(method, endpoint, body, retryCount + 1);
        }

        throw new Error(`Twitter API error: ${errorMessage}`);
      }

      return await response.json() as T;
    } catch (error: any) {
      // Retry on network errors
      if (retryCount < this.maxRetries && error.message.includes('fetch')) {
        console.log(`Network error. Retrying in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return this.makeRequest<T>(method, endpoint, body, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Generate OAuth 1.0a headers for Twitter API
   */
  private getOAuth1Headers(method: string, url: string, params?: any): Record<string, string> {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.credentials.apiKey,
      oauth_token: this.credentials.accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: this.generateNonce(),
      oauth_version: '1.0',
    };

    // Generate signature
    const signature = this.generateOAuthSignature(method, url, oauthParams, params);
    oauthParams.oauth_signature = signature;

    // Build Authorization header
    const authHeader = 'OAuth ' + Object.entries(oauthParams)
      .map(([key, value]) => `${this.percentEncode(key)}="${this.percentEncode(value)}"`)
      .join(', ');

    return {
      Authorization: authHeader,
    };
  }

  /**
   * Generate OAuth 1.0a signature
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    oauthParams: Record<string, string>,
    requestParams?: any
  ): string {
    // Combine all parameters
    const allParams = { ...oauthParams };
    if (requestParams) {
      Object.assign(allParams, requestParams);
    }

    // Sort parameters
    const sortedParams = Object.keys(allParams)
      .sort()
      .map(key => `${this.percentEncode(key)}=${this.percentEncode(allParams[key])}`)
      .join('&');

    // Create signature base string
    const signatureBase = [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(sortedParams),
    ].join('&');

    // Create signing key
    const signingKey = [
      this.percentEncode(this.credentials.apiSecret),
      this.percentEncode(this.credentials.accessTokenSecret),
    ].join('&');

    // Generate HMAC-SHA1 signature
    return this.hmacSha1(signatureBase, signingKey);
  }

  /**
   * HMAC-SHA1 implementation
   */
  private hmacSha1(data: string, key: string): string {
    // Note: In production, use a crypto library like 'crypto' (Node.js) or 'subtle crypto' (browser)
    // This is a placeholder implementation
    const crypto = require('crypto');
    return crypto
      .createHmac('sha1', key)
      .update(data)
      .digest('base64');
  }

  /**
   * Generate random nonce
   */
  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Percent encode (RFC 3986)
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
  }

  /**
   * Update rate limit info from response headers
   */
  private updateRateLimitInfo(headers: Headers): void {
    const remaining = headers.get('x-rate-limit-remaining');
    const reset = headers.get('x-rate-limit-reset');

    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }

    if (reset) {
      this.rateLimitReset = parseInt(reset, 10) * 1000; // Convert to milliseconds
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get usage statistics for rate limiting
   */
  async getUsageStats(timeWindow: 'hour' | 'day'): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    try {
      const supabase = createAdminClient();

      // Calculate time window
      const now = new Date();
      const windowStart = new Date(
        timeWindow === 'hour'
          ? now.getTime() - 60 * 60 * 1000
          : now.getTime() - 24 * 60 * 60 * 1000
      ).toISOString();

      // Query usage from social_posts table
      const { count } = await supabase
        .from('social_posts')
        .select('*', { count: 'exact', head: true })
        .eq('connector_id', this.config.id)
        .gte('created_at', windowStart);

      const used = count || 0;
      const limit = timeWindow === 'hour'
        ? (this.config.rateLimit?.perHour || 50) // Twitter default: 50 tweets per hour
        : (this.config.rateLimit?.perDay || 500); // Twitter default: 500 tweets per day

      return {
        used,
        limit,
        remaining: Math.max(0, limit - used),
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return {
        used: 0,
        limit: Infinity,
        remaining: Infinity,
      };
    }
  }

  /**
   * Record usage in the database
   */
  private async recordUsage(taskId?: string): Promise<void> {
    try {
      const supabase = createAdminClient();

      // Update connector last_used_at
      await supabase
        .from('connectors')
        .update({
          last_used_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', this.config.id);
    } catch (error) {
      console.error('Error recording usage:', error);
    }
  }

  /**
   * Record error in the database
   */
  private async recordError(error: string, taskId?: string): Promise<void> {
    try {
      const supabase = createAdminClient();

      // Update connector with last error
      await supabase
        .from('connectors')
        .update({
          last_error: error,
        })
        .eq('id', this.config.id);
    } catch (err) {
      console.error('Error recording error:', err);
    }
  }
}

/**
 * Factory function to create a TwitterConnector instance
 */
export async function createTwitterConnector(
  connectorId: string
): Promise<TwitterConnector> {
  const supabase = createAdminClient();

  const { data: connector, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .eq('type', 'social')
    .single();

  if (error || !connector) {
    throw new Error(`Twitter connector not found: ${connectorId}`);
  }

  // Validate that this is a Twitter connector
  const platform = (connector.config as any)?.platform;
  if (platform && platform !== 'twitter') {
    throw new Error(`Connector ${connectorId} is not a Twitter connector`);
  }

  return new TwitterConnector({
    id: connector.id,
    organizationId: connector.organization_id,
    type: 'social',
    name: connector.name,
    credentials: connector.credentials as Record<string, unknown>,
    config: connector.config as Record<string, unknown>,
    active: connector.active,
    rateLimit: {
      perHour: connector.rate_limit_per_hour || 50, // Twitter default
      perDay: connector.rate_limit_per_day || 500,  // Twitter default
    },
  });
}
