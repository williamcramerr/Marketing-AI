/**
 * Anthropic Claude AI Client Configuration
 *
 * This module provides a configured Anthropic client instance for use across
 * the application. It uses the ANTHROPIC_API_KEY environment variable for
 * authentication.
 */

import Anthropic from '@anthropic-ai/sdk';

// Validate that the API key is present
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error(
    'Missing ANTHROPIC_API_KEY environment variable. Please add it to your .env.local file.'
  );
}

/**
 * Configured Anthropic client instance
 *
 * Uses Claude 3.5 Sonnet by default for all content generation tasks.
 * This model provides an excellent balance of quality, speed, and cost.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Default model configuration
 */
export const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

/**
 * Default message parameters for content generation
 */
export const DEFAULT_MESSAGE_PARAMS = {
  model: DEFAULT_MODEL,
  max_tokens: 4096,
  temperature: 0.7,
} as const;

/**
 * Model variants for different use cases
 */
export const MODELS = {
  // Claude 3.5 Sonnet - Best for content generation (default)
  SONNET: 'claude-3-5-sonnet-20241022',

  // Claude 3 Opus - Most capable for complex tasks (if needed in future)
  OPUS: 'claude-3-opus-20240229',

  // Claude 3 Haiku - Fastest for simple tasks (if needed in future)
  HAIKU: 'claude-3-haiku-20240307',
} as const;

/**
 * Temperature presets for different content types
 */
export const TEMPERATURE_PRESETS = {
  // More creative for marketing content
  CREATIVE: 0.8,

  // Balanced for general content
  BALANCED: 0.7,

  // More focused for technical or factual content
  FOCUSED: 0.5,

  // Most deterministic for structured outputs
  DETERMINISTIC: 0.3,
} as const;

/**
 * Helper function to create message parameters with custom overrides
 */
export function createMessageParams<T extends { messages: Anthropic.MessageParam[]; system?: string; temperature?: number }>(
  overrides: T
): typeof DEFAULT_MESSAGE_PARAMS & T {
  return {
    ...DEFAULT_MESSAGE_PARAMS,
    ...overrides,
  };
}

/**
 * Helper function to safely handle API errors
 */
export function handleAnthropicError(error: unknown): never {
  if (error instanceof Anthropic.APIError) {
    console.error('Anthropic API Error:', {
      status: error.status,
      message: error.message,
    });

    // Provide user-friendly error messages
    switch (error.status) {
      case 401:
        throw new Error('Invalid API key. Please check your ANTHROPIC_API_KEY.');
      case 429:
        throw new Error('Rate limit exceeded. Please try again later.');
      case 500:
      case 529:
        throw new Error('Anthropic service is temporarily unavailable. Please try again.');
      default:
        throw new Error(`AI service error: ${error.message}`);
    }
  }

  // Re-throw unknown errors
  throw error;
}

/**
 * Type for message content from Anthropic
 */
export type MessageContent = Anthropic.Messages.MessageParam;

/**
 * Type for message response from Anthropic
 */
export type MessageResponse = Anthropic.Messages.Message;

export default anthropic;
