/**
 * Meta (Facebook) Ads Connector
 *
 * Implements advertising functionality using the Facebook Marketing API.
 * Supports campaign creation, ad set management, creative ads, and performance metrics.
 */

import {
  BaseConnector,
  ConnectorConfig,
  ConnectorResult,
  ConnectorStatus,
} from '../base';
import { createAdminClient } from '@/lib/supabase/admin';

// Facebook Marketing API types
interface MetaAdsCredentials {
  accessToken: string;
  adAccountId: string;
  appId?: string;
  appSecret?: string;
}

interface MetaAdsConfig {
  apiVersion?: string;
  defaultCurrency?: string;
  defaultTimezone?: string;
}

interface CampaignParams {
  name: string;
  objective: CampaignObjective;
  status?: CampaignStatus;
  specialAdCategories?: string[];
  buyingType?: 'AUCTION' | 'RESERVED';
  taskId?: string;
  metadata?: Record<string, unknown>;
}

interface AdSetParams {
  campaignId: string;
  name: string;
  budgetAmount: number;
  budgetType: 'DAILY' | 'LIFETIME';
  billingEvent?: 'IMPRESSIONS' | 'LINK_CLICKS' | 'POST_ENGAGEMENT';
  optimizationGoal?: 'REACH' | 'IMPRESSIONS' | 'LINK_CLICKS' | 'LANDING_PAGE_VIEWS' | 'CONVERSIONS';
  targeting: TargetingSpec;
  status?: AdSetStatus;
  startTime?: Date;
  endTime?: Date;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

interface AdParams {
  adSetId: string;
  name: string;
  creative: AdCreative;
  status?: AdStatus;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

interface AdCreative {
  objectStorySpec?: {
    pageId: string;
    linkData?: {
      link: string;
      message: string;
      name?: string;
      description?: string;
      imageHash?: string;
      callToAction?: {
        type: string;
        value?: {
          link?: string;
        };
      };
    };
    videoData?: {
      videoId: string;
      message: string;
      title?: string;
      callToAction?: {
        type: string;
        value?: {
          link?: string;
        };
      };
    };
  };
  instagramActorId?: string;
}

interface TargetingSpec {
  geoLocations?: {
    countries?: string[];
    regions?: Array<{ key: string }>;
    cities?: Array<{ key: string; radius?: number; distance_unit?: string }>;
  };
  ageMin?: number;
  ageMax?: number;
  genders?: Array<1 | 2>; // 1 = male, 2 = female
  interests?: Array<{ id: string; name?: string }>;
  behaviors?: Array<{ id: string; name?: string }>;
  customAudiences?: Array<{ id: string }>;
  excludedCustomAudiences?: Array<{ id: string }>;
  flexibleSpec?: Array<{
    interests?: Array<{ id: string; name?: string }>;
    behaviors?: Array<{ id: string; name?: string }>;
  }>;
  devicePlatforms?: Array<'mobile' | 'desktop'>;
  publisherPlatforms?: Array<'facebook' | 'instagram' | 'audience_network' | 'messenger'>;
  facebookPositions?: string[];
  instagramPositions?: string[];
}

interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions?: number;
  costPerConversion?: number;
  dateStart: string;
  dateStop: string;
}

type CampaignObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC';

type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
type AdSetStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
type AdStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';

export class MetaAdsConnector extends BaseConnector {
  private credentials: MetaAdsCredentials;
  private apiConfig: MetaAdsConfig;
  private apiVersion: string;
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super(config);

    this.credentials = config.credentials as unknown as MetaAdsCredentials;
    this.apiConfig = config.config as unknown as MetaAdsConfig;

    if (!this.credentials.accessToken) {
      throw new Error('Meta Ads access token is required');
    }
    if (!this.credentials.adAccountId) {
      throw new Error('Meta Ads account ID is required');
    }

    this.apiVersion = this.apiConfig.apiVersion || 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  /**
   * Test the Meta Ads API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const adAccountId = this.normalizeAdAccountId(this.credentials.adAccountId);
      const response = await this.makeRequest('GET', `/${adAccountId}`, {
        fields: 'id,name,account_status',
      });

      return response.account_status === 1; // 1 = ACTIVE
    } catch (error) {
      console.error('Meta Ads connection test failed:', error);
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
      console.error('Error checking Meta Ads status:', error);
      return 'error';
    }
  }

  /**
   * Validate Meta Ads configuration
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
      errors.push('Invalid access token format');
    }

    // Validate ad account ID
    const adAccountId = config.adAccountId as string;
    if (!adAccountId) {
      errors.push('Ad Account ID is required');
    } else if (!adAccountId.match(/^(act_)?\d+$/)) {
      errors.push('Invalid Ad Account ID format (must be numeric or start with "act_")');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Create a new campaign
   */
  async createCampaign(params: CampaignParams): Promise<ConnectorResult> {
    try {
      const canExecute = await this.canExecute();
      if (!canExecute) {
        return {
          success: false,
          error: 'Connector is not active or rate limit exceeded',
        };
      }

      const adAccountId = this.normalizeAdAccountId(this.credentials.adAccountId);

      const requestData = {
        name: params.name,
        objective: params.objective,
        status: params.status || 'PAUSED',
        special_ad_categories: params.specialAdCategories || [],
        buying_type: params.buyingType || 'AUCTION',
      };

      const response = await this.makeRequest('POST', `/${adAccountId}/campaigns`, requestData);

      await this.recordUsage(params.taskId);

      return {
        success: true,
        externalId: response.id,
        metadata: {
          campaignId: response.id,
          name: params.name,
          objective: params.objective,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error creating Meta Ads campaign:', error);
      await this.recordError(error.message, params.taskId);

      return {
        success: false,
        error: error.message || 'Failed to create campaign',
        metadata: {
          errorCode: error.code,
          errorType: error.type,
        },
      };
    }
  }

  /**
   * Create an ad set within a campaign
   */
  async createAdSet(params: AdSetParams): Promise<ConnectorResult> {
    try {
      const canExecute = await this.canExecute();
      if (!canExecute) {
        return {
          success: false,
          error: 'Connector is not active or rate limit exceeded',
        };
      }

      const adAccountId = this.normalizeAdAccountId(this.credentials.adAccountId);

      // Convert budget to cents (Facebook expects integer cents)
      const budgetInCents = Math.round(params.budgetAmount * 100);

      const requestData: any = {
        campaign_id: params.campaignId,
        name: params.name,
        status: params.status || 'PAUSED',
        billing_event: params.billingEvent || 'IMPRESSIONS',
        optimization_goal: params.optimizationGoal || 'REACH',
        targeting: this.formatTargeting(params.targeting),
      };

      // Add budget
      if (params.budgetType === 'DAILY') {
        requestData.daily_budget = budgetInCents;
      } else {
        requestData.lifetime_budget = budgetInCents;
      }

      // Add time constraints
      if (params.startTime) {
        requestData.start_time = params.startTime.toISOString();
      }
      if (params.endTime) {
        requestData.end_time = params.endTime.toISOString();
      }

      const response = await this.makeRequest('POST', `/${adAccountId}/adsets`, requestData);

      await this.recordUsage(params.taskId);

      return {
        success: true,
        externalId: response.id,
        metadata: {
          adSetId: response.id,
          campaignId: params.campaignId,
          name: params.name,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error creating Meta Ads ad set:', error);
      await this.recordError(error.message, params.taskId);

      return {
        success: false,
        error: error.message || 'Failed to create ad set',
        metadata: {
          errorCode: error.code,
          errorType: error.type,
        },
      };
    }
  }

  /**
   * Create an ad within an ad set
   */
  async createAd(params: AdParams): Promise<ConnectorResult> {
    try {
      const canExecute = await this.canExecute();
      if (!canExecute) {
        return {
          success: false,
          error: 'Connector is not active or rate limit exceeded',
        };
      }

      const adAccountId = this.normalizeAdAccountId(this.credentials.adAccountId);

      // First, create the ad creative
      const creativeResponse = await this.makeRequest(
        'POST',
        `/${adAccountId}/adcreatives`,
        {
          object_story_spec: params.creative.objectStorySpec,
          instagram_actor_id: params.creative.instagramActorId,
        }
      );

      // Then, create the ad with the creative
      const requestData = {
        adset_id: params.adSetId,
        name: params.name,
        creative: { creative_id: creativeResponse.id },
        status: params.status || 'PAUSED',
      };

      const response = await this.makeRequest('POST', `/${adAccountId}/ads`, requestData);

      await this.recordUsage(params.taskId);

      return {
        success: true,
        externalId: response.id,
        metadata: {
          adId: response.id,
          creativeId: creativeResponse.id,
          adSetId: params.adSetId,
          name: params.name,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error creating Meta Ad:', error);
      await this.recordError(error.message, params.taskId);

      return {
        success: false,
        error: error.message || 'Failed to create ad',
        metadata: {
          errorCode: error.code,
          errorType: error.type,
        },
      };
    }
  }

  /**
   * Get campaign performance metrics
   */
  async getCampaignMetrics(
    campaignId: string,
    dateStart?: string,
    dateStop?: string
  ): Promise<CampaignMetrics | null> {
    try {
      const params: any = {
        fields: 'name,impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,conversions,cost_per_conversion',
        level: 'campaign',
      };

      if (dateStart) params.time_range = { since: dateStart, until: dateStop || dateStart };

      const response = await this.makeRequest('GET', `/${campaignId}/insights`, params);

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const data = response.data[0];

      return {
        campaignId,
        campaignName: data.campaign_name || '',
        impressions: parseInt(data.impressions || '0'),
        clicks: parseInt(data.clicks || '0'),
        spend: parseFloat(data.spend || '0'),
        reach: parseInt(data.reach || '0'),
        frequency: parseFloat(data.frequency || '0'),
        ctr: parseFloat(data.ctr || '0'),
        cpc: parseFloat(data.cpc || '0'),
        cpm: parseFloat(data.cpm || '0'),
        conversions: data.conversions ? parseInt(data.conversions) : undefined,
        costPerConversion: data.cost_per_conversion ? parseFloat(data.cost_per_conversion) : undefined,
        dateStart: data.date_start || dateStart || '',
        dateStop: data.date_stop || dateStop || '',
      };
    } catch (error: any) {
      console.error('Error getting campaign metrics:', error);
      throw new Error(`Failed to get campaign metrics: ${error.message}`);
    }
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string, taskId?: string): Promise<ConnectorResult> {
    return this.updateCampaignStatus(campaignId, 'PAUSED', taskId);
  }

  /**
   * Resume a campaign
   */
  async resumeCampaign(campaignId: string, taskId?: string): Promise<ConnectorResult> {
    return this.updateCampaignStatus(campaignId, 'ACTIVE', taskId);
  }

  /**
   * Update campaign status
   */
  private async updateCampaignStatus(
    campaignId: string,
    status: CampaignStatus,
    taskId?: string
  ): Promise<ConnectorResult> {
    try {
      const canExecute = await this.canExecute();
      if (!canExecute) {
        return {
          success: false,
          error: 'Connector is not active or rate limit exceeded',
        };
      }

      await this.makeRequest('POST', `/${campaignId}`, { status });

      await this.recordUsage(taskId);

      return {
        success: true,
        externalId: campaignId,
        metadata: {
          campaignId,
          status,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error updating campaign status:', error);
      await this.recordError(error.message, taskId);

      return {
        success: false,
        error: error.message || 'Failed to update campaign status',
        metadata: {
          errorCode: error.code,
          errorType: error.type,
        },
      };
    }
  }

  /**
   * Make a request to the Facebook Marketing API
   */
  private async makeRequest(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    data?: Record<string, any>
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add access token to all requests
    const params: Record<string, string> = {
      access_token: this.credentials.accessToken,
    };

    // For GET requests, add data as query params
    if (method === 'GET' && data) {
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'object') {
          params[key] = JSON.stringify(value);
        } else {
          params[key] = String(value);
        }
      });
    }

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // For POST requests, add data to body
    if (method === 'POST' && data) {
      const formData = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });
      options.body = formData.toString();
      options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message ||
        error.error?.error_user_msg ||
        `API request failed: ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Format targeting spec for Facebook API
   */
  private formatTargeting(targeting: TargetingSpec): any {
    const formatted: any = {};

    if (targeting.geoLocations) {
      formatted.geo_locations = targeting.geoLocations;
    }

    if (targeting.ageMin !== undefined) {
      formatted.age_min = targeting.ageMin;
    }

    if (targeting.ageMax !== undefined) {
      formatted.age_max = targeting.ageMax;
    }

    if (targeting.genders) {
      formatted.genders = targeting.genders;
    }

    if (targeting.interests) {
      formatted.interests = targeting.interests;
    }

    if (targeting.behaviors) {
      formatted.behaviors = targeting.behaviors;
    }

    if (targeting.customAudiences) {
      formatted.custom_audiences = targeting.customAudiences;
    }

    if (targeting.excludedCustomAudiences) {
      formatted.excluded_custom_audiences = targeting.excludedCustomAudiences;
    }

    if (targeting.flexibleSpec) {
      formatted.flexible_spec = targeting.flexibleSpec;
    }

    if (targeting.devicePlatforms) {
      formatted.device_platforms = targeting.devicePlatforms;
    }

    if (targeting.publisherPlatforms) {
      formatted.publisher_platforms = targeting.publisherPlatforms;
    }

    if (targeting.facebookPositions) {
      formatted.facebook_positions = targeting.facebookPositions;
    }

    if (targeting.instagramPositions) {
      formatted.instagram_positions = targeting.instagramPositions;
    }

    return formatted;
  }

  /**
   * Normalize ad account ID to include 'act_' prefix
   */
  private normalizeAdAccountId(adAccountId: string): string {
    return adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
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

      // Query usage from ad_metrics table
      const { count } = await supabase
        .from('ad_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('connector_id', this.config.id)
        .gte('created_at', windowStart);

      const used = count || 0;
      const limit = timeWindow === 'hour'
        ? (this.config.rateLimit?.perHour || 200)
        : (this.config.rateLimit?.perDay || 4000);

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
 * Factory function to create a MetaAdsConnector instance
 */
export async function createMetaAdsConnector(
  connectorId: string
): Promise<MetaAdsConnector> {
  const supabase = createAdminClient();

  const { data: connector, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .eq('type', 'advertising')
    .single();

  if (error || !connector) {
    throw new Error(`Connector not found: ${connectorId}`);
  }

  return new MetaAdsConnector({
    id: connector.id,
    organizationId: connector.organization_id,
    type: 'advertising',
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
