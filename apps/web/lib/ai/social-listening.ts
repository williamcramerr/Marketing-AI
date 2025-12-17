/**
 * AI Social Listening Module
 *
 * Analyzes social media conversations to identify opportunities
 * and generates helpful, non-spammy responses.
 */

import {
  anthropic,
  createMessageParams,
  handleAnthropicError,
  TEMPERATURE_PRESETS,
} from './client';
import { buildProductContext, ProductContext } from './prompts';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ConversationAnalysis {
  isOpportunity: boolean;
  intentScore: number; // 0-100
  intentLevel: 'low' | 'medium' | 'high';
  opportunityType:
    | 'recommendation_request'
    | 'problem_statement'
    | 'question'
    | 'comparison'
    | 'complaint'
    | 'praise'
    | 'other';
  relevanceScore: number; // 0-100
  reasoning: string;
  keywordsMatched: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  topics: string[];
  suggestedResponse: string;
  responseApproach:
    | 'helpful_info'
    | 'share_experience'
    | 'ask_question'
    | 'direct_recommend'
    | 'skip';
  confidenceScore: number; // 0-100
}

export interface ConversationContext {
  platform: 'twitter' | 'reddit' | 'linkedin';
  content: string;
  parentContent?: string;
  authorUsername: string;
  authorFollowers?: number;
  subreddit?: string; // For Reddit
  platformMetadata?: Record<string, unknown>;
}

export interface ResponseGenerationParams {
  conversation: ConversationContext;
  product: ProductContext;
  analysis: ConversationAnalysis;
  responseGuidelines?: string;
  maxLength?: number;
  tone?: 'helpful' | 'casual' | 'professional' | 'friendly';
}

export interface GeneratedResponse {
  content: string;
  approach: string;
  reasoningForApproach: string;
  mentionsProduct: boolean;
  includesLink: boolean;
  suggestedLinkType?: 'docs' | 'landing' | 'blog' | 'pricing' | 'demo';
  alternativeResponses?: string[];
  warnings?: string[];
  characterCount: number;
}

// ============================================================================
// Prompts
// ============================================================================

const CONVERSATION_ANALYSIS_PROMPT = `You are an expert at analyzing social media conversations to identify sales and marketing opportunities. Your job is to analyze a conversation and determine if it's a genuine opportunity for engagement.

## Context
Platform: {platform}
Content: {content}
{parentContext}
Author: @{authorUsername} ({authorFollowers} followers)
{additionalContext}

## Product Being Promoted
{productContext}

## Keywords We're Tracking
{keywords}

## Your Task
Analyze this conversation and determine:
1. Is this a genuine opportunity to engage? (Not every mention is worth responding to)
2. What type of opportunity is this?
3. How relevant is it to our product?
4. What's the author's intent level (likelihood they'll take action)?
5. What's the best approach for responding (if we should respond)?

## Important Guidelines
- Only flag as an opportunity if responding would genuinely help the person
- Avoid opportunities where the person clearly prefers a competitor
- Be wary of spam, bots, or promotional content disguised as questions
- Consider the platform norms (Reddit values authenticity, Twitter is faster-paced)
- High-follower accounts may be more valuable but also more scrutinized

Return your analysis as JSON:
{
  "isOpportunity": boolean,
  "intentScore": number (0-100),
  "intentLevel": "low" | "medium" | "high",
  "opportunityType": "recommendation_request" | "problem_statement" | "question" | "comparison" | "complaint" | "praise" | "other",
  "relevanceScore": number (0-100),
  "reasoning": "explanation of your analysis",
  "keywordsMatched": ["keyword1", "keyword2"],
  "sentiment": "positive" | "neutral" | "negative",
  "topics": ["topic1", "topic2"],
  "suggestedResponse": "brief suggestion for how to respond",
  "responseApproach": "helpful_info" | "share_experience" | "ask_question" | "direct_recommend" | "skip",
  "confidenceScore": number (0-100)
}`;

const RESPONSE_GENERATION_PROMPT = `You are a helpful community member who genuinely wants to help people solve their problems. You happen to work at a company that makes a relevant product, but your primary goal is to be helpful, not to sell.

## Original Conversation
Platform: {platform}
Post: {content}
{parentContext}
Author: @{authorUsername}
{additionalContext}

## Our Analysis
Opportunity Type: {opportunityType}
Intent Level: {intentLevel}
Recommended Approach: {responseApproach}

## Our Product
{productContext}

## Response Guidelines
- Be genuinely helpful first, promotional second (or not at all)
- Match the platform's tone and norms:
  - Twitter: Concise, direct, can be casual
  - Reddit: Detailed, authentic, avoid obvious shilling
  - LinkedIn: Professional but personable
- {customGuidelines}
- Maximum length: {maxLength} characters
- Tone: {tone}

## What NOT to Do
- Don't be pushy or salesy
- Don't use corporate jargon or marketing speak
- Don't include links unless specifically asked or highly relevant
- Don't mention the product if it's not clearly relevant
- Don't respond if a skip would be more appropriate

## Your Task
Generate a response that would genuinely help this person. If appropriate, you may mention our product, but only if it would naturally fit the conversation and help answer their question.

Return as JSON:
{
  "content": "your response text",
  "approach": "description of the approach taken",
  "reasoningForApproach": "why this approach works for this situation",
  "mentionsProduct": boolean,
  "includesLink": boolean,
  "suggestedLinkType": "docs" | "landing" | "blog" | "pricing" | "demo" | null,
  "alternativeResponses": ["alternative 1", "alternative 2"],
  "warnings": ["any concerns about posting this response"],
  "characterCount": number
}`;

// ============================================================================
// Helper Functions
// ============================================================================

function parseJsonResponse<T>(content: string): T {
  // Extract JSON from markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonString = jsonMatch ? jsonMatch[1] : content;

  try {
    return JSON.parse(jsonString.trim()) as T;
  } catch (error) {
    // Try to find JSON object in the response
    const objectMatch = jsonString.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]) as T;
    }
    throw new Error(`Failed to parse AI response as JSON: ${error}`);
  }
}

function buildConversationContext(conversation: ConversationContext): string {
  let context = '';

  if (conversation.parentContent) {
    context += `\nParent Post/Context: ${conversation.parentContent}`;
  }

  if (conversation.subreddit) {
    context += `\nSubreddit: r/${conversation.subreddit}`;
  }

  if (conversation.platformMetadata) {
    const meta = conversation.platformMetadata;
    if (meta.score) context += `\nScore: ${meta.score}`;
    if (meta.numComments) context += `\nComments: ${meta.numComments}`;
    if (meta.likeCount) context += `\nLikes: ${meta.likeCount}`;
    if (meta.replyCount) context += `\nReplies: ${meta.replyCount}`;
  }

  return context;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Analyze a social media conversation for opportunities
 */
export async function analyzeConversation(
  conversation: ConversationContext,
  product: ProductContext,
  keywords: string[]
): Promise<ConversationAnalysis> {
  try {
    const prompt = CONVERSATION_ANALYSIS_PROMPT
      .replace('{platform}', conversation.platform)
      .replace('{content}', conversation.content)
      .replace(
        '{parentContext}',
        conversation.parentContent
          ? `Parent Context: ${conversation.parentContent}`
          : ''
      )
      .replace('{authorUsername}', conversation.authorUsername)
      .replace(
        '{authorFollowers}',
        conversation.authorFollowers?.toString() || 'unknown'
      )
      .replace('{additionalContext}', buildConversationContext(conversation))
      .replace('{productContext}', buildProductContext(product))
      .replace('{keywords}', keywords.join(', '));

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.FOCUSED,
        max_tokens: 1500,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<ConversationAnalysis>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Generate a response for a social media conversation
 */
export async function generateResponse(
  params: ResponseGenerationParams
): Promise<GeneratedResponse> {
  try {
    const { conversation, product, analysis, responseGuidelines, maxLength, tone } =
      params;

    // Determine max length based on platform
    const platformMaxLengths = {
      twitter: 280,
      reddit: 2000,
      linkedin: 1500,
    };

    const effectiveMaxLength =
      maxLength || platformMaxLengths[conversation.platform] || 1000;

    const prompt = RESPONSE_GENERATION_PROMPT
      .replace('{platform}', conversation.platform)
      .replace('{content}', conversation.content)
      .replace(
        '{parentContext}',
        conversation.parentContent
          ? `Parent Context: ${conversation.parentContent}`
          : ''
      )
      .replace('{authorUsername}', conversation.authorUsername)
      .replace('{additionalContext}', buildConversationContext(conversation))
      .replace('{opportunityType}', analysis.opportunityType)
      .replace('{intentLevel}', analysis.intentLevel)
      .replace('{responseApproach}', analysis.responseApproach)
      .replace('{productContext}', buildProductContext(product))
      .replace('{customGuidelines}', responseGuidelines || 'No additional guidelines')
      .replace('{maxLength}', effectiveMaxLength.toString())
      .replace('{tone}', tone || 'helpful');

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.CREATIVE,
        max_tokens: 2000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<GeneratedResponse>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Batch analyze multiple conversations
 */
export async function batchAnalyzeConversations(
  conversations: ConversationContext[],
  product: ProductContext,
  keywords: string[]
): Promise<Map<string, ConversationAnalysis>> {
  const results = new Map<string, ConversationAnalysis>();

  // Process in parallel with rate limiting
  const batchSize = 5;
  for (let i = 0; i < conversations.length; i += batchSize) {
    const batch = conversations.slice(i, i + batchSize);
    const batchPromises = batch.map(async (conv, index) => {
      const key = `${conv.platform}_${index}`;
      try {
        const analysis = await analyzeConversation(conv, product, keywords);
        results.set(key, analysis);
      } catch (error) {
        console.error(`Error analyzing conversation ${key}:`, error);
      }
    });

    await Promise.all(batchPromises);

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < conversations.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * Score a conversation for prioritization
 */
export function calculatePriorityScore(analysis: ConversationAnalysis): number {
  if (!analysis.isOpportunity) {
    return 0;
  }

  // Weighted scoring
  const intentWeight = 0.4;
  const relevanceWeight = 0.35;
  const confidenceWeight = 0.25;

  // Intent score multiplier based on level
  const intentMultiplier = {
    low: 0.5,
    medium: 0.75,
    high: 1.0,
  };

  const intentScore = analysis.intentScore * intentMultiplier[analysis.intentLevel];

  // Calculate weighted score
  const score =
    intentScore * intentWeight +
    analysis.relevanceScore * relevanceWeight +
    analysis.confidenceScore * confidenceWeight;

  // Boost for certain opportunity types
  const typeBoost = {
    recommendation_request: 1.2,
    problem_statement: 1.15,
    comparison: 1.1,
    question: 1.0,
    complaint: 0.9,
    praise: 0.7,
    other: 0.8,
  };

  return Math.round(score * typeBoost[analysis.opportunityType]);
}

/**
 * Filter and sort conversations by opportunity quality
 */
export function filterAndSortOpportunities(
  analysisResults: Map<string, ConversationAnalysis>,
  minScore: number = 50
): Array<{ key: string; analysis: ConversationAnalysis; priorityScore: number }> {
  const opportunities: Array<{
    key: string;
    analysis: ConversationAnalysis;
    priorityScore: number;
  }> = [];

  for (const [key, analysis] of analysisResults) {
    if (analysis.isOpportunity) {
      const priorityScore = calculatePriorityScore(analysis);
      if (priorityScore >= minScore) {
        opportunities.push({ key, analysis, priorityScore });
      }
    }
  }

  // Sort by priority score descending
  return opportunities.sort((a, b) => b.priorityScore - a.priorityScore);
}
