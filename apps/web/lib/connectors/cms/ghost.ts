/**
 * Ghost CMS Connector
 *
 * Implements CMS publishing functionality using the Ghost Admin API.
 * Includes post creation, updates, scheduling, and comprehensive error handling.
 */

import jwt from 'jsonwebtoken';
import {
  BaseConnector,
  ConnectorConfig,
  ConnectorResult,
  ConnectorStatus,
  CMSConnector,
} from '../base';
import { createAdminClient } from '@/lib/supabase/admin';

interface GhostPost {
  id?: string;
  title: string;
  html?: string;
  mobiledoc?: string;
  lexical?: string;
  status?: 'draft' | 'published' | 'scheduled';
  slug?: string;
  feature_image?: string;
  featured?: boolean;
  tags?: Array<{ name: string }>;
  custom_excerpt?: string;
  published_at?: string;
  updated_at?: string;
  authors?: string[];
  meta_title?: string;
  meta_description?: string;
}

interface GhostCredentials {
  adminApiKey: string; // Format: "id:secret"
  apiUrl: string; // e.g., "https://yourblog.ghost.io"
}

interface GhostConfig {
  defaultAuthor?: string;
  defaultFeatured?: boolean;
  defaultStatus?: 'draft' | 'published';
}

interface GhostApiResponse {
  posts?: GhostPost[];
  meta?: any;
  errors?: Array<{
    message: string;
    type: string;
    context?: string;
  }>;
}

export class GhostConnector extends BaseConnector implements CMSConnector {
  private adminApiKey: string;
  private apiUrl: string;
  private defaultAuthor?: string;
  private defaultFeatured: boolean;
  private defaultStatus: 'draft' | 'published';

  constructor(config: ConnectorConfig) {
    super(config);

    const credentials = config.credentials as unknown as GhostCredentials;
    const ghostConfig = config.config as unknown as GhostConfig;

    if (!credentials.adminApiKey) {
      throw new Error('Ghost Admin API key is required');
    }

    if (!credentials.apiUrl) {
      throw new Error('Ghost API URL is required');
    }

    this.adminApiKey = credentials.adminApiKey;
    this.apiUrl = credentials.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultAuthor = ghostConfig.defaultAuthor;
    this.defaultFeatured = ghostConfig.defaultFeatured ?? false;
    this.defaultStatus = ghostConfig.defaultStatus ?? 'draft';
  }

  /**
   * Generate a JWT token for Ghost Admin API authentication
   */
  private generateToken(): string {
    try {
      // Split the key into ID and SECRET
      const [id, secret] = this.adminApiKey.split(':');

      if (!id || !secret) {
        throw new Error('Invalid Admin API Key format. Expected format: "id:secret"');
      }

      // Create the token (including decoding secret from hex)
      const token = jwt.sign(
        {},
        Buffer.from(secret, 'hex'),
        {
          keyid: id,
          algorithm: 'HS256',
          expiresIn: '5m',
          audience: `/admin/`,
        }
      );

      return token;
    } catch (error: any) {
      throw new Error(`Failed to generate Ghost JWT: ${error.message}`);
    }
  }

  /**
   * Make an authenticated request to Ghost Admin API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<GhostApiResponse> {
    try {
      const token = this.generateToken();
      const url = `${this.apiUrl}/ghost/api/admin${endpoint}`;

      const headers: Record<string, string> = {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
        'Accept-Version': 'v5.0', // Ghost API version
      };

      const options: RequestInit = {
        method,
        headers,
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        // Ghost returns errors in a specific format
        if (responseData.errors && Array.isArray(responseData.errors)) {
          const errorMessages = responseData.errors
            .map((e: any) => e.message)
            .join(', ');
          throw new Error(`Ghost API error: ${errorMessages}`);
        }
        throw new Error(`Ghost API request failed: ${response.statusText}`);
      }

      return responseData as GhostApiResponse;
    } catch (error: any) {
      throw new Error(`Ghost API request failed: ${error.message}`);
    }
  }

  /**
   * Test the Ghost API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to fetch site information
      await this.makeRequest('/site/');
      return true;
    } catch (error) {
      console.error('Ghost connection test failed:', error);
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

      return 'active';
    } catch (error) {
      console.error('Error checking Ghost status:', error);
      return 'error';
    }
  }

  /**
   * Validate Ghost configuration
   */
  async validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];

    // Validate Admin API key format
    const adminApiKey = config.adminApiKey as string;
    if (!adminApiKey) {
      errors.push('Admin API key is required');
    } else if (!adminApiKey.includes(':')) {
      errors.push('Invalid Admin API key format (must be "id:secret")');
    }

    // Validate API URL
    const apiUrl = config.apiUrl as string;
    if (!apiUrl) {
      errors.push('API URL is required');
    } else {
      try {
        new URL(apiUrl);
      } catch {
        errors.push('Invalid API URL format');
      }
    }

    // Validate default status if provided
    const defaultStatus = config.defaultStatus as string;
    if (defaultStatus && !['draft', 'published'].includes(defaultStatus)) {
      errors.push('Default status must be either "draft" or "published"');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Convert HTML content to Ghost's Mobiledoc format (simplified)
   * For production, consider using a proper HTML to Mobiledoc converter
   */
  private convertToMobiledoc(html: string): string {
    // This is a simplified mobiledoc structure
    // For production use, consider using @tryghost/mobiledoc-kit or similar
    const mobiledoc = {
      version: '0.3.1',
      atoms: [],
      cards: [['html', { cardName: 'html', html }]],
      markups: [],
      sections: [[10, 0]],
    };

    return JSON.stringify(mobiledoc);
  }

  /**
   * Publish content to Ghost CMS
   */
  async publishContent(params: {
    title: string;
    content: string;
    slug?: string;
    tags?: string[];
    status?: 'draft' | 'published';
    taskId?: string;
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

      // Extract metadata fields
      const featureImage = params.metadata?.featureImage as string | undefined;
      const excerpt = params.metadata?.excerpt as string | undefined;
      const featured = params.metadata?.featured as boolean | undefined;
      const publishedAt = params.metadata?.publishedAt as string | undefined;
      const metaTitle = params.metadata?.metaTitle as string | undefined;
      const metaDescription = params.metadata?.metaDescription as string | undefined;
      const authors = params.metadata?.authors as string[] | undefined;

      // Prepare post data
      const post: GhostPost = {
        title: params.title,
        html: params.content,
        mobiledoc: this.convertToMobiledoc(params.content),
        status: params.status || this.defaultStatus,
        slug: params.slug,
        feature_image: featureImage,
        featured: featured ?? this.defaultFeatured,
        custom_excerpt: excerpt,
        meta_title: metaTitle,
        meta_description: metaDescription,
      };

      // Add tags if provided
      if (params.tags && params.tags.length > 0) {
        post.tags = params.tags.map(name => ({ name }));
      }

      // Add authors if provided
      if (authors && authors.length > 0) {
        post.authors = authors;
      } else if (this.defaultAuthor) {
        post.authors = [this.defaultAuthor];
      }

      // Set published date for scheduling
      if (publishedAt) {
        post.published_at = publishedAt;
        if (post.status !== 'scheduled') {
          post.status = 'scheduled';
        }
      }

      // Create post via Ghost API
      const result = await this.makeRequest('/posts/', 'POST', {
        posts: [post],
      });

      if (!result.posts || result.posts.length === 0) {
        throw new Error('No post returned from Ghost API');
      }

      const createdPost = result.posts[0];

      // Record usage
      await this.recordUsage(params.taskId);

      return {
        success: true,
        externalId: createdPost.id,
        metadata: {
          postId: createdPost.id,
          slug: createdPost.slug,
          status: createdPost.status,
          url: `${this.apiUrl}/${createdPost.slug}`,
          publishedAt: createdPost.published_at,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error publishing content to Ghost:', error);

      // Log error to connector
      await this.recordError(error.message, params.taskId);

      return {
        success: false,
        error: error.message || 'Failed to publish content',
        metadata: {
          errorType: error.name,
        },
      };
    }
  }

  /**
   * Update existing content in Ghost CMS
   */
  async updateContent(params: {
    id: string;
    title?: string;
    content?: string;
    status?: 'draft' | 'published';
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

      // First, fetch the existing post to get updated_at for optimistic locking
      const existingPostResponse = await this.makeRequest(`/posts/${params.id}/`);
      if (!existingPostResponse.posts || existingPostResponse.posts.length === 0) {
        return {
          success: false,
          error: 'Post not found',
        };
      }

      const existingPost = existingPostResponse.posts[0];

      // Extract metadata fields
      const featureImage = params.metadata?.featureImage as string | undefined;
      const excerpt = params.metadata?.excerpt as string | undefined;
      const featured = params.metadata?.featured as boolean | undefined;
      const publishedAt = params.metadata?.publishedAt as string | undefined;
      const metaTitle = params.metadata?.metaTitle as string | undefined;
      const metaDescription = params.metadata?.metaDescription as string | undefined;
      const tags = params.metadata?.tags as string[] | undefined;
      const slug = params.metadata?.slug as string | undefined;

      // Prepare update data - only include fields that are being updated
      const post: Partial<GhostPost> & { updated_at?: string } = {
        updated_at: existingPost.updated_at, // Required for optimistic locking
      };

      if (params.title !== undefined) {
        post.title = params.title;
      }

      if (params.content !== undefined) {
        post.html = params.content;
        post.mobiledoc = this.convertToMobiledoc(params.content);
      }

      if (params.status !== undefined) {
        post.status = params.status;
      }

      if (slug !== undefined) {
        post.slug = slug;
      }

      if (featureImage !== undefined) {
        post.feature_image = featureImage;
      }

      if (excerpt !== undefined) {
        post.custom_excerpt = excerpt;
      }

      if (featured !== undefined) {
        post.featured = featured;
      }

      if (metaTitle !== undefined) {
        post.meta_title = metaTitle;
      }

      if (metaDescription !== undefined) {
        post.meta_description = metaDescription;
      }

      if (tags !== undefined && tags.length > 0) {
        post.tags = tags.map(name => ({ name }));
      }

      if (publishedAt !== undefined) {
        post.published_at = publishedAt;
        if (!post.status) {
          post.status = 'scheduled';
        }
      }

      // Update post via Ghost API
      const result = await this.makeRequest(`/posts/${params.id}/`, 'PUT', {
        posts: [post],
      });

      if (!result.posts || result.posts.length === 0) {
        throw new Error('No post returned from Ghost API');
      }

      const updatedPost = result.posts[0];

      // Record usage
      await this.recordUsage();

      return {
        success: true,
        externalId: updatedPost.id,
        metadata: {
          postId: updatedPost.id,
          slug: updatedPost.slug,
          status: updatedPost.status,
          url: `${this.apiUrl}/${updatedPost.slug}`,
          updatedAt: updatedPost.updated_at,
        },
      };
    } catch (error: any) {
      console.error('Error updating content in Ghost:', error);

      // Log error to connector
      await this.recordError(error.message);

      return {
        success: false,
        error: error.message || 'Failed to update content',
        metadata: {
          errorType: error.name,
        },
      };
    }
  }

  /**
   * Get a post by ID
   */
  async getPost(postId: string): Promise<GhostPost | null> {
    try {
      const result = await this.makeRequest(`/posts/${postId}/`);
      if (!result.posts || result.posts.length === 0) {
        return null;
      }
      return result.posts[0];
    } catch (error) {
      console.error('Error fetching post from Ghost:', error);
      return null;
    }
  }

  /**
   * Delete a post by ID
   */
  async deletePost(postId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/posts/${postId}/`, 'DELETE');
      await this.recordUsage();
      return true;
    } catch (error) {
      console.error('Error deleting post from Ghost:', error);
      await this.recordError((error as Error).message);
      return false;
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
          : now.getTime() - 24 * 60 * 1000
      ).toISOString();

      // Query usage from cms_metrics table
      const { count } = await supabase
        .from('cms_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('connector_id', this.config.id)
        .gte('created_at', windowStart);

      const used = count || 0;
      const limit = timeWindow === 'hour'
        ? (this.config.rateLimit?.perHour || 500)
        : (this.config.rateLimit?.perDay || 5000);

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

      // Optionally record in cms_metrics table if it exists
      // This would need to be created in your database schema
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
 * Factory function to create a GhostConnector instance
 */
export async function createGhostConnector(
  connectorId: string
): Promise<GhostConnector> {
  const supabase = createAdminClient();

  const { data: connector, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .eq('type', 'cms')
    .single();

  if (error || !connector) {
    throw new Error(`Connector not found: ${connectorId}`);
  }

  return new GhostConnector({
    id: connector.id,
    organizationId: connector.organization_id,
    type: 'cms',
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
