/**
 * WordPress CMS Connector
 *
 * Implements WordPress REST API integration using application password authentication.
 * Supports creating, updating, and publishing blog posts with full metadata support.
 */

import {
  BaseConnector,
  ConnectorConfig,
  ConnectorResult,
  ConnectorStatus,
  CMSConnector,
} from '../base';
import { createAdminClient } from '@/lib/supabase/admin';

interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

interface WordPressPost {
  id: number;
  title: {
    rendered: string;
    raw?: string;
  };
  content: {
    rendered: string;
    raw?: string;
  };
  status: 'publish' | 'draft' | 'future' | 'pending' | 'private';
  slug: string;
  date?: string;
  date_gmt?: string;
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  link?: string;
}

interface WordPressPublishParams {
  title: string;
  content: string;
  slug?: string;
  tags?: string[];
  categories?: string[];
  status?: 'draft' | 'published';
  featuredImageId?: number;
  scheduledDate?: Date;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export class WordPressConnector extends BaseConnector implements CMSConnector {
  private credentials: WordPressCredentials;
  private apiUrl: string;

  constructor(config: ConnectorConfig) {
    super(config);

    this.credentials = config.credentials as unknown as WordPressCredentials;

    if (!this.credentials.siteUrl || !this.credentials.username || !this.credentials.applicationPassword) {
      throw new Error('WordPress site URL, username, and application password are required');
    }

    // Normalize site URL and construct API endpoint
    const siteUrl = this.credentials.siteUrl.replace(/\/$/, '');
    this.apiUrl = `${siteUrl}/wp-json/wp/v2`;
  }

  /**
   * Test the WordPress API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/posts', {
        params: { per_page: 1 },
      });

      return response.ok;
    } catch (error) {
      console.error('WordPress connection test failed:', error);
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
      console.error('Error checking WordPress status:', error);
      return 'error';
    }
  }

  /**
   * Validate WordPress configuration
   */
  async validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];

    // Validate site URL
    const siteUrl = config.siteUrl as string;
    if (!siteUrl) {
      errors.push('Site URL is required');
    } else if (!this.isValidUrl(siteUrl)) {
      errors.push('Invalid site URL format');
    }

    // Validate username
    const username = config.username as string;
    if (!username) {
      errors.push('Username is required');
    }

    // Validate application password
    const applicationPassword = config.applicationPassword as string;
    if (!applicationPassword) {
      errors.push('Application password is required');
    } else if (applicationPassword.length < 20) {
      errors.push('Application password appears to be invalid (too short)');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Publish content to WordPress
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

      // Extract WordPress-specific params from metadata
      const wordpressParams = params.metadata as WordPressPublishParams | undefined;
      const categories = wordpressParams?.categories;
      const featuredImageId = wordpressParams?.featuredImageId;
      const scheduledDate = wordpressParams?.scheduledDate;

      // Process tags if provided
      let tagIds: number[] | undefined;
      if (params.tags && params.tags.length > 0) {
        tagIds = await this.getOrCreateTags(params.tags);
      }

      // Process categories if provided
      let categoryIds: number[] | undefined;
      if (categories && categories.length > 0) {
        categoryIds = await this.getOrCreateCategories(categories);
      }

      // Determine post status
      const status = params.status === 'published' ? 'publish' : 'draft';

      // Build post data - WordPress accepts strings for title/content on creation
      const postData: Record<string, unknown> = {
        title: params.title,
        content: params.content,
        status: scheduledDate ? 'future' : status,
        slug: params.slug,
      };

      // Add optional fields
      if (tagIds && tagIds.length > 0) {
        postData.tags = tagIds;
      }
      if (categoryIds && categoryIds.length > 0) {
        postData.categories = categoryIds;
      }
      if (featuredImageId) {
        postData.featured_media = featuredImageId;
      }
      if (scheduledDate) {
        postData.date = scheduledDate.toISOString();
        postData.date_gmt = scheduledDate.toISOString();
      }

      // Create the post
      const response = await this.makeRequest('POST', '/posts', {
        body: postData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create WordPress post');
      }

      const post: WordPressPost = await response.json();

      // Record usage
      await this.recordUsage(params.taskId);

      return {
        success: true,
        externalId: post.id.toString(),
        metadata: {
          postId: post.id,
          slug: post.slug,
          status: post.status,
          link: post.link,
          publishedAt: post.date,
        },
      };
    } catch (error: any) {
      console.error('Error publishing to WordPress:', error);

      // Log error to connector
      await this.recordError(error.message, params.taskId);

      return {
        success: false,
        error: error.message || 'Failed to publish content to WordPress',
        metadata: {
          errorType: error.name,
        },
      };
    }
  }

  /**
   * Update existing WordPress content
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

      // Extract WordPress-specific params from metadata
      const wordpressParams = params.metadata as WordPressPublishParams | undefined;
      const tags = wordpressParams?.tags;
      const categories = wordpressParams?.categories;
      const featuredImageId = wordpressParams?.featuredImageId;
      const slug = wordpressParams?.slug;
      const scheduledDate = wordpressParams?.scheduledDate;

      // Build update data
      const updateData: Partial<WordPressPost> = {};

      if (params.title) {
        updateData.title = { raw: params.title } as any;
      }
      if (params.content) {
        updateData.content = { raw: params.content } as any;
      }
      if (params.status) {
        updateData.status = params.status === 'published' ? 'publish' : 'draft';
      }
      if (slug) {
        updateData.slug = slug;
      }

      // Process tags if provided
      if (tags && tags.length > 0) {
        const tagIds = await this.getOrCreateTags(tags);
        updateData.tags = tagIds;
      }

      // Process categories if provided
      if (categories && categories.length > 0) {
        const categoryIds = await this.getOrCreateCategories(categories);
        updateData.categories = categoryIds;
      }

      // Add optional fields
      if (featuredImageId) {
        updateData.featured_media = featuredImageId;
      }
      if (scheduledDate) {
        updateData.status = 'future';
        updateData.date = scheduledDate.toISOString();
        updateData.date_gmt = scheduledDate.toISOString();
      }

      // Update the post
      const response = await this.makeRequest('POST', `/posts/${params.id}`, {
        body: updateData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update WordPress post');
      }

      const post: WordPressPost = await response.json();

      // Record usage
      await this.recordUsage();

      return {
        success: true,
        externalId: post.id.toString(),
        metadata: {
          postId: post.id,
          slug: post.slug,
          status: post.status,
          link: post.link,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error updating WordPress post:', error);

      // Log error to connector
      await this.recordError(error.message);

      return {
        success: false,
        error: error.message || 'Failed to update WordPress post',
        metadata: {
          errorType: error.name,
        },
      };
    }
  }

  /**
   * Get or create tags by name
   */
  private async getOrCreateTags(tagNames: string[]): Promise<number[]> {
    const tagIds: number[] = [];

    for (const tagName of tagNames) {
      try {
        // Search for existing tag
        const searchResponse = await this.makeRequest('GET', '/tags', {
          params: { search: tagName },
        });

        if (searchResponse.ok) {
          const existingTags = await searchResponse.json();
          const exactMatch = existingTags.find(
            (tag: any) => tag.name.toLowerCase() === tagName.toLowerCase()
          );

          if (exactMatch) {
            tagIds.push(exactMatch.id);
            continue;
          }
        }

        // Create new tag if not found
        const createResponse = await this.makeRequest('POST', '/tags', {
          body: { name: tagName },
        });

        if (createResponse.ok) {
          const newTag = await createResponse.json();
          tagIds.push(newTag.id);
        }
      } catch (error) {
        console.error(`Error processing tag "${tagName}":`, error);
        // Continue with other tags
      }
    }

    return tagIds;
  }

  /**
   * Get or create categories by name
   */
  private async getOrCreateCategories(categoryNames: string[]): Promise<number[]> {
    const categoryIds: number[] = [];

    for (const categoryName of categoryNames) {
      try {
        // Search for existing category
        const searchResponse = await this.makeRequest('GET', '/categories', {
          params: { search: categoryName },
        });

        if (searchResponse.ok) {
          const existingCategories = await searchResponse.json();
          const exactMatch = existingCategories.find(
            (cat: any) => cat.name.toLowerCase() === categoryName.toLowerCase()
          );

          if (exactMatch) {
            categoryIds.push(exactMatch.id);
            continue;
          }
        }

        // Create new category if not found
        const createResponse = await this.makeRequest('POST', '/categories', {
          body: { name: categoryName },
        });

        if (createResponse.ok) {
          const newCategory = await createResponse.json();
          categoryIds.push(newCategory.id);
        }
      } catch (error) {
        console.error(`Error processing category "${categoryName}":`, error);
        // Continue with other categories
      }
    }

    return categoryIds;
  }

  /**
   * Make an authenticated request to the WordPress REST API
   */
  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    options?: {
      body?: Record<string, any>;
      params?: Record<string, any>;
    }
  ): Promise<Response> {
    // Build URL with query parameters
    let url = `${this.apiUrl}${endpoint}`;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }

    // Create basic auth header
    const auth = Buffer.from(
      `${this.credentials.username}:${this.credentials.applicationPassword}`
    ).toString('base64');

    // Prepare request options
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Add body for POST/PUT requests
    if (options?.body && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    return fetch(url, fetchOptions);
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

      // Query usage from cms_metrics table
      const { count } = await supabase
        .from('cms_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('connector_id', this.config.id)
        .gte('created_at', windowStart);

      const used = count || 0;
      const limit = timeWindow === 'hour'
        ? (this.config.rateLimit?.perHour || 100)
        : (this.config.rateLimit?.perDay || 1000);

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

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

/**
 * Factory function to create a WordPressConnector instance
 */
export async function createWordPressConnector(
  connectorId: string
): Promise<WordPressConnector> {
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

  return new WordPressConnector({
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
