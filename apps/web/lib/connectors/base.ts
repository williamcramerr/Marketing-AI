/**
 * Base connector interface that all connectors must implement
 *
 * This provides a standardized way to interact with external services
 * like email providers, CMS platforms, social media APIs, etc.
 */

export type ConnectorType =
  | 'email'
  | 'cms'
  | 'social'
  | 'analytics'
  | 'advertising';

export type ConnectorStatus =
  | 'active'
  | 'inactive'
  | 'error'
  | 'rate_limited';

export interface ConnectorConfig {
  id: string;
  organizationId: string;
  type: ConnectorType;
  name: string;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  active: boolean;
  rateLimit?: {
    perHour?: number;
    perDay?: number;
  };
}

export interface ConnectorResult {
  success: boolean;
  messageId?: string;
  externalId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface BatchResult {
  totalSent: number;
  successful: number;
  failed: number;
  results: Array<{
    success: boolean;
    messageId?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Base abstract class for all connectors
 */
export abstract class BaseConnector {
  protected config: ConnectorConfig;

  constructor(config: ConnectorConfig) {
    this.config = config;
  }

  /**
   * Test the connector credentials and connection
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Get the current status of the connector
   */
  abstract getStatus(): Promise<ConnectorStatus>;

  /**
   * Validate configuration before saving
   */
  abstract validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors?: string[];
  }>;

  /**
   * Get usage statistics for rate limiting
   */
  async getUsageStats(timeWindow: 'hour' | 'day'): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    // Default implementation - can be overridden
    return {
      used: 0,
      limit: timeWindow === 'hour'
        ? (this.config.rateLimit?.perHour || Infinity)
        : (this.config.rateLimit?.perDay || Infinity),
      remaining: Infinity,
    };
  }

  /**
   * Check if the connector can execute based on rate limits
   */
  async canExecute(): Promise<boolean> {
    if (!this.config.active) {
      return false;
    }

    const hourlyStats = await this.getUsageStats('hour');
    const dailyStats = await this.getUsageStats('day');

    return hourlyStats.remaining > 0 && dailyStats.remaining > 0;
  }

  /**
   * Get connector metadata
   */
  getMetadata(): ConnectorConfig {
    return this.config;
  }
}

/**
 * Email connector specific interface
 */
export interface EmailConnector extends BaseConnector {
  /**
   * Send a single email
   */
  sendEmail(params: {
    to: string | string[];
    subject: string;
    body: string;
    from?: string;
    replyTo?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorResult>;

  /**
   * Send multiple emails in batch
   */
  sendBatch(emails: Array<{
    to: string | string[];
    subject: string;
    body: string;
    from?: string;
    replyTo?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  }>): Promise<BatchResult>;

  /**
   * Get email delivery status
   */
  getDeliveryStatus?(messageId: string): Promise<{
    status: 'sent' | 'delivered' | 'bounced' | 'failed';
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * CMS connector specific interface
 */
export interface CMSConnector extends BaseConnector {
  /**
   * Publish content to the CMS
   */
  publishContent(params: {
    title: string;
    content: string;
    slug?: string;
    tags?: string[];
    status?: 'draft' | 'published';
    taskId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorResult>;

  /**
   * Update existing content
   */
  updateContent(params: {
    id: string;
    title?: string;
    content?: string;
    status?: 'draft' | 'published';
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorResult>;
}

/**
 * Social media connector specific interface
 */
export interface SocialConnector extends BaseConnector {
  /**
   * Post to social media
   */
  post(params: {
    content: string;
    media?: string[];
    taskId?: string;
    scheduledTime?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorResult>;

  /**
   * Get post engagement metrics
   */
  getEngagement?(postId: string): Promise<{
    likes: number;
    shares: number;
    comments: number;
    impressions: number;
  }>;
}

/**
 * Advertising connector specific interface
 */
export interface AdvertisingConnector extends BaseConnector {
  /**
   * Create a new advertising campaign
   */
  createCampaign(params: {
    name: string;
    type: 'search' | 'display' | 'video' | 'shopping';
    budget: {
      amount: number;
      currency: string;
      type: 'daily' | 'total';
    };
    startDate?: Date;
    endDate?: Date;
    targeting?: {
      keywords?: string[];
      locations?: string[];
      demographics?: Record<string, unknown>;
      audiences?: string[];
    };
    adGroups?: Array<{
      name: string;
      ads: Array<{
        headlines: string[];
        descriptions: string[];
        finalUrl: string;
      }>;
    }>;
    taskId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorResult>;

  /**
   * Update an existing campaign
   */
  updateCampaign(params: {
    campaignId: string;
    name?: string;
    status?: 'active' | 'paused' | 'removed';
    budget?: {
      amount: number;
      currency: string;
      type: 'daily' | 'total';
    };
    startDate?: Date;
    endDate?: Date;
    targeting?: {
      keywords?: string[];
      locations?: string[];
      demographics?: Record<string, unknown>;
      audiences?: string[];
    };
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorResult>;

  /**
   * Pause a campaign
   */
  pauseCampaign(campaignId: string): Promise<ConnectorResult>;

  /**
   * Resume a paused campaign
   */
  resumeCampaign(campaignId: string): Promise<ConnectorResult>;

  /**
   * Get campaign performance metrics
   */
  getCampaignMetrics(params: {
    campaignId: string;
    startDate?: Date;
    endDate?: Date;
    metrics?: string[];
  }): Promise<{
    campaignId: string;
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    ctr: number;
    cpc: number;
    conversionRate: number;
    roas?: number;
    metadata?: Record<string, unknown>;
  }>;
}
