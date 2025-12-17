/**
 * Reddit Search Connector for Social Listening
 *
 * Uses Reddit API to search for posts and comments matching keywords.
 * Supports subreddit filtering and sorting by relevance/recency.
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

interface RedditCredentials {
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
  userAgent: string;
}

interface RedditSearchConfig {
  subreddits?: string[];
  includeComments?: boolean;
  sort?: 'relevance' | 'new' | 'hot' | 'top';
  time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}

interface RedditPost {
  kind: string;
  data: {
    id: string;
    name: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    subreddit_name_prefixed: string;
    permalink: string;
    url: string;
    created_utc: number;
    score: number;
    num_comments: number;
    upvote_ratio: number;
    is_self: boolean;
    link_flair_text?: string;
  };
}

interface RedditComment {
  kind: string;
  data: {
    id: string;
    name: string;
    body: string;
    author: string;
    subreddit: string;
    permalink: string;
    created_utc: number;
    score: number;
    link_id: string;
    link_title: string;
    parent_id: string;
  };
}

interface RedditSearchResponse {
  kind: string;
  data: {
    children: (RedditPost | RedditComment)[];
    after: string | null;
    before: string | null;
  };
}

export class RedditSearchConnector extends SocialListeningConnector {
  private credentials: RedditCredentials;
  private searchConfig: RedditSearchConfig;
  private apiBaseUrl = 'https://oauth.reddit.com';
  private authUrl = 'https://www.reddit.com/api/v1/access_token';
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private rateLimitRemaining = 60;
  private rateLimitReset: Date = new Date();

  constructor(config: SocialListeningConfig) {
    super(config);

    this.credentials = {
      clientId: config.credentials.clientId as string,
      clientSecret: config.credentials.clientSecret as string,
      username: config.credentials.username as string | undefined,
      password: config.credentials.password as string | undefined,
      userAgent: (config.credentials.userAgent as string) || 'MarketingPilotAI/1.0',
    };

    this.searchConfig = config.config as RedditSearchConfig;

    if (!this.credentials.clientId || !this.credentials.clientSecret) {
      throw new Error('Reddit client ID and secret are required');
    }
  }

  getPlatform(): 'reddit' {
    return 'reddit';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      return !!this.accessToken;
    } catch (error) {
      console.error('Reddit connection test failed:', error);
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

    if (!config.clientId || typeof config.clientId !== 'string') {
      errors.push('Reddit client ID is required');
    }
    if (!config.clientSecret || typeof config.clientSecret !== 'string') {
      errors.push('Reddit client secret is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async search(query: SearchQuery, cursor?: string): Promise<SearchResult> {
    try {
      await this.ensureAuthenticated();

      const conversations: DiscoveredConversation[] = [];
      let nextCursor: string | undefined;
      let hasMore = false;

      // Search posts
      const postResults = await this.searchPosts(query, cursor);
      conversations.push(...postResults.conversations);
      nextCursor = postResults.nextCursor;
      hasMore = postResults.hasMore;

      // Optionally search comments
      if (this.searchConfig.includeComments) {
        const commentResults = await this.searchComments(query, cursor);
        conversations.push(...commentResults.conversations);
        // Combine cursors (simplified)
        hasMore = hasMore || commentResults.hasMore;
      }

      return {
        conversations,
        nextCursor,
        hasMore,
        rateLimitRemaining: this.rateLimitRemaining,
        rateLimitReset: this.rateLimitReset,
      };
    } catch (error: any) {
      console.error('Reddit search error:', error);
      throw error;
    }
  }

  private async searchPosts(query: SearchQuery, cursor?: string): Promise<SearchResult> {
    const params = new URLSearchParams({
      q: this.buildRedditQuery(query),
      sort: this.searchConfig.sort || 'relevance',
      t: this.searchConfig.time || 'week',
      type: 'link',
      limit: Math.min(query.limit || 100, 100).toString(),
    });

    if (cursor) {
      params.set('after', cursor);
    }

    // If subreddits specified, search within them
    let endpoint = '/search';
    if (this.searchConfig.subreddits && this.searchConfig.subreddits.length > 0) {
      // Search in specific subreddits
      const subredditParam = this.searchConfig.subreddits.join('+');
      endpoint = `/r/${subredditParam}/search`;
      params.set('restrict_sr', 'on');
    }

    const response = await this.makeRequest<RedditSearchResponse>(
      `${endpoint}?${params.toString()}`
    );

    const conversations = response.data.children
      .filter((item): item is RedditPost => item.kind === 't3')
      .map(post => this.postToConversation(post));

    return {
      conversations,
      nextCursor: response.data.after || undefined,
      hasMore: !!response.data.after,
    };
  }

  private async searchComments(query: SearchQuery, cursor?: string): Promise<SearchResult> {
    const params = new URLSearchParams({
      q: this.buildRedditQuery(query),
      sort: this.searchConfig.sort || 'relevance',
      t: this.searchConfig.time || 'week',
      type: 'comment',
      limit: Math.min(query.limit || 50, 100).toString(),
    });

    if (cursor) {
      params.set('after', cursor);
    }

    const response = await this.makeRequest<RedditSearchResponse>(
      `/search?${params.toString()}`
    );

    const conversations = response.data.children
      .filter((item): item is RedditComment => item.kind === 't1')
      .map(comment => this.commentToConversation(comment));

    return {
      conversations,
      nextCursor: response.data.after || undefined,
      hasMore: !!response.data.after,
    };
  }

  async getConversation(externalId: string): Promise<DiscoveredConversation | null> {
    try {
      await this.ensureAuthenticated();

      // Determine if this is a post (t3) or comment (t1)
      const isComment = externalId.startsWith('t1_');
      const id = externalId.replace(/^t[13]_/, '');

      const response = await this.makeRequest<any>(
        `/api/info?id=${isComment ? 't1_' : 't3_'}${id}`
      );

      if (!response.data?.children?.[0]) {
        return null;
      }

      const item = response.data.children[0];

      if (item.kind === 't3') {
        return this.postToConversation(item as RedditPost);
      } else {
        return this.commentToConversation(item as RedditComment);
      }
    } catch (error) {
      console.error('Error fetching Reddit conversation:', error);
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
      score?: number;
      numComments?: number;
    };

    return {
      likes: metrics.score || 0,
      replies: metrics.numComments || 0,
      shares: 0, // Reddit doesn't have direct shares
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
    // Reddit requires user credentials for posting
    if (!this.credentials.username || !this.credentials.password) {
      return {
        success: false,
        error: 'Reddit username and password required for posting replies',
      };
    }

    try {
      await this.ensureAuthenticated();

      const response = await this.makeRequest<any>(
        '/api/comment',
        'POST',
        new URLSearchParams({
          thing_id: params.conversationExternalId,
          text: params.content,
          api_type: 'json',
        }).toString()
      );

      if (response.json?.errors?.length > 0) {
        return {
          success: false,
          error: response.json.errors[0].join(': '),
        };
      }

      const replyData = response.json?.data?.things?.[0]?.data;

      return {
        success: true,
        replyExternalId: replyData?.name,
        replyUrl: replyData?.permalink
          ? `https://reddit.com${replyData.permalink}`
          : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Build Reddit search query from SearchQuery
   */
  private buildRedditQuery(query: SearchQuery): string {
    let searchQuery = query.keywords.join(' OR ');

    // Add negative keywords
    if (query.negativeKeywords && query.negativeKeywords.length > 0) {
      searchQuery += ' ' + query.negativeKeywords.map(k => `-${k}`).join(' ');
    }

    return searchQuery;
  }

  /**
   * Convert Reddit post to DiscoveredConversation
   */
  private postToConversation(post: RedditPost): DiscoveredConversation {
    return {
      platform: 'reddit',
      externalId: post.data.name,
      externalUrl: `https://reddit.com${post.data.permalink}`,
      authorUsername: post.data.author,
      authorProfileUrl: `https://reddit.com/user/${post.data.author}`,
      content: post.data.is_self
        ? `${post.data.title}\n\n${post.data.selftext}`
        : post.data.title,
      platformMetadata: {
        subreddit: post.data.subreddit,
        subredditPrefixed: post.data.subreddit_name_prefixed,
        score: post.data.score,
        numComments: post.data.num_comments,
        upvoteRatio: post.data.upvote_ratio,
        isSelf: post.data.is_self,
        flair: post.data.link_flair_text,
        url: post.data.is_self ? undefined : post.data.url,
        type: 'post',
      },
      publishedAt: new Date(post.data.created_utc * 1000),
      discoveredAt: new Date(),
    };
  }

  /**
   * Convert Reddit comment to DiscoveredConversation
   */
  private commentToConversation(comment: RedditComment): DiscoveredConversation {
    return {
      platform: 'reddit',
      externalId: comment.data.name,
      externalUrl: `https://reddit.com${comment.data.permalink}`,
      authorUsername: comment.data.author,
      authorProfileUrl: `https://reddit.com/user/${comment.data.author}`,
      content: comment.data.body,
      parentContent: comment.data.link_title,
      parentExternalId: comment.data.link_id,
      platformMetadata: {
        subreddit: comment.data.subreddit,
        score: comment.data.score,
        parentId: comment.data.parent_id,
        linkTitle: comment.data.link_title,
        type: 'comment',
      },
      publishedAt: new Date(comment.data.created_utc * 1000),
      discoveredAt: new Date(),
    };
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return;
    }

    const authString = Buffer.from(
      `${this.credentials.clientId}:${this.credentials.clientSecret}`
    ).toString('base64');

    // Use password grant if we have user credentials, otherwise use client_credentials
    const grantType = this.credentials.username && this.credentials.password
      ? 'password'
      : 'client_credentials';

    const params: Record<string, string> = {
      grant_type: grantType,
    };

    if (grantType === 'password') {
      params.username = this.credentials.username!;
      params.password = this.credentials.password!;
    }

    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.credentials.userAgent,
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Reddit authentication failed: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
  }

  /**
   * Make authenticated request to Reddit API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: string
  ): Promise<T> {
    await this.ensureAuthenticated();

    const url = `${this.apiBaseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'User-Agent': this.credentials.userAgent,
      },
    };

    if (body && method === 'POST') {
      options.body = body;
      (options.headers as Record<string, string>)['Content-Type'] =
        'application/x-www-form-urlencoded';
    }

    const response = await fetch(url, options);

    // Update rate limits
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');

    if (remaining) {
      this.rateLimitRemaining = parseFloat(remaining);
    }
    if (reset) {
      this.rateLimitReset = new Date(Date.now() + parseFloat(reset) * 1000);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Reddit API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

/**
 * Factory function to create a RedditSearchConnector instance
 */
export async function createRedditSearchConnector(
  connectorId: string
): Promise<RedditSearchConnector> {
  const supabase = createAdminClient();

  const { data: connector, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .single();

  if (error || !connector) {
    throw new Error(`Reddit connector not found: ${connectorId}`);
  }

  return new RedditSearchConnector({
    id: connector.id,
    organizationId: connector.organization_id,
    type: 'social_listening',
    name: connector.name,
    credentials: connector.credentials as Record<string, unknown>,
    config: connector.config as Record<string, unknown>,
    active: connector.active,
    rateLimit: {
      perHour: connector.rate_limit_per_hour || 60,
      perDay: connector.rate_limit_per_day || 1000,
    },
  });
}
