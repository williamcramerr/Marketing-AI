/**
 * Twitter Search Connector for Social Listening
 *
 * Uses Twitter API v2 to search for recent tweets matching keywords.
 * Supports advanced query operators for precise targeting.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { ConnectorStatus } from '../base';
import {
  SocialListeningConnector,
  SocialListeningConfig,
  SearchQuery,
  SearchResult,
  DiscoveredConversation,
} from './base';

interface TwitterCredentials {
  bearerToken: string;
  // OAuth credentials for replying
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
}

interface TwitterSearchConfig {
  includeRetweets?: boolean;
  minFollowers?: number;
  maxRetries?: number;
  language?: string;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
  profile_image_url?: string;
}

interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{
    type: 'replied_to' | 'quoted' | 'retweeted';
    id: string;
  }>;
}

interface TwitterSearchResponse {
  data?: TwitterTweet[];
  includes?: {
    users?: TwitterUser[];
    tweets?: TwitterTweet[];
  };
  meta?: {
    newest_id: string;
    oldest_id: string;
    result_count: number;
    next_token?: string;
  };
}

export class TwitterSearchConnector extends SocialListeningConnector {
  private credentials: TwitterCredentials;
  private searchConfig: TwitterSearchConfig;
  private apiBaseUrl = 'https://api.twitter.com/2';
  private rateLimitRemaining = 450; // Twitter default for app-only auth
  private rateLimitReset: Date = new Date();

  constructor(config: SocialListeningConfig) {
    super(config);

    this.credentials = {
      bearerToken: config.credentials.bearerToken as string,
      apiKey: config.credentials.apiKey as string | undefined,
      apiSecret: config.credentials.apiSecret as string | undefined,
      accessToken: config.credentials.accessToken as string | undefined,
      accessTokenSecret: config.credentials.accessTokenSecret as string | undefined,
    };

    this.searchConfig = config.config as TwitterSearchConfig;

    if (!this.credentials.bearerToken) {
      throw new Error('Twitter bearer token is required for search');
    }
  }

  getPlatform(): 'twitter' {
    return 'twitter';
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple search
      const response = await this.makeRequest<TwitterSearchResponse>(
        `/tweets/search/recent?query=test&max_results=10`
      );
      return !!response;
    } catch (error) {
      console.error('Twitter search connection test failed:', error);
      return false;
    }
  }

  async getStatus(): Promise<ConnectorStatus> {
    if (!this.config.active) {
      return 'inactive';
    }

    if (this.rateLimitRemaining <= 0 && new Date() < this.rateLimitReset) {
      return 'rate_limited';
    }

    try {
      const canConnect = await this.testConnection();
      return canConnect ? 'active' : 'error';
    } catch {
      return 'error';
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];

    if (!config.bearerToken || typeof config.bearerToken !== 'string') {
      errors.push('Bearer token is required for Twitter search');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async search(query: SearchQuery, cursor?: string): Promise<SearchResult> {
    try {
      // Build Twitter search query
      const twitterQuery = this.buildTwitterQuery(query);
      const limit = Math.min(query.limit || 100, 100);

      // Build URL with parameters
      const params = new URLSearchParams({
        query: twitterQuery,
        max_results: limit.toString(),
        'tweet.fields': 'author_id,created_at,public_metrics,conversation_id,referenced_tweets,in_reply_to_user_id',
        'user.fields': 'name,username,public_metrics,profile_image_url',
        expansions: 'author_id,referenced_tweets.id,in_reply_to_user_id',
      });

      if (cursor) {
        params.set('next_token', cursor);
      }

      if (query.since) {
        params.set('start_time', query.since.toISOString());
      }

      if (query.until) {
        params.set('end_time', query.until.toISOString());
      }

      const response = await this.makeRequest<TwitterSearchResponse>(
        `/tweets/search/recent?${params.toString()}`
      );

      // Parse response
      const conversations = this.parseSearchResponse(response);

      return {
        conversations,
        nextCursor: response.meta?.next_token,
        hasMore: !!response.meta?.next_token,
        rateLimitRemaining: this.rateLimitRemaining,
        rateLimitReset: this.rateLimitReset,
      };
    } catch (error: any) {
      console.error('Twitter search error:', error);
      throw error;
    }
  }

  async getConversation(externalId: string): Promise<DiscoveredConversation | null> {
    try {
      const params = new URLSearchParams({
        'tweet.fields': 'author_id,created_at,public_metrics,conversation_id,referenced_tweets',
        'user.fields': 'name,username,public_metrics,profile_image_url',
        expansions: 'author_id,referenced_tweets.id',
      });

      const response = await this.makeRequest<{
        data?: TwitterTweet;
        includes?: { users?: TwitterUser[]; tweets?: TwitterTweet[] };
      }>(`/tweets/${externalId}?${params.toString()}`);

      if (!response.data) {
        return null;
      }

      const author = response.includes?.users?.find(
        u => u.id === response.data!.author_id
      );

      return {
        platform: 'twitter',
        externalId: response.data.id,
        externalUrl: `https://twitter.com/i/web/status/${response.data.id}`,
        authorUsername: author?.username || 'unknown',
        authorDisplayName: author?.name,
        authorProfileUrl: author ? `https://twitter.com/${author.username}` : undefined,
        authorFollowers: author?.public_metrics?.followers_count,
        content: response.data.text,
        parentContent: this.getParentContent(response.data, response.includes?.tweets),
        parentExternalId: this.getParentId(response.data),
        platformMetadata: {
          retweetCount: response.data.public_metrics?.retweet_count,
          likeCount: response.data.public_metrics?.like_count,
          replyCount: response.data.public_metrics?.reply_count,
          quoteCount: response.data.public_metrics?.quote_count,
          conversationId: response.data.conversation_id,
        },
        publishedAt: new Date(response.data.created_at),
        discoveredAt: new Date(),
      };
    } catch (error) {
      console.error('Error fetching Twitter conversation:', error);
      return null;
    }
  }

  async getEngagement(externalId: string): Promise<{
    likes: number;
    replies: number;
    shares: number;
    impressions?: number;
  }> {
    const conversation = await this.getConversation(externalId);

    if (!conversation) {
      return { likes: 0, replies: 0, shares: 0 };
    }

    const metrics = conversation.platformMetadata as {
      retweetCount?: number;
      likeCount?: number;
      replyCount?: number;
      quoteCount?: number;
    };

    return {
      likes: metrics.likeCount || 0,
      replies: metrics.replyCount || 0,
      shares: (metrics.retweetCount || 0) + (metrics.quoteCount || 0),
    };
  }

  async postReply(params: {
    conversationExternalId: string;
    content: string;
  }): Promise<{
    success: boolean;
    replyExternalId?: string;
    replyUrl?: string;
    error?: string;
  }> {
    // Check if we have OAuth credentials for posting
    if (!this.credentials.accessToken || !this.credentials.accessTokenSecret) {
      return {
        success: false,
        error: 'OAuth credentials required for posting replies',
      };
    }

    try {
      // This would use OAuth 1.0a authentication similar to the TwitterConnector
      // For now, return error indicating this requires full OAuth
      return {
        success: false,
        error: 'Reply posting requires OAuth 1.0a - use main Twitter connector',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Build Twitter search query from SearchQuery
   */
  private buildTwitterQuery(query: SearchQuery): string {
    const parts: string[] = [];

    // Add keywords
    if (query.keywords.length === 1) {
      parts.push(query.keywords[0]);
    } else if (query.keywords.length > 1) {
      parts.push(`(${query.keywords.join(' OR ')})`);
    }

    // Add negative keywords
    if (query.negativeKeywords && query.negativeKeywords.length > 0) {
      for (const neg of query.negativeKeywords) {
        parts.push(`-${neg}`);
      }
    }

    // Exclude retweets by default unless configured otherwise
    if (!this.searchConfig.includeRetweets) {
      parts.push('-is:retweet');
    }

    // Language filter
    const lang = query.language || this.searchConfig.language;
    if (lang) {
      parts.push(`lang:${lang}`);
    }

    // Minimum followers filter (using Twitter's has: operators)
    if (this.searchConfig.minFollowers) {
      parts.push('has:mentions'); // Proxy for engagement - better filter
    }

    return parts.join(' ');
  }

  /**
   * Parse Twitter search response into DiscoveredConversation array
   */
  private parseSearchResponse(response: TwitterSearchResponse): DiscoveredConversation[] {
    if (!response.data) {
      return [];
    }

    const usersMap = new Map<string, TwitterUser>();
    const tweetsMap = new Map<string, TwitterTweet>();

    // Index users
    response.includes?.users?.forEach(user => {
      usersMap.set(user.id, user);
    });

    // Index referenced tweets
    response.includes?.tweets?.forEach(tweet => {
      tweetsMap.set(tweet.id, tweet);
    });

    return response.data.map(tweet => {
      const author = usersMap.get(tweet.author_id);

      return {
        platform: 'twitter' as const,
        externalId: tweet.id,
        externalUrl: `https://twitter.com/${author?.username || 'i'}/status/${tweet.id}`,
        authorUsername: author?.username || 'unknown',
        authorDisplayName: author?.name,
        authorProfileUrl: author ? `https://twitter.com/${author.username}` : undefined,
        authorFollowers: author?.public_metrics?.followers_count,
        content: tweet.text,
        parentContent: this.getParentContent(tweet, response.includes?.tweets),
        parentExternalId: this.getParentId(tweet),
        platformMetadata: {
          retweetCount: tweet.public_metrics?.retweet_count || 0,
          likeCount: tweet.public_metrics?.like_count || 0,
          replyCount: tweet.public_metrics?.reply_count || 0,
          quoteCount: tweet.public_metrics?.quote_count || 0,
          conversationId: tweet.conversation_id,
          isReply: !!tweet.in_reply_to_user_id,
        },
        publishedAt: new Date(tweet.created_at),
        discoveredAt: new Date(),
      };
    });
  }

  private getParentContent(tweet: TwitterTweet, includedTweets?: TwitterTweet[]): string | undefined {
    const repliedTo = tweet.referenced_tweets?.find(ref => ref.type === 'replied_to');
    if (!repliedTo || !includedTweets) return undefined;

    const parentTweet = includedTweets.find(t => t.id === repliedTo.id);
    return parentTweet?.text;
  }

  private getParentId(tweet: TwitterTweet): string | undefined {
    const repliedTo = tweet.referenced_tweets?.find(ref => ref.type === 'replied_to');
    return repliedTo?.id;
  }

  /**
   * Make authenticated request to Twitter API
   */
  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.apiBaseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.credentials.bearerToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Update rate limits
    const remaining = response.headers.get('x-rate-limit-remaining');
    const reset = response.headers.get('x-rate-limit-reset');

    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitReset = new Date(parseInt(reset, 10) * 1000);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Twitter API error: ${error.detail || error.title || response.statusText}`
      );
    }

    return response.json();
  }
}

/**
 * Factory function to create a TwitterSearchConnector instance
 */
export async function createTwitterSearchConnector(
  connectorId: string
): Promise<TwitterSearchConnector> {
  const supabase = createAdminClient();

  const { data: connector, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .single();

  if (error || !connector) {
    throw new Error(`Twitter search connector not found: ${connectorId}`);
  }

  return new TwitterSearchConnector({
    id: connector.id,
    organizationId: connector.organization_id,
    type: 'social_listening',
    name: connector.name,
    credentials: connector.credentials as Record<string, unknown>,
    config: connector.config as Record<string, unknown>,
    active: connector.active,
    rateLimit: {
      perHour: connector.rate_limit_per_hour || 450,
      perDay: connector.rate_limit_per_day || 2000,
    },
  });
}
