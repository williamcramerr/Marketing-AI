/**
 * LinkedIn Social Media Connector
 *
 * Implements social media posting functionality using the LinkedIn Marketing API.
 * Supports text posts, image attachments, article sharing, and company page posts.
 * Includes OAuth 2.0 authentication, rate limiting, and comprehensive error handling.
 */

import {
  BaseConnector,
  ConnectorConfig,
  ConnectorResult,
  ConnectorStatus,
  SocialConnector,
} from '../base';
import { createAdminClient } from '@/lib/supabase/admin';

interface LinkedInCredentials {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  expiresAt?: string;
}

interface LinkedInConfig {
  organizationId?: string; // LinkedIn organization/company page ID
  defaultVisibility?: 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN';
}

interface LinkedInPostResponse {
  id: string;
  activity: string;
}

interface LinkedInEngagementMetrics {
  likes: number;
  shares: number;
  comments: number;
  impressions: number;
}

/**
 * LinkedIn connector implementing social media posting via LinkedIn Marketing API
 */
export class LinkedInConnector extends BaseConnector implements SocialConnector {
  private credentials: LinkedInCredentials;
  private linkedInConfig: LinkedInConfig;
  private apiBaseUrl = 'https://api.linkedin.com/v2';
  private apiVersion = '202401'; // LinkedIn API version

  constructor(config: ConnectorConfig) {
    super(config);

    // Extract and validate credentials
    this.credentials = config.credentials as LinkedInCredentials;
    if (!this.credentials.accessToken) {
      throw new Error('LinkedIn access token is required');
    }

    // Extract LinkedIn-specific configuration
    this.linkedInConfig = config.config as LinkedInConfig;
  }

  /**
   * Test the LinkedIn API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test connection by fetching user profile
      const response = await this.makeApiRequest('/userinfo', 'GET');
      return response.ok;
    } catch (error) {
      console.error('LinkedIn connection test failed:', error);
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
      // Check if token is expired
      if (this.isTokenExpired()) {
        return 'error';
      }

      // Test connection
      const canConnect = await this.testConnection();
      if (!canConnect) {
        return 'error';
      }

      // Check rate limits
      const stats = await this.getUsageStats('hour');
      if (stats.remaining <= 0) {
        return 'rate_limited';
      }

      return 'active';
    } catch (error) {
      console.error('Error checking LinkedIn status:', error);
      return 'error';
    }
  }

  /**
   * Validate LinkedIn configuration
   */
  async validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];

    // Validate access token
    const accessToken = config.accessToken as string;
    if (!accessToken) {
      errors.push('Access token is required');
    } else if (accessToken.length < 20) {
      errors.push('Access token appears to be invalid (too short)');
    }

    // Validate organization ID if provided
    const organizationId = config.organizationId as string;
    if (organizationId && !organizationId.match(/^\d+$/)) {
      errors.push('Organization ID must be numeric');
    }

    // Validate visibility setting
    const visibility = config.defaultVisibility as string;
    if (visibility && !['PUBLIC', 'CONNECTIONS', 'LOGGED_IN'].includes(visibility)) {
      errors.push('Invalid visibility setting. Must be PUBLIC, CONNECTIONS, or LOGGED_IN');
    }

    // Validate client credentials for OAuth refresh (if provided)
    const clientId = config.clientId as string;
    const clientSecret = config.clientSecret as string;
    if ((clientId && !clientSecret) || (!clientId && clientSecret)) {
      errors.push('Both client ID and client secret are required for token refresh');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Post content to LinkedIn
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

      // Check for token expiration and refresh if needed
      if (this.isTokenExpired()) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          return {
            success: false,
            error: 'Access token expired and could not be refreshed',
          };
        }
      }

      // LinkedIn doesn't support scheduled posts via API - must be done through UI
      if (params.scheduledTime) {
        console.warn('LinkedIn API does not support scheduled posts. Post will be published immediately.');
      }

      // Determine if this is a user post or organization post
      const isOrgPost = !!this.linkedInConfig.organizationId;
      const postType = params.metadata?.postType as string || 'TEXT';

      let result: LinkedInPostResponse;

      // Handle different post types
      if (params.media && params.media.length > 0) {
        // Post with images
        result = await this.postWithMedia(params.content, params.media, isOrgPost);
      } else if (postType === 'ARTICLE' && params.metadata?.articleUrl) {
        // Share article/link
        result = await this.shareArticle(
          params.content,
          params.metadata.articleUrl as string,
          isOrgPost
        );
      } else {
        // Text-only post
        result = await this.postText(params.content, isOrgPost);
      }

      // Record usage
      await this.recordUsage(params.taskId);

      return {
        success: true,
        messageId: result.id,
        externalId: result.activity || result.id,
        metadata: {
          content: params.content.substring(0, 100), // First 100 chars
          postedAt: new Date().toISOString(),
          postUrl: `https://www.linkedin.com/feed/update/${result.activity || result.id}`,
          isOrganization: isOrgPost,
        },
      };
    } catch (error: any) {
      console.error('Error posting to LinkedIn:', error);

      // Log error to connector
      await this.recordError(error.message, params.taskId);

      return {
        success: false,
        error: error.message || 'Failed to post to LinkedIn',
        metadata: {
          errorCode: error.statusCode || error.status,
          errorType: error.name,
          errorDetails: error.response?.data,
        },
      };
    }
  }

  /**
   * Get engagement metrics for a LinkedIn post
   */
  async getEngagement(postId: string): Promise<LinkedInEngagementMetrics> {
    try {
      // LinkedIn uses URN format for posts
      const urn = postId.startsWith('urn:') ? postId : `urn:li:share:${postId}`;

      // Fetch engagement statistics
      const response = await this.makeApiRequest(
        `/socialActions/${encodeURIComponent(urn)}`,
        'GET'
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch engagement: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract engagement metrics
      return {
        likes: data.likesSummary?.totalLikes || 0,
        shares: data.sharesSummary?.totalShares || 0,
        comments: data.commentsSummary?.totalComments || 0,
        impressions: data.impressionCount || 0,
      };
    } catch (error) {
      console.error('Error fetching LinkedIn engagement:', error);
      return {
        likes: 0,
        shares: 0,
        comments: 0,
        impressions: 0,
      };
    }
  }

  /**
   * Post text-only content to LinkedIn
   */
  private async postText(content: string, isOrgPost: boolean): Promise<LinkedInPostResponse> {
    const author = this.getAuthorUrn(isOrgPost);
    const visibility = this.linkedInConfig.defaultVisibility || 'PUBLIC';

    const payload = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': visibility,
      },
    };

    const response = await this.makeApiRequest('/ugcPosts', 'POST', payload);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `LinkedIn API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    return await response.json();
  }

  /**
   * Post content with media (images) to LinkedIn
   */
  private async postWithMedia(
    content: string,
    mediaUrls: string[],
    isOrgPost: boolean
  ): Promise<LinkedInPostResponse> {
    const author = this.getAuthorUrn(isOrgPost);
    const visibility = this.linkedInConfig.defaultVisibility || 'PUBLIC';

    // LinkedIn requires images to be uploaded first and returns asset URNs
    const mediaAssets = await Promise.all(
      mediaUrls.map(url => this.uploadMediaAsset(url, author))
    );

    const payload = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: 'IMAGE',
          media: mediaAssets.map(asset => ({
            status: 'READY',
            media: asset.asset,
            title: {
              text: 'Image',
            },
          })),
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': visibility,
      },
    };

    const response = await this.makeApiRequest('/ugcPosts', 'POST', payload);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `LinkedIn API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    return await response.json();
  }

  /**
   * Share an article/link on LinkedIn
   */
  private async shareArticle(
    commentary: string,
    articleUrl: string,
    isOrgPost: boolean
  ): Promise<LinkedInPostResponse> {
    const author = this.getAuthorUrn(isOrgPost);
    const visibility = this.linkedInConfig.defaultVisibility || 'PUBLIC';

    const payload = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: commentary,
          },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              originalUrl: articleUrl,
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': visibility,
      },
    };

    const response = await this.makeApiRequest('/ugcPosts', 'POST', payload);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `LinkedIn API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    return await response.json();
  }

  /**
   * Upload media asset to LinkedIn
   */
  private async uploadMediaAsset(
    mediaUrl: string,
    author: string
  ): Promise<{ asset: string; uploadUrl: string }> {
    // Step 1: Register upload
    const registerPayload = {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: author,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    };

    const registerResponse = await this.makeApiRequest(
      '/assets?action=registerUpload',
      'POST',
      registerPayload
    );

    if (!registerResponse.ok) {
      throw new Error(`Failed to register media upload: ${registerResponse.statusText}`);
    }

    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const asset = registerData.value.asset;

    // Step 2: Upload binary data
    // Fetch the media from the provided URL
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      throw new Error(`Failed to fetch media from ${mediaUrl}`);
    }
    const mediaBuffer = await mediaResponse.arrayBuffer();

    // Upload to LinkedIn
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
      },
      body: mediaBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload media: ${uploadResponse.statusText}`);
    }

    return { asset, uploadUrl };
  }

  /**
   * Get author URN (user or organization)
   */
  private getAuthorUrn(isOrgPost: boolean): string {
    if (isOrgPost && this.linkedInConfig.organizationId) {
      return `urn:li:organization:${this.linkedInConfig.organizationId}`;
    }
    // For personal posts, we need to fetch the user ID
    // This should be stored during OAuth flow
    const userId = this.credentials.clientId || 'me';
    return `urn:li:person:${userId}`;
  }

  /**
   * Make authenticated API request to LinkedIn
   */
  private async makeApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiBaseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.credentials.accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': this.apiVersion,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return response;
  }

  /**
   * Check if access token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.credentials.expiresAt) {
      return false; // No expiration set, assume valid
    }

    const expiryTime = new Date(this.credentials.expiresAt).getTime();
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    return now >= (expiryTime - bufferTime);
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    try {
      if (!this.credentials.refreshToken || !this.credentials.clientId || !this.credentials.clientSecret) {
        console.warn('Cannot refresh token: missing refresh token or client credentials');
        return false;
      }

      const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (!response.ok) {
        console.error('Token refresh failed:', response.statusText);
        return false;
      }

      const data = await response.json();

      // Update credentials
      this.credentials.accessToken = data.access_token;
      if (data.refresh_token) {
        this.credentials.refreshToken = data.refresh_token;
      }
      if (data.expires_in) {
        const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
        this.credentials.expiresAt = expiresAt;
      }

      // Update in database
      await this.updateCredentials();

      return true;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return false;
    }
  }

  /**
   * Update credentials in database
   */
  private async updateCredentials(): Promise<void> {
    try {
      const supabase = createAdminClient();

      await supabase
        .from('connectors')
        .update({
          credentials: this.credentials,
        })
        .eq('id', this.config.id);
    } catch (error) {
      console.error('Error updating credentials:', error);
    }
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

      // Query usage from social_metrics table (or similar)
      const { count } = await supabase
        .from('social_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('connector_id', this.config.id)
        .gte('created_at', windowStart);

      const used = count || 0;

      // LinkedIn rate limits:
      // - Free: 100 posts per day
      // - Marketing API: 500 requests per 15 minutes per user
      const limit = timeWindow === 'hour'
        ? (this.config.rateLimit?.perHour || 100)
        : (this.config.rateLimit?.perDay || 500);

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

      // Optionally record in social_metrics table
      await supabase.from('social_metrics').insert({
        connector_id: this.config.id,
        task_id: taskId,
        created_at: new Date().toISOString(),
        platform: 'linkedin',
      });
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
 * Factory function to create a LinkedInConnector instance
 */
export async function createLinkedInConnector(
  connectorId: string
): Promise<LinkedInConnector> {
  const supabase = createAdminClient();

  const { data: connector, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .eq('type', 'social')
    .single();

  if (error || !connector) {
    throw new Error(`Connector not found: ${connectorId}`);
  }

  // Validate that this is a LinkedIn connector
  const connectorName = connector.name?.toLowerCase();
  if (!connectorName?.includes('linkedin')) {
    throw new Error(`Connector ${connectorId} is not a LinkedIn connector`);
  }

  return new LinkedInConnector({
    id: connector.id,
    organizationId: connector.organization_id,
    type: 'social',
    name: connector.name,
    credentials: connector.credentials as Record<string, unknown>,
    config: connector.config as Record<string, unknown>,
    active: connector.active,
    rateLimit: {
      perHour: connector.rate_limit_per_hour || undefined,
      perDay: connector.rate_limit_per_day || undefined,
    },
  });
}
