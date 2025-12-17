/**
 * SerpApi Connector for SEO Research
 *
 * Uses SerpApi to fetch Google search results for keyword research,
 * SERP analysis, and rank tracking.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { BaseConnector, ConnectorConfig, ConnectorStatus } from '../base';

export type SEOConnectorType = 'seo';

export interface SEOConnectorConfig extends ConnectorConfig {
  type: SEOConnectorType;
}

interface SerpApiCredentials {
  apiKey: string;
}

interface SerpApiConfig {
  defaultLocation?: string;
  defaultLanguage?: string;
  defaultDevice?: 'desktop' | 'mobile' | 'tablet';
  defaultSearchEngine?: 'google' | 'bing' | 'yahoo';
}

// SERP Result Types
export interface OrganicResult {
  position: number;
  title: string;
  link: string;
  displayedLink: string;
  snippet: string;
  snippetHighlightedWords?: string[];
  sitelinks?: {
    inline?: Array<{ title: string; link: string }>;
    expanded?: Array<{ title: string; link: string; snippet: string }>;
  };
  cachedPageLink?: string;
  relatedPagesLink?: string;
  date?: string;
}

export interface RelatedQuestion {
  question: string;
  snippet?: string;
  title?: string;
  link?: string;
  displayedLink?: string;
}

export interface RelatedSearch {
  query: string;
  link: string;
}

export interface FeaturedSnippet {
  type: 'paragraph' | 'list' | 'table';
  content: string;
  title?: string;
  link?: string;
}

export interface LocalResult {
  position: number;
  title: string;
  address: string;
  rating?: number;
  reviews?: number;
  type?: string;
  phone?: string;
  website?: string;
}

export interface SerpApiSearchResponse {
  search_metadata: {
    id: string;
    status: string;
    json_endpoint: string;
    created_at: string;
    processed_at: string;
    google_url: string;
    raw_html_file: string;
    total_time_taken: number;
  };
  search_parameters: {
    engine: string;
    q: string;
    location_requested?: string;
    location_used?: string;
    google_domain: string;
    hl: string;
    gl: string;
    device: string;
  };
  search_information: {
    organic_results_state: string;
    query_displayed: string;
    total_results?: number;
    time_taken_displayed?: number;
  };
  organic_results?: OrganicResult[];
  related_questions?: RelatedQuestion[];
  related_searches?: RelatedSearch[];
  answer_box?: {
    type: string;
    title?: string;
    link?: string;
    snippet?: string;
    snippet_highlighted_words?: string[];
    list?: string[];
    table?: string[][];
  };
  knowledge_graph?: {
    title: string;
    type: string;
    description?: string;
    source?: { name: string; link: string };
    kgmid?: string;
  };
  local_results?: {
    places: LocalResult[];
  };
  ads?: Array<{
    position: number;
    title: string;
    link: string;
    displayed_link: string;
    description: string;
  }>;
  pagination?: {
    current: number;
    next?: string;
    other_pages?: Record<string, string>;
  };
}

export interface KeywordData {
  keyword: string;
  searchVolume?: number;
  cpc?: number;
  competition?: number;
  competitionLevel?: 'low' | 'medium' | 'high';
  trend?: number[];
}

export interface SerpAnalysis {
  keyword: string;
  organicResults: OrganicResult[];
  relatedQuestions: RelatedQuestion[];
  relatedSearches: string[];
  featuredSnippet?: FeaturedSnippet;
  hasLocalPack: boolean;
  hasKnowledgePanel: boolean;
  hasAds: boolean;
  totalResults?: number;
  avgWordCount?: number;
  topDomains: string[];
}

export interface RankCheckResult {
  keyword: string;
  url: string;
  position: number | null;
  page: number | null;
  foundUrl?: string;
  competitorPositions?: Record<string, number>;
}

export class SerpApiConnector extends BaseConnector {
  private credentials: SerpApiCredentials;
  private connectorConfig: SerpApiConfig;
  private apiBaseUrl = 'https://serpapi.com/search';
  private accountUrl = 'https://serpapi.com/account';

  constructor(config: SEOConnectorConfig) {
    super(config);

    this.credentials = {
      apiKey: config.credentials.apiKey as string,
    };

    this.connectorConfig = config.config as SerpApiConfig;

    if (!this.credentials.apiKey) {
      throw new Error('SerpApi API key is required');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.accountUrl}?api_key=${this.credentials.apiKey}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<ConnectorStatus> {
    if (!this.config.active) {
      return 'inactive';
    }

    try {
      // Check account status and remaining searches
      const response = await fetch(
        `${this.accountUrl}?api_key=${this.credentials.apiKey}`
      );

      if (!response.ok) {
        return 'error';
      }

      const account = await response.json();

      // Check if we have searches remaining
      if (account.plan_searches_left <= 0) {
        return 'rate_limited';
      }

      return 'active';
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
      errors.push('SerpApi API key is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Search Google and return SERP results
   */
  async search(params: {
    keyword: string;
    location?: string;
    language?: string;
    device?: 'desktop' | 'mobile' | 'tablet';
    numResults?: number;
  }): Promise<SerpApiSearchResponse> {
    const searchParams = new URLSearchParams({
      api_key: this.credentials.apiKey,
      engine: 'google',
      q: params.keyword,
      location: params.location || this.connectorConfig.defaultLocation || 'United States',
      hl: params.language || this.connectorConfig.defaultLanguage || 'en',
      gl: 'us',
      device: params.device || this.connectorConfig.defaultDevice || 'desktop',
      num: (params.numResults || 100).toString(),
    });

    const response = await fetch(`${this.apiBaseUrl}?${searchParams.toString()}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SerpApi error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Get related keywords for a seed keyword
   */
  async getRelatedKeywords(keyword: string): Promise<string[]> {
    const searchResults = await this.search({ keyword, numResults: 10 });

    const relatedKeywords: string[] = [];

    // Extract from related searches
    if (searchResults.related_searches) {
      relatedKeywords.push(
        ...searchResults.related_searches.map(rs => rs.query)
      );
    }

    // Extract from People Also Ask
    if (searchResults.related_questions) {
      relatedKeywords.push(
        ...searchResults.related_questions.map(rq => rq.question)
      );
    }

    return [...new Set(relatedKeywords)];
  }

  /**
   * Analyze SERP for a keyword
   */
  async analyzeSERP(keyword: string): Promise<SerpAnalysis> {
    const searchResults = await this.search({ keyword, numResults: 20 });

    const organicResults = searchResults.organic_results || [];

    // Extract featured snippet if present
    let featuredSnippet: FeaturedSnippet | undefined;
    if (searchResults.answer_box) {
      featuredSnippet = {
        type: searchResults.answer_box.type === 'organic_result'
          ? 'paragraph'
          : searchResults.answer_box.list
            ? 'list'
            : searchResults.answer_box.table
              ? 'table'
              : 'paragraph',
        content: searchResults.answer_box.snippet ||
          searchResults.answer_box.list?.join('\n') ||
          JSON.stringify(searchResults.answer_box.table) ||
          '',
        title: searchResults.answer_box.title,
        link: searchResults.answer_box.link,
      };
    }

    // Extract unique domains
    const topDomains = [...new Set(
      organicResults.slice(0, 10).map(r => {
        try {
          return new URL(r.link).hostname;
        } catch {
          return r.displayedLink;
        }
      })
    )];

    return {
      keyword,
      organicResults,
      relatedQuestions: searchResults.related_questions || [],
      relatedSearches: searchResults.related_searches?.map(rs => rs.query) || [],
      featuredSnippet,
      hasLocalPack: !!searchResults.local_results?.places?.length,
      hasKnowledgePanel: !!searchResults.knowledge_graph,
      hasAds: !!searchResults.ads?.length,
      totalResults: searchResults.search_information?.total_results,
      topDomains,
    };
  }

  /**
   * Check ranking position for a URL and keyword
   */
  async checkRanking(params: {
    keyword: string;
    url: string;
    competitors?: string[];
    maxPages?: number;
  }): Promise<RankCheckResult> {
    const maxPages = params.maxPages || 5;
    const targetDomain = this.extractDomain(params.url);

    let position: number | null = null;
    let page: number | null = null;
    let foundUrl: string | undefined;
    const competitorPositions: Record<string, number> = {};

    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      const searchParams = new URLSearchParams({
        api_key: this.credentials.apiKey,
        engine: 'google',
        q: params.keyword,
        location: this.connectorConfig.defaultLocation || 'United States',
        hl: this.connectorConfig.defaultLanguage || 'en',
        gl: 'us',
        device: this.connectorConfig.defaultDevice || 'desktop',
        num: '10',
        start: (pageNum * 10).toString(),
      });

      const response = await fetch(`${this.apiBaseUrl}?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error(`SerpApi error: ${response.status}`);
      }

      const results: SerpApiSearchResponse = await response.json();

      if (!results.organic_results) continue;

      for (const result of results.organic_results) {
        const resultDomain = this.extractDomain(result.link);

        // Check if this is our target URL
        if (position === null) {
          if (
            result.link === params.url ||
            result.link.includes(params.url) ||
            resultDomain === targetDomain
          ) {
            position = result.position;
            page = pageNum + 1;
            foundUrl = result.link;
          }
        }

        // Check competitor positions
        if (params.competitors) {
          for (const competitor of params.competitors) {
            const competitorDomain = this.extractDomain(competitor);
            if (
              !competitorPositions[competitor] &&
              resultDomain === competitorDomain
            ) {
              competitorPositions[competitor] = result.position;
            }
          }
        }
      }

      // If we found our position and all competitor positions, stop searching
      if (position !== null) {
        if (!params.competitors) break;
        if (params.competitors.every(c => competitorPositions[c])) break;
      }
    }

    return {
      keyword: params.keyword,
      url: params.url,
      position,
      page,
      foundUrl,
      competitorPositions: Object.keys(competitorPositions).length > 0
        ? competitorPositions
        : undefined,
    };
  }

  /**
   * Get autocomplete suggestions for a keyword
   */
  async getAutocompleteSuggestions(keyword: string): Promise<string[]> {
    const searchParams = new URLSearchParams({
      api_key: this.credentials.apiKey,
      engine: 'google_autocomplete',
      q: keyword,
    });

    const response = await fetch(`${this.apiBaseUrl}?${searchParams.toString()}`);

    if (!response.ok) {
      throw new Error(`SerpApi error: ${response.status}`);
    }

    const results = await response.json();

    return results.suggestions?.map((s: { value: string }) => s.value) || [];
  }

  /**
   * Get trending keywords for a topic
   */
  async getTrendingKeywords(keyword: string): Promise<string[]> {
    const searchParams = new URLSearchParams({
      api_key: this.credentials.apiKey,
      engine: 'google_trends',
      q: keyword,
      data_type: 'RELATED_QUERIES',
    });

    const response = await fetch(`${this.apiBaseUrl}?${searchParams.toString()}`);

    if (!response.ok) {
      throw new Error(`SerpApi error: ${response.status}`);
    }

    const results = await response.json();

    const keywords: string[] = [];

    // Extract rising queries
    if (results.related_queries?.rising) {
      keywords.push(
        ...results.related_queries.rising.map((q: { query: string }) => q.query)
      );
    }

    // Extract top queries
    if (results.related_queries?.top) {
      keywords.push(
        ...results.related_queries.top.map((q: { query: string }) => q.query)
      );
    }

    return [...new Set(keywords)];
  }

  /**
   * Get account usage statistics
   */
  async getUsageStats(_timeWindow: 'hour' | 'day'): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    try {
      const response = await fetch(
        `${this.accountUrl}?api_key=${this.credentials.apiKey}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch account info');
      }

      const account = await response.json();

      return {
        used: account.total_searches_this_month || 0,
        limit: account.plan_monthly_searches || Infinity,
        remaining: account.plan_searches_left || Infinity,
      };
    } catch {
      return {
        used: 0,
        limit: Infinity,
        remaining: Infinity,
      };
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.replace(/^www\./, '');
    }
  }
}

/**
 * Factory function to create a SerpApiConnector instance
 */
export async function createSerpApiConnector(
  connectorId: string
): Promise<SerpApiConnector> {
  const supabase = createAdminClient();

  const { data: connector, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .single();

  if (error || !connector) {
    throw new Error(`SerpApi connector not found: ${connectorId}`);
  }

  return new SerpApiConnector({
    id: connector.id,
    organizationId: connector.organization_id,
    type: 'seo',
    name: connector.name,
    credentials: connector.credentials as Record<string, unknown>,
    config: connector.config as Record<string, unknown>,
    active: connector.active,
    rateLimit: {
      perHour: connector.rate_limit_per_hour || 100,
      perDay: connector.rate_limit_per_day || 1000,
    },
  });
}
