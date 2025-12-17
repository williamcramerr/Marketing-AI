/**
 * Google Ads Connector
 *
 * Implements advertising functionality using the Google Ads API.
 * Supports campaign creation, management, budget control, and performance tracking.
 * Uses OAuth 2.0 for authentication.
 */

import {
  BaseConnector,
  ConnectorConfig,
  ConnectorResult,
  ConnectorStatus,
  AdvertisingConnector,
} from '../base';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Google Ads API configuration
 */
interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  customerId: string; // Google Ads customer ID (without hyphens)
}

/**
 * Google Ads API response types
 */
interface GoogleAdsApiResponse {
  results?: any[];
  fieldMask?: string;
  partialFailureError?: {
    code: number;
    message: string;
  };
}

interface GoogleAdsCampaignResponse {
  resourceName: string;
  id: string;
  name: string;
  status: string;
}

export class GoogleAdsConnector extends BaseConnector implements AdvertisingConnector {
  private credentials: GoogleAdsCredentials;
  private apiVersion = 'v15'; // Google Ads API version
  private baseUrl = 'https://googleads.googleapis.com';
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: ConnectorConfig) {
    super(config);

    // Extract credentials
    const creds = config.credentials;
    if (!this.validateCredentials(creds)) {
      throw new Error('Invalid Google Ads credentials configuration');
    }

    this.credentials = {
      clientId: creds.clientId as string,
      clientSecret: creds.clientSecret as string,
      refreshToken: creds.refreshToken as string,
      developerToken: creds.developerToken as string,
      customerId: this.normalizeCustomerId(creds.customerId as string),
    };
  }

  /**
   * Validate credentials structure
   */
  private validateCredentials(creds: Record<string, unknown>): boolean {
    return !!(
      creds.clientId &&
      creds.clientSecret &&
      creds.refreshToken &&
      creds.developerToken &&
      creds.customerId
    );
  }

  /**
   * Normalize customer ID (remove hyphens)
   */
  private normalizeCustomerId(customerId: string): string {
    return customerId.replace(/-/g, '');
  }

  /**
   * Get or refresh OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          refresh_token: this.credentials.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to refresh access token: ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      // Set expiry (typically 3600 seconds, but we'll refresh a bit earlier)
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);

      return this.accessToken;
    } catch (error: any) {
      console.error('Error refreshing Google Ads access token:', error);
      throw new Error(`Failed to authenticate with Google Ads: ${error.message}`);
    }
  }

  /**
   * Make a request to the Google Ads API
   */
  private async makeApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: any
  ): Promise<any> {
    const accessToken = await this.getAccessToken();
    const url = `${this.baseUrl}/${this.apiVersion}/customers/${this.credentials.customerId}/${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': this.credentials.developerToken,
          'Content-Type': 'application/json',
          'login-customer-id': this.credentials.customerId,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Ads API error (${response.status}): ${error}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Google Ads API request failed:', error);
      throw error;
    }
  }

  /**
   * Execute a Google Ads Query Language (GAQL) query
   */
  private async executeQuery(query: string): Promise<any> {
    return this.makeApiRequest('googleAds:searchStream', 'POST', {
      query,
    });
  }

  /**
   * Test the Google Ads API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to get customer info as a connection test
      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code
        FROM customer
        LIMIT 1
      `;

      await this.executeQuery(query);
      return true;
    } catch (error) {
      console.error('Google Ads connection test failed:', error);
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
      console.error('Error checking Google Ads status:', error);
      return 'error';
    }
  }

  /**
   * Validate Google Ads configuration
   */
  async validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];

    // Validate required fields
    if (!config.clientId) {
      errors.push('Client ID is required');
    }
    if (!config.clientSecret) {
      errors.push('Client Secret is required');
    }
    if (!config.refreshToken) {
      errors.push('Refresh Token is required');
    }
    if (!config.developerToken) {
      errors.push('Developer Token is required');
    }
    if (!config.customerId) {
      errors.push('Customer ID is required');
    }

    // Validate customer ID format (should be 10 digits, optionally with hyphens)
    const customerId = config.customerId as string;
    if (customerId && !/^\d{3}-?\d{3}-?\d{4}$/.test(customerId)) {
      errors.push('Invalid Customer ID format (expected format: XXX-XXX-XXXX)');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Create a new advertising campaign
   */
  async createCampaign(params: {
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

      // Step 1: Create campaign budget
      const budgetResourceName = await this.createCampaignBudget(
        `${params.name} Budget`,
        params.budget.amount,
        params.budget.type === 'daily'
      );

      // Step 2: Create campaign
      const campaignType = this.mapCampaignType(params.type);
      const campaignOperation = {
        create: {
          name: params.name,
          status: 'PAUSED', // Start paused for safety
          advertisingChannelType: campaignType,
          campaignBudget: budgetResourceName,
          ...(params.startDate && {
            startDate: this.formatDate(params.startDate),
          }),
          ...(params.endDate && {
            endDate: this.formatDate(params.endDate),
          }),
          networkSettings: {
            targetGoogleSearch: campaignType === 'SEARCH',
            targetSearchNetwork: campaignType === 'SEARCH',
            targetContentNetwork: campaignType === 'DISPLAY',
            targetPartnerSearchNetwork: false,
          },
        },
      };

      const campaignResponse = await this.makeApiRequest(
        'campaigns:mutate',
        'POST',
        {
          operations: [campaignOperation],
          partialFailure: false,
        }
      );

      const campaignResourceName = campaignResponse.results?.[0]?.resourceName;
      const campaignId = this.extractIdFromResourceName(campaignResourceName);

      if (!campaignId) {
        throw new Error('Failed to extract campaign ID from response');
      }

      // Step 3: Create ad groups if provided
      if (params.adGroups && params.adGroups.length > 0) {
        for (const adGroup of params.adGroups) {
          await this.createAdGroup(
            campaignResourceName,
            adGroup.name,
            adGroup.ads,
            params.targeting?.keywords
          );
        }
      }

      // Step 4: Apply targeting if provided
      if (params.targeting) {
        await this.applyTargeting(campaignResourceName, params.targeting);
      }

      // Record usage
      await this.recordUsage(params.taskId);

      return {
        success: true,
        externalId: campaignId,
        metadata: {
          campaignId,
          resourceName: campaignResourceName,
          name: params.name,
          type: params.type,
          status: 'paused',
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error creating Google Ads campaign:', error);
      await this.recordError(error.message, params.taskId);

      return {
        success: false,
        error: error.message || 'Failed to create campaign',
        metadata: {
          errorType: error.name,
        },
      };
    }
  }

  /**
   * Update an existing campaign
   */
  async updateCampaign(params: {
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
  }): Promise<ConnectorResult> {
    try {
      const canExecute = await this.canExecute();
      if (!canExecute) {
        return {
          success: false,
          error: 'Connector is not active or rate limit exceeded',
        };
      }

      const campaignResourceName = `customers/${this.credentials.customerId}/campaigns/${params.campaignId}`;

      // Build update operation
      const updateMask: string[] = [];
      const campaign: any = {
        resourceName: campaignResourceName,
      };

      if (params.name) {
        campaign.name = params.name;
        updateMask.push('name');
      }

      if (params.status) {
        campaign.status = this.mapCampaignStatus(params.status);
        updateMask.push('status');
      }

      if (params.startDate) {
        campaign.startDate = this.formatDate(params.startDate);
        updateMask.push('start_date');
      }

      if (params.endDate) {
        campaign.endDate = this.formatDate(params.endDate);
        updateMask.push('end_date');
      }

      // Update campaign
      const response = await this.makeApiRequest('campaigns:mutate', 'POST', {
        operations: [
          {
            update: campaign,
            updateMask: updateMask.join(','),
          },
        ],
      });

      // Update budget if provided
      if (params.budget) {
        // Get current budget resource name
        const budgetQuery = `
          SELECT campaign.campaign_budget
          FROM campaign
          WHERE campaign.id = ${params.campaignId}
        `;
        const budgetResult = await this.executeQuery(budgetQuery);
        const budgetResourceName = budgetResult.results?.[0]?.campaign?.campaignBudget;

        if (budgetResourceName) {
          await this.updateCampaignBudget(
            budgetResourceName,
            params.budget.amount
          );
        }
      }

      // Apply targeting updates if provided
      if (params.targeting) {
        await this.applyTargeting(campaignResourceName, params.targeting);
      }

      await this.recordUsage();

      return {
        success: true,
        externalId: params.campaignId,
        metadata: {
          campaignId: params.campaignId,
          updatedFields: updateMask,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error updating Google Ads campaign:', error);
      await this.recordError(error.message);

      return {
        success: false,
        error: error.message || 'Failed to update campaign',
      };
    }
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<ConnectorResult> {
    return this.updateCampaign({
      campaignId,
      status: 'paused',
    });
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: string): Promise<ConnectorResult> {
    return this.updateCampaign({
      campaignId,
      status: 'active',
    });
  }

  /**
   * Get campaign performance metrics
   */
  async getCampaignMetrics(params: {
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
  }> {
    try {
      const startDate = params.startDate
        ? this.formatDate(params.startDate)
        : this.formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      const endDate = params.endDate
        ? this.formatDate(params.endDate)
        : this.formatDate(new Date());

      // Build GAQL query for campaign metrics
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions_value
        FROM campaign
        WHERE campaign.id = ${params.campaignId}
          AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      `;

      const response = await this.executeQuery(query);
      const result = response.results?.[0];

      if (!result) {
        throw new Error('Campaign not found or no data available');
      }

      const metrics = result.metrics;
      const impressions = parseInt(metrics.impressions || '0');
      const clicks = parseInt(metrics.clicks || '0');
      const conversions = parseFloat(metrics.conversions || '0');
      const costMicros = parseInt(metrics.costMicros || '0');
      const cost = costMicros / 1000000; // Convert micros to currency units
      const ctr = parseFloat(metrics.ctr || '0');
      const cpc = parseInt(metrics.averageCpc || '0') / 1000000;
      const conversionValue = parseFloat(metrics.conversionsValue || '0');

      const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
      const roas = cost > 0 ? conversionValue / cost : undefined;

      return {
        campaignId: params.campaignId,
        impressions,
        clicks,
        conversions,
        cost,
        ctr,
        cpc,
        conversionRate,
        roas,
        metadata: {
          campaignName: result.campaign.name,
          dateRange: {
            start: startDate,
            end: endDate,
          },
          conversionValue,
        },
      };
    } catch (error: any) {
      console.error('Error getting campaign metrics:', error);
      throw new Error(`Failed to get campaign metrics: ${error.message}`);
    }
  }

  /**
   * Create a campaign budget
   */
  private async createCampaignBudget(
    name: string,
    amount: number,
    isDaily: boolean
  ): Promise<string> {
    const budgetOperation = {
      create: {
        name,
        amountMicros: Math.round(amount * 1000000), // Convert to micros
        deliveryMethod: isDaily ? 'STANDARD' : 'ACCELERATED',
        explicitlyShared: false,
      },
    };

    const response = await this.makeApiRequest(
      'campaignBudgets:mutate',
      'POST',
      {
        operations: [budgetOperation],
      }
    );

    return response.results?.[0]?.resourceName;
  }

  /**
   * Update a campaign budget
   */
  private async updateCampaignBudget(
    budgetResourceName: string,
    amount: number
  ): Promise<void> {
    await this.makeApiRequest('campaignBudgets:mutate', 'POST', {
      operations: [
        {
          update: {
            resourceName: budgetResourceName,
            amountMicros: Math.round(amount * 1000000),
          },
          updateMask: 'amount_micros',
        },
      ],
    });
  }

  /**
   * Create an ad group with ads
   */
  private async createAdGroup(
    campaignResourceName: string,
    name: string,
    ads: Array<{
      headlines: string[];
      descriptions: string[];
      finalUrl: string;
    }>,
    keywords?: string[]
  ): Promise<string> {
    // Create ad group
    const adGroupOperation = {
      create: {
        name,
        campaign: campaignResourceName,
        status: 'ENABLED',
        type: 'SEARCH_STANDARD',
      },
    };

    const adGroupResponse = await this.makeApiRequest('adGroups:mutate', 'POST', {
      operations: [adGroupOperation],
    });

    const adGroupResourceName = adGroupResponse.results?.[0]?.resourceName;

    // Create ads within the ad group
    if (ads && ads.length > 0) {
      for (const ad of ads) {
        await this.createResponsiveSearchAd(adGroupResourceName, ad);
      }
    }

    // Add keywords if provided
    if (keywords && keywords.length > 0) {
      await this.addKeywords(adGroupResourceName, keywords);
    }

    return adGroupResourceName;
  }

  /**
   * Create a responsive search ad
   */
  private async createResponsiveSearchAd(
    adGroupResourceName: string,
    ad: {
      headlines: string[];
      descriptions: string[];
      finalUrl: string;
    }
  ): Promise<void> {
    const adOperation = {
      create: {
        adGroup: adGroupResourceName,
        status: 'ENABLED',
        ad: {
          responsiveSearchAd: {
            headlines: ad.headlines.map((text) => ({ text })),
            descriptions: ad.descriptions.map((text) => ({ text })),
          },
          finalUrls: [ad.finalUrl],
        },
      },
    };

    await this.makeApiRequest('adGroupAds:mutate', 'POST', {
      operations: [adOperation],
    });
  }

  /**
   * Add keywords to an ad group
   */
  private async addKeywords(
    adGroupResourceName: string,
    keywords: string[]
  ): Promise<void> {
    const operations = keywords.map((keyword) => ({
      create: {
        adGroup: adGroupResourceName,
        status: 'ENABLED',
        keyword: {
          text: keyword,
          matchType: 'BROAD',
        },
      },
    }));

    await this.makeApiRequest('adGroupCriteria:mutate', 'POST', {
      operations,
    });
  }

  /**
   * Apply targeting to a campaign
   */
  private async applyTargeting(
    campaignResourceName: string,
    targeting: {
      keywords?: string[];
      locations?: string[];
      demographics?: Record<string, unknown>;
      audiences?: string[];
    }
  ): Promise<void> {
    // Location targeting
    if (targeting.locations && targeting.locations.length > 0) {
      await this.addLocationTargeting(campaignResourceName, targeting.locations);
    }

    // Note: Keywords are typically added at the ad group level
    // Demographics and audiences require additional setup
  }

  /**
   * Add location targeting to a campaign
   */
  private async addLocationTargeting(
    campaignResourceName: string,
    locations: string[]
  ): Promise<void> {
    // This is a simplified implementation
    // In production, you would need to map location names to Google Ads location IDs
    const operations = locations.map((location) => ({
      create: {
        campaign: campaignResourceName,
        // You would need to look up the proper location criterion ID
        location: {
          geoTargetConstant: `geoTargetConstants/${location}`,
        },
      },
    }));

    await this.makeApiRequest('campaignCriteria:mutate', 'POST', {
      operations,
    });
  }

  /**
   * Map campaign type to Google Ads API enum
   */
  private mapCampaignType(type: string): string {
    const mapping: Record<string, string> = {
      search: 'SEARCH',
      display: 'DISPLAY',
      video: 'VIDEO',
      shopping: 'SHOPPING',
    };
    return mapping[type] || 'SEARCH';
  }

  /**
   * Map campaign status to Google Ads API enum
   */
  private mapCampaignStatus(status: string): string {
    const mapping: Record<string, string> = {
      active: 'ENABLED',
      paused: 'PAUSED',
      removed: 'REMOVED',
    };
    return mapping[status] || 'PAUSED';
  }

  /**
   * Format date for Google Ads API (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Extract ID from Google Ads resource name
   */
  private extractIdFromResourceName(resourceName: string): string | null {
    const match = resourceName?.match(/\/(\d+)$/);
    return match ? match[1] : null;
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

      // Query usage from connector_usage table or similar
      const { count } = await supabase
        .from('connector_usage')
        .select('*', { count: 'exact', head: true })
        .eq('connector_id', this.config.id)
        .gte('created_at', windowStart);

      const used = count || 0;
      const limit =
        timeWindow === 'hour'
          ? this.config.rateLimit?.perHour || 1000
          : this.config.rateLimit?.perDay || 10000;

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

      // Record usage event
      await supabase.from('connector_usage').insert({
        connector_id: this.config.id,
        task_id: taskId,
        created_at: new Date().toISOString(),
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
 * Factory function to create a GoogleAdsConnector instance
 */
export async function createGoogleAdsConnector(
  connectorId: string
): Promise<GoogleAdsConnector> {
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

  return new GoogleAdsConnector({
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
