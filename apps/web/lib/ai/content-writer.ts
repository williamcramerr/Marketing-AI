/**
 * AI Content Writer
 *
 * This module provides functions for generating different types of marketing content
 * using Claude AI. Each function is tailored to a specific content type and returns
 * structured JSON output.
 */

import {
  anthropic,
  createMessageParams,
  handleAnthropicError,
  TEMPERATURE_PRESETS,
} from './client';
import {
  BLOG_POST_PROMPT,
  EMAIL_CONTENT_PROMPT,
  SOCIAL_POST_PROMPT,
  LANDING_PAGE_PROMPT,
  REVISION_PROMPT,
  buildProductContext,
  buildAudienceContext,
  type ProductContext,
  type AudienceContext,
} from './prompts';

// ============================================================================
// Type Definitions for Generated Content
// ============================================================================

export interface BlogPostOutput {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  metadata: {
    metaDescription: string;
    keywords: string[];
    estimatedReadTime: number;
  };
  cta: {
    text: string;
    description: string;
  };
}

export interface EmailContentOutput {
  subject: string;
  previewText: string;
  headline: string;
  body: string;
  sections: Array<{
    type: 'hero' | 'content' | 'cta' | 'footer';
    content: string;
  }>;
  cta: {
    primary: {
      text: string;
      url: string;
    };
    secondary?: {
      text: string;
      url: string;
    };
  };
  metadata: {
    campaignType: 'promotional' | 'educational' | 'transactional' | 'nurture';
    tone: 'urgent' | 'friendly' | 'professional' | 'casual';
  };
}

export interface SocialPostOutput {
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  posts: Array<{
    text: string;
    hashtags: string[];
    characterCount: number;
  }>;
  mediaRecommendations: {
    type: 'image' | 'video' | 'carousel' | 'text-only';
    description: string;
    suggestions: string[];
  };
  metadata: {
    bestTimeToPost: string;
    expectedEngagement: 'high' | 'medium' | 'low';
    contentPillar: 'educational' | 'promotional' | 'entertaining' | 'inspirational';
  };
}

export interface LandingPageOutput {
  title: string;
  sections: {
    hero: {
      headline: string;
      subheadline: string;
      cta: {
        text: string;
        description: string;
      };
    };
    valueProposition: {
      headline: string;
      points: string[];
    };
    features: {
      headline: string;
      items: Array<{
        title: string;
        description: string;
        benefit: string;
      }>;
    };
    socialProof: {
      headline: string;
      testimonialPlaceholders: number;
      statsToHighlight: string[];
    };
    faq: {
      headline: string;
      questions: Array<{
        question: string;
        answer: string;
      }>;
    };
    finalCta: {
      headline: string;
      description: string;
      buttonText: string;
    };
  };
  metadata: {
    metaDescription: string;
    keywords: string[];
    pageGoal: 'signup' | 'demo' | 'purchase' | 'download';
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse JSON response from Claude, handling potential formatting issues
 */
function parseJsonResponse<T>(content: string): T {
  try {
    // Remove markdown code blocks if present
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error('Failed to parse JSON response:', content);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

/**
 * Make a request to Claude with consistent error handling
 */
async function generateContent<T>(
  systemPrompt: string,
  userMessage: string,
  temperature: number = TEMPERATURE_PRESETS.CREATIVE
): Promise<T> {
  try {
    const message = await anthropic.messages.create(
      createMessageParams({
        temperature,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
        system: systemPrompt,
      })
    );

    // Extract text content from the response
    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    return parseJsonResponse<T>(textContent.text);
  } catch (error) {
    handleAnthropicError(error);
  }
}

// ============================================================================
// Content Generation Functions
// ============================================================================

export interface BlogPostParams {
  product: ProductContext;
  audience: AudienceContext;
  topic: string;
  keywords?: string[];
  tone?: string;
}

/**
 * Generate a comprehensive blog post
 *
 * @param params - Blog post generation parameters
 * @returns Structured blog post content
 *
 * @example
 * ```ts
 * const blogPost = await generateBlogPost({
 *   product: {
 *     name: "TaskMaster Pro",
 *     description: "AI-powered task management",
 *     positioning: "The smartest way to organize your work",
 *     verifiedClaims: ["Increases productivity by 40%"],
 *     features: ["AI task prioritization", "Team collaboration"],
 *     benefits: ["Save 10 hours per week", "Never miss a deadline"]
 *   },
 *   audience: {
 *     name: "Busy Professionals",
 *     painPoints: ["Too many tasks", "Poor organization"],
 *     goals: ["Better time management", "Increased productivity"]
 *   },
 *   topic: "5 Ways AI is Revolutionizing Task Management"
 * });
 * ```
 */
export async function generateBlogPost(
  params: BlogPostParams
): Promise<BlogPostOutput> {
  const { product, audience, topic, keywords, tone } = params;

  const userMessage = `
${buildProductContext(product)}

${buildAudienceContext(audience)}

TOPIC: ${topic}
${keywords ? `TARGET KEYWORDS: ${keywords.join(', ')}` : ''}
${tone ? `DESIRED TONE: ${tone}` : ''}

Generate a comprehensive blog post on this topic that appeals to this audience and naturally showcases the product's value.
  `.trim();

  return generateContent<BlogPostOutput>(BLOG_POST_PROMPT, userMessage);
}

export interface EmailContentParams {
  product: ProductContext;
  audience: AudienceContext;
  campaign: {
    name: string;
    goal: string;
    type: 'promotional' | 'educational' | 'transactional' | 'nurture';
  };
  tone?: string;
}

/**
 * Generate compelling email content
 *
 * @param params - Email generation parameters
 * @returns Structured email content
 *
 * @example
 * ```ts
 * const email = await generateEmailContent({
 *   product: productContext,
 *   audience: audienceContext,
 *   campaign: {
 *     name: "Product Launch",
 *     goal: "Drive sign-ups for beta program",
 *     type: "promotional"
 *   }
 * });
 * ```
 */
export async function generateEmailContent(
  params: EmailContentParams
): Promise<EmailContentOutput> {
  const { product, audience, campaign, tone } = params;

  const userMessage = `
${buildProductContext(product)}

${buildAudienceContext(audience)}

CAMPAIGN: ${campaign.name}
CAMPAIGN GOAL: ${campaign.goal}
CAMPAIGN TYPE: ${campaign.type}
${tone ? `DESIRED TONE: ${tone}` : ''}

Generate email content for this campaign that appeals to this audience and drives them toward the campaign goal.
  `.trim();

  return generateContent<EmailContentOutput>(EMAIL_CONTENT_PROMPT, userMessage);
}

export interface SocialPostParams {
  product: ProductContext;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  topic: string;
  tone?: string;
  includeLink?: boolean;
}

/**
 * Generate engaging social media posts
 *
 * @param params - Social post generation parameters
 * @returns Structured social media content
 *
 * @example
 * ```ts
 * const socialPost = await generateSocialPost({
 *   product: productContext,
 *   platform: "linkedin",
 *   topic: "Productivity tips for remote teams",
 *   includeLink: true
 * });
 * ```
 */
export async function generateSocialPost(
  params: SocialPostParams
): Promise<SocialPostOutput> {
  const { product, platform, topic, tone, includeLink } = params;

  const userMessage = `
${buildProductContext(product)}

PLATFORM: ${platform}
TOPIC: ${topic}
${tone ? `DESIRED TONE: ${tone}` : ''}
${includeLink !== undefined ? `INCLUDE LINK: ${includeLink ? 'Yes' : 'No'}` : ''}

Generate engaging social media content for ${platform} on this topic. Create multiple variations if appropriate for the platform.
  `.trim();

  return generateContent<SocialPostOutput>(
    SOCIAL_POST_PROMPT,
    userMessage,
    TEMPERATURE_PRESETS.CREATIVE
  );
}

export interface LandingPageParams {
  product: ProductContext;
  audience: AudienceContext;
  cta: {
    primary: string;
    goal: 'signup' | 'demo' | 'purchase' | 'download';
  };
  tone?: string;
}

/**
 * Generate a high-converting landing page
 *
 * @param params - Landing page generation parameters
 * @returns Structured landing page content
 *
 * @example
 * ```ts
 * const landingPage = await generateLandingPage({
 *   product: productContext,
 *   audience: audienceContext,
 *   cta: {
 *     primary: "Start Free Trial",
 *     goal: "signup"
 *   }
 * });
 * ```
 */
export async function generateLandingPage(
  params: LandingPageParams
): Promise<LandingPageOutput> {
  const { product, audience, cta, tone } = params;

  const userMessage = `
${buildProductContext(product)}

${buildAudienceContext(audience)}

PRIMARY CTA: ${cta.primary}
PAGE GOAL: ${cta.goal}
${tone ? `DESIRED TONE: ${tone}` : ''}

Generate a high-converting landing page that drives users toward ${cta.goal}. Focus on benefits, address objections, and build urgency.
  `.trim();

  return generateContent<LandingPageOutput>(
    LANDING_PAGE_PROMPT,
    userMessage,
    TEMPERATURE_PRESETS.BALANCED
  );
}

// ============================================================================
// Content Revision
// ============================================================================

export interface RevisionParams<T> {
  originalContent: T;
  feedback: string;
  contentType: 'blog' | 'email' | 'social' | 'landing';
}

/**
 * Revise existing content based on user feedback
 *
 * @param params - Revision parameters including original content and feedback
 * @returns Revised content in the same structure
 *
 * @example
 * ```ts
 * const revised = await reviseContent({
 *   originalContent: blogPost,
 *   feedback: "Make the tone more professional and add more data points",
 *   contentType: "blog"
 * });
 * ```
 */
export async function reviseContent<T>(
  params: RevisionParams<T>
): Promise<T> {
  const { originalContent, feedback, contentType } = params;

  // Select the appropriate system prompt based on content type
  const systemPromptMap = {
    blog: BLOG_POST_PROMPT,
    email: EMAIL_CONTENT_PROMPT,
    social: SOCIAL_POST_PROMPT,
    landing: LANDING_PAGE_PROMPT,
  };

  const basePrompt = systemPromptMap[contentType];

  const userMessage = REVISION_PROMPT.replace(
    '{originalContent}',
    JSON.stringify(originalContent, null, 2)
  ).replace('{feedback}', feedback);

  return generateContent<T>(
    basePrompt,
    userMessage,
    TEMPERATURE_PRESETS.BALANCED
  );
}

// ============================================================================
// Batch Generation (Future Enhancement)
// ============================================================================

/**
 * Generate multiple content pieces in parallel
 *
 * @param requests - Array of generation requests
 * @returns Array of generated content
 *
 * Note: Be mindful of rate limits when using batch generation
 */
export async function generateBatch<T>(
  requests: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(requests.map((request) => request()));
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ProductContext,
  AudienceContext,
} from './prompts';
