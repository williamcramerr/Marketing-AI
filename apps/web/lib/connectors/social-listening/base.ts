/**
 * Base interface for Social Listening Connectors
 *
 * These connectors search for conversations on social platforms
 * rather than posting content. Used for discovering potential customers.
 */

import { BaseConnector, ConnectorConfig, ConnectorStatus } from '../base';

export interface SocialListeningConfig extends ConnectorConfig {
  type: 'social_listening';
}

export interface SearchQuery {
  keywords: string[];
  negativeKeywords?: string[];
  language?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}

export interface DiscoveredConversation {
  platform: 'twitter' | 'reddit' | 'linkedin';
  externalId: string;
  externalUrl: string;

  // Author info
  authorUsername: string;
  authorDisplayName?: string;
  authorProfileUrl?: string;
  authorFollowers?: number;

  // Content
  content: string;
  parentContent?: string;
  parentExternalId?: string;

  // Platform-specific metadata
  platformMetadata: Record<string, unknown>;

  // Timestamps
  publishedAt: Date;
  discoveredAt: Date;
}

export interface SearchResult {
  conversations: DiscoveredConversation[];
  nextCursor?: string;
  hasMore: boolean;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}

/**
 * Base class for Social Listening connectors
 */
export abstract class SocialListeningConnector extends BaseConnector {
  constructor(config: SocialListeningConfig) {
    super(config);
  }

  /**
   * Search for conversations matching the query
   */
  abstract search(query: SearchQuery, cursor?: string): Promise<SearchResult>;

  /**
   * Get details for a specific conversation
   */
  abstract getConversation(externalId: string): Promise<DiscoveredConversation | null>;

  /**
   * Get replies/engagement on a conversation
   */
  abstract getEngagement(externalId: string): Promise<{
    likes: number;
    replies: number;
    shares: number;
    impressions?: number;
  }>;

  /**
   * Post a reply to a conversation (if enabled)
   */
  abstract postReply(params: {
    conversationExternalId: string;
    content: string;
  }): Promise<{
    success: boolean;
    replyExternalId?: string;
    replyUrl?: string;
    error?: string;
  }>;

  /**
   * Get the platform name
   */
  abstract getPlatform(): 'twitter' | 'reddit' | 'linkedin';
}
