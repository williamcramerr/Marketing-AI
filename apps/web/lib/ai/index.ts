/**
 * AI Content Generation System
 *
 * Main export file for the Marketing Pilot AI content generation system.
 * This provides easy access to all AI-related functionality.
 */

// Client exports
export {
  anthropic,
  DEFAULT_MODEL,
  DEFAULT_MESSAGE_PARAMS,
  MODELS,
  TEMPERATURE_PRESETS,
  createMessageParams,
  handleAnthropicError,
} from './client';

export type { MessageContent, MessageResponse } from './client';

// Content writer exports
export {
  generateBlogPost,
  generateEmailContent,
  generateSocialPost,
  generateLandingPage,
  reviseContent,
  generateBatch,
} from './content-writer';

export type {
  BlogPostOutput,
  EmailContentOutput,
  SocialPostOutput,
  LandingPageOutput,
  BlogPostParams,
  EmailContentParams,
  SocialPostParams,
  LandingPageParams,
  RevisionParams,
  ProductContext,
  AudienceContext,
} from './content-writer';

// Prompt exports (for advanced usage)
export {
  BASE_SYSTEM_PROMPT,
  BLOG_POST_PROMPT,
  EMAIL_CONTENT_PROMPT,
  SOCIAL_POST_PROMPT,
  LANDING_PAGE_PROMPT,
  REVISION_PROMPT,
  buildProductContext,
  buildAudienceContext,
} from './prompts';

// Usage tracking exports
export {
  calculateCost,
  checkUsageLimits,
  recordAIUsage,
  createMessageWithTracking,
  AIUsageLimitError,
  getOrganizationUsageStats,
  checkUsageWarningLevel,
} from './usage-tracker';

export type {
  TrackedMessageParams,
  TrackedMessageResult,
} from './usage-tracker';
