/**
 * Clearbit Reveal Connector for Website Visitor Identification
 *
 * Uses Clearbit Reveal API to identify companies visiting your website
 * based on their IP address. Returns enriched company data.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { BaseConnector, ConnectorConfig, ConnectorResult, ConnectorStatus } from '../base';

export type VisitorConnectorType = 'visitor_identification';

export interface VisitorConnectorConfig extends ConnectorConfig {
  type: VisitorConnectorType;
}

interface ClearbitCredentials {
  apiKey: string;
}

interface ClearbitConfig {
  enrichCompanyData?: boolean;
  cacheResults?: boolean;
  cacheDurationHours?: number;
}

// Clearbit Company Reveal Response
export interface ClearbitRevealResponse {
  ip: string;
  fuzzy: boolean;
  domain: string | null;
  type: 'company' | 'isp' | 'education' | 'government' | null;
  company: ClearbitCompany | null;
  geoIP: {
    city: string;
    state: string;
    stateCode: string;
    country: string;
    countryCode: string;
  };
}

export interface ClearbitCompany {
  id: string;
  name: string;
  legalName: string | null;
  domain: string;
  domainAliases: string[];
  site: {
    phoneNumbers: string[];
    emailAddresses: string[];
  };
  category: {
    sector: string;
    industryGroup: string;
    industry: string;
    subIndustry: string;
    sicCode: string;
    naicsCode: string;
  };
  tags: string[];
  description: string;
  foundedYear: number | null;
  location: string;
  timeZone: string;
  utcOffset: number;
  geo: {
    streetNumber: string;
    streetName: string;
    subPremise: string;
    city: string;
    state: string;
    stateCode: string;
    postalCode: string;
    country: string;
    countryCode: string;
    lat: number;
    lng: number;
  };
  logo: string;
  facebook: {
    handle: string;
    likes: number;
  } | null;
  linkedin: {
    handle: string;
  } | null;
  twitter: {
    handle: string;
    id: string;
    bio: string;
    followers: number;
    following: number;
    location: string;
    site: string;
    avatar: string;
  } | null;
  crunchbase: {
    handle: string;
  } | null;
  emailProvider: boolean;
  type: 'public' | 'private' | 'nonprofit' | 'government' | 'education';
  ticker: string | null;
  identifiers: {
    usEIN: string | null;
  };
  phone: string;
  metrics: {
    alexaUsRank: number | null;
    alexaGlobalRank: number | null;
    trafficRank: string | null;
    employees: number | null;
    employeesRange: string | null;
    marketCap: number | null;
    raised: number | null;
    annualRevenue: number | null;
    estimatedAnnualRevenue: string | null;
    fiscalYearEnd: number | null;
  };
  indexedAt: string;
  tech: string[];
  techCategories: string[];
  parent: {
    domain: string;
  } | null;
  ultimateParent: {
    domain: string;
  } | null;
}

// Enrichment Response (when looking up by domain)
export interface ClearbitEnrichmentResponse {
  id: string;
  name: string;
  legalName: string | null;
  domain: string;
  // Same fields as ClearbitCompany
  [key: string]: unknown;
}

export interface VisitorIdentificationResult {
  identified: boolean;
  companyDomain?: string;
  companyName?: string;
  companyLogoUrl?: string;
  enrichmentData?: Record<string, unknown>;
  geoData?: {
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
  };
  type?: 'company' | 'isp' | 'education' | 'government' | null;
  fuzzy?: boolean;
}

export class ClearbitConnector extends BaseConnector {
  private credentials: ClearbitCredentials;
  private connectorConfig: ClearbitConfig;
  private apiBaseUrl = 'https://reveal.clearbit.com';
  private enrichmentUrl = 'https://company.clearbit.com';
  private rateLimitRemaining = 600;
  private rateLimitReset: Date = new Date();

  constructor(config: VisitorConnectorConfig) {
    super(config);

    this.credentials = {
      apiKey: config.credentials.apiKey as string,
    };

    this.connectorConfig = config.config as ClearbitConfig;

    if (!this.credentials.apiKey) {
      throw new Error('Clearbit API key is required');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test with a known public IP (Google DNS)
      const response = await this.identifyVisitor('8.8.8.8');
      // If we get a response (even without company data), connection works
      return true;
    } catch (error: any) {
      // 401/403 means bad credentials
      if (error.message.includes('401') || error.message.includes('403')) {
        return false;
      }
      // Other errors might still mean connection works but IP wasn't identified
      return true;
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

    if (!config.apiKey || typeof config.apiKey !== 'string') {
      errors.push('Clearbit API key is required');
    }

    // Validate API key format (starts with sk_)
    if (config.apiKey && !String(config.apiKey).startsWith('sk_')) {
      errors.push('Invalid Clearbit API key format');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Identify a website visitor by their IP address
   */
  async identifyVisitor(ipAddress: string): Promise<VisitorIdentificationResult> {
    try {
      // Skip private/local IPs
      if (this.isPrivateIP(ipAddress)) {
        return { identified: false };
      }

      const response = await this.makeRequest<ClearbitRevealResponse>(
        `${this.apiBaseUrl}/v1/companies/find?ip=${encodeURIComponent(ipAddress)}`
      );

      if (!response.company) {
        return {
          identified: false,
          geoData: response.geoIP ? {
            city: response.geoIP.city,
            state: response.geoIP.state,
            country: response.geoIP.country,
            countryCode: response.geoIP.countryCode,
          } : undefined,
          type: response.type,
        };
      }

      const company = response.company;

      return {
        identified: true,
        companyDomain: company.domain,
        companyName: company.name,
        companyLogoUrl: company.logo,
        enrichmentData: this.formatEnrichmentData(company),
        geoData: response.geoIP ? {
          city: response.geoIP.city,
          state: response.geoIP.state,
          country: response.geoIP.country,
          countryCode: response.geoIP.countryCode,
        } : undefined,
        type: response.type,
        fuzzy: response.fuzzy,
      };
    } catch (error: any) {
      console.error('Clearbit identify error:', error);
      throw error;
    }
  }

  /**
   * Enrich company data by domain
   */
  async enrichCompany(domain: string): Promise<ClearbitCompany | null> {
    try {
      const response = await this.makeRequest<ClearbitCompany>(
        `${this.enrichmentUrl}/v2/companies/find?domain=${encodeURIComponent(domain)}`
      );

      return response;
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Format enrichment data for storage
   */
  private formatEnrichmentData(company: ClearbitCompany): Record<string, unknown> {
    return {
      // Basic info
      name: company.name,
      domain: company.domain,
      description: company.description,
      logoUrl: company.logo,

      // Industry classification
      industry: company.category?.industry,
      subIndustry: company.category?.subIndustry,
      sector: company.category?.sector,
      industryGroup: company.category?.industryGroup,
      tags: company.tags,

      // Size metrics
      employeeCount: company.metrics?.employees,
      employeeRange: company.metrics?.employeesRange,
      annualRevenue: company.metrics?.annualRevenue,
      estimatedAnnualRevenue: company.metrics?.estimatedAnnualRevenue,
      raised: company.metrics?.raised,
      marketCap: company.metrics?.marketCap,

      // Company details
      foundedYear: company.foundedYear,
      type: company.type,
      ticker: company.ticker,

      // Location
      location: company.location,
      geo: company.geo ? {
        city: company.geo.city,
        state: company.geo.state,
        stateCode: company.geo.stateCode,
        country: company.geo.country,
        countryCode: company.geo.countryCode,
        postalCode: company.geo.postalCode,
      } : undefined,

      // Social profiles
      linkedinUrl: company.linkedin?.handle
        ? `https://linkedin.com/company/${company.linkedin.handle}`
        : undefined,
      twitterHandle: company.twitter?.handle,
      twitterFollowers: company.twitter?.followers,
      facebookHandle: company.facebook?.handle,

      // Technology
      techStack: company.tech,
      techCategories: company.techCategories,

      // Contact
      phone: company.phone,

      // Rankings
      alexaGlobalRank: company.metrics?.alexaGlobalRank,
      trafficRank: company.metrics?.trafficRank,

      // Parent company
      parentDomain: company.parent?.domain,
      ultimateParentDomain: company.ultimateParent?.domain,

      // Metadata
      clearbitId: company.id,
      indexedAt: company.indexedAt,
    };
  }

  /**
   * Check if IP is private/local
   */
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);

    // 10.x.x.x
    if (parts[0] === 10) return true;

    // 172.16.x.x - 172.31.x.x
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.x.x
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 127.x.x.x (localhost)
    if (parts[0] === 127) return true;

    // 0.0.0.0
    if (ip === '0.0.0.0') return true;

    return false;
  }

  /**
   * Make authenticated request to Clearbit API
   */
  private async makeRequest<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Update rate limits
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');

    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitReset = new Date(parseInt(reset, 10) * 1000);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Clearbit API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

/**
 * Factory function to create a ClearbitConnector instance
 */
export async function createClearbitConnector(
  connectorId: string
): Promise<ClearbitConnector> {
  const supabase = createAdminClient();

  const { data: connector, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .single();

  if (error || !connector) {
    throw new Error(`Clearbit connector not found: ${connectorId}`);
  }

  return new ClearbitConnector({
    id: connector.id,
    organizationId: connector.organization_id,
    type: 'visitor_identification',
    name: connector.name,
    credentials: connector.credentials as Record<string, unknown>,
    config: connector.config as Record<string, unknown>,
    active: connector.active,
    rateLimit: {
      perHour: connector.rate_limit_per_hour || 600,
      perDay: connector.rate_limit_per_day || 10000,
    },
  });
}

/**
 * Create Clearbit connector from tracking script configuration
 */
export async function createClearbitConnectorFromScript(
  trackingScriptId: string
): Promise<ClearbitConnector> {
  const supabase = createAdminClient();

  // Get the tracking script
  const { data: script, error: scriptError } = await supabase
    .from('tracking_scripts')
    .select('*, organization_id')
    .eq('id', trackingScriptId)
    .single();

  if (scriptError || !script) {
    throw new Error(`Tracking script not found: ${trackingScriptId}`);
  }

  // Get API key from Vault
  const providerConfig = script.provider_config as Record<string, unknown>;
  const apiKeyVaultId = providerConfig?.api_key_vault_id as string;

  if (!apiKeyVaultId) {
    throw new Error('Clearbit API key not configured for tracking script');
  }

  // Retrieve API key from Vault
  const { data: vaultData, error: vaultError } = await supabase
    .rpc('vault_read_secret', { secret_id: apiKeyVaultId });

  if (vaultError || !vaultData) {
    throw new Error('Failed to retrieve Clearbit API key from Vault');
  }

  return new ClearbitConnector({
    id: trackingScriptId,
    organizationId: script.organization_id,
    type: 'visitor_identification',
    name: script.name,
    credentials: {
      apiKey: vaultData,
    },
    config: providerConfig,
    active: script.active,
    rateLimit: {
      perHour: 600,
      perDay: 10000,
    },
  });
}
