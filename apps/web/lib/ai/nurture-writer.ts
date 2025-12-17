/**
 * AI Nurture Sequence Writer
 *
 * Generates email nurture sequences to convert leads captured
 * through lead magnets into customers.
 */

import {
  anthropic,
  createMessageParams,
  handleAnthropicError,
  TEMPERATURE_PRESETS,
} from './client';
import { buildProductContext, ProductContext, AudienceContext } from './prompts';

// ============================================================================
// Type Definitions
// ============================================================================

export interface NurtureEmailOutput {
  sequenceOrder: number;
  delayDays: number;
  emailType: EmailType;
  subject: string;
  previewText: string;
  bodyHtml: string;
  bodyText: string;
  ctaText?: string;
  ctaUrl?: string;
  toneDescription: string;
  keyMessage: string;
}

export type EmailType =
  | 'welcome'
  | 'value'
  | 'story'
  | 'case_study'
  | 'objection_handler'
  | 'social_proof'
  | 'urgency'
  | 'cta'
  | 'reminder';

export interface NurtureSequenceParams {
  leadMagnet: {
    title: string;
    description: string;
    magnetType: string;
    keyTopics?: string[];
  };
  product: ProductContext;
  audience?: AudienceContext;
  emailCount?: number;
  goalAction: 'trial' | 'demo' | 'purchase' | 'meeting';
  senderName: string;
  companyName: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'authoritative';
  includeUnsubscribe?: boolean;
}

export interface NurtureSequenceOutput {
  sequenceName: string;
  description: string;
  goalAction: string;
  emails: NurtureEmailOutput[];
  totalDuration: number;
  recommendedSendTime: string;
  tips: string[];
}

export interface SingleEmailParams {
  emailType: EmailType;
  product: ProductContext;
  audience?: AudienceContext;
  previousEmailContext?: string;
  goalAction: string;
  senderName: string;
  companyName: string;
  tone?: string;
}

// ============================================================================
// Prompts
// ============================================================================

const NURTURE_SEQUENCE_PROMPT = `You are an expert email marketing strategist specializing in nurture sequences that convert leads into customers. Your emails are known for being helpful, not pushy, and for building genuine relationships.

## Lead Magnet Context
Title: {magnetTitle}
Type: {magnetType}
Description: {magnetDescription}
Key Topics: {keyTopics}

## Product Context
{productContext}

## Target Audience
{audienceContext}

## Sequence Goals
- Primary Action: {goalAction}
- Number of Emails: {emailCount}
- Sender Name: {senderName}
- Company: {companyName}
- Tone: {tone}

## Your Task
Create a complete email nurture sequence that:
1. Starts with a warm welcome and delivery of the lead magnet
2. Provides genuine value related to the lead magnet topic
3. Builds trust through stories, social proof, and helpful content
4. Addresses common objections naturally
5. Guides the reader toward the goal action
6. Never feels pushy or salesy

## Email Timing Guidelines
- Email 1 (Welcome): Day 0 - Immediate delivery + welcome
- Email 2-3 (Value): Days 2-4 - Educate and build trust
- Email 4-5 (Social Proof): Days 5-8 - Case studies and testimonials
- Email 6+ (CTA): Days 9-14 - Guide toward action

## Important Guidelines
- Each email should stand alone but also connect to the sequence story
- Use merge tags: {{first_name}}, {{company_name}}, {{lead_magnet_title}}
- Keep subject lines under 50 characters when possible
- Preview text should complement, not repeat, the subject
- Body should be scannable with clear sections
- Always include a clear but soft CTA
- Write in a conversational, human tone

Return the sequence as JSON:
{
  "sequenceName": "descriptive name for this sequence",
  "description": "brief description of the sequence strategy",
  "goalAction": "{goalAction}",
  "emails": [
    {
      "sequenceOrder": 1,
      "delayDays": 0,
      "emailType": "welcome",
      "subject": "subject line",
      "previewText": "preview text",
      "bodyHtml": "full HTML email body with proper formatting",
      "bodyText": "plain text version",
      "ctaText": "button text if applicable",
      "ctaUrl": "{{cta_url}}",
      "toneDescription": "description of this email's tone",
      "keyMessage": "the main point of this email"
    }
  ],
  "totalDuration": number of days,
  "recommendedSendTime": "e.g., 10am local time",
  "tips": ["tip1", "tip2"]
}`;

const SINGLE_EMAIL_PROMPT = `You are an expert email copywriter creating a single email for a nurture sequence.

## Email Type: {emailType}
## Previous Email Context: {previousContext}
## Goal Action: {goalAction}

## Product Context
{productContext}

## Audience Context
{audienceContext}

## Writing Style
- Sender: {senderName} at {companyName}
- Tone: {tone}
- Write like a helpful friend, not a marketer
- Be specific and actionable
- Use short paragraphs and bullet points when appropriate

## Email Type Guidelines
{emailTypeGuidelines}

Generate the email as JSON:
{
  "subject": "compelling subject line",
  "previewText": "preview text that complements subject",
  "bodyHtml": "HTML formatted email body",
  "bodyText": "plain text version",
  "ctaText": "CTA button text",
  "toneDescription": "how this email should feel",
  "keyMessage": "the main takeaway"
}`;

const EMAIL_TYPE_GUIDELINES: Record<EmailType, string> = {
  welcome: `
- Thank them for downloading/signing up
- Deliver the promised content
- Set expectations for the email series
- Share a quick win they can implement today
- Warm and welcoming tone`,

  value: `
- Focus on teaching something useful
- Connect to their pain points
- Provide actionable advice
- Position yourself as a helpful expert
- Soft mention of how your product helps (optional)`,

  story: `
- Share a relatable story or transformation
- Could be your story, a customer's, or industry
- Make it emotionally engaging
- Connect the story to their situation
- End with a relevant lesson or insight`,

  case_study: `
- Highlight a specific customer success
- Include concrete numbers/results
- Describe the before and after
- Make it relevant to the reader's situation
- Subtle social proof without bragging`,

  objection_handler: `
- Acknowledge a common concern or objection
- Address it with empathy and facts
- Provide evidence or examples
- Turn the objection into a reason to act
- Respectful and understanding tone`,

  social_proof: `
- Feature testimonials or reviews
- Include specific results achieved
- Variety of customers if possible
- Let others tell the story
- Build credibility through third parties`,

  urgency: `
- Create genuine urgency (not fake scarcity)
- Highlight cost of inaction
- Time-sensitive offers if applicable
- Clear deadline or reason to act now
- Respectful, not pushy`,

  cta: `
- Clear call to action
- Remove friction and objections
- Summarize value proposition
- Make the next step obvious
- Confidence-building, not pressure`,

  reminder: `
- Gentle follow-up
- Add new value or perspective
- Don't just repeat previous emails
- Acknowledge they're busy
- One more chance before sequence ends`,
};

// ============================================================================
// Helper Functions
// ============================================================================

function parseJsonResponse<T>(content: string): T {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonString = jsonMatch ? jsonMatch[1] : content;

  try {
    return JSON.parse(jsonString.trim()) as T;
  } catch (error) {
    const objectMatch = jsonString.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]) as T;
    }
    throw new Error(`Failed to parse AI response as JSON: ${error}`);
  }
}

function buildAudienceContext(audience?: AudienceContext): string {
  if (!audience) {
    return 'General business audience interested in the lead magnet topic.';
  }

  return `
Target Audience: ${audience.name || 'Primary audience'}
Pain Points: ${audience.painPoints?.join(', ') || 'Not specified'}
Goals: ${audience.goals?.join(', ') || 'Not specified'}
Messaging Notes: ${audience.messaging || 'None'}
Demographics: ${audience.demographics || 'Not specified'}
`;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate a complete nurture email sequence
 */
export async function generateNurtureSequence(
  params: NurtureSequenceParams
): Promise<NurtureSequenceOutput> {
  try {
    const {
      leadMagnet,
      product,
      audience,
      emailCount = 7,
      goalAction,
      senderName,
      companyName,
      tone = 'friendly',
    } = params;

    const prompt = NURTURE_SEQUENCE_PROMPT
      .replace('{magnetTitle}', leadMagnet.title)
      .replace('{magnetType}', leadMagnet.magnetType)
      .replace('{magnetDescription}', leadMagnet.description)
      .replace('{keyTopics}', leadMagnet.keyTopics?.join(', ') || 'Not specified')
      .replace('{productContext}', buildProductContext(product))
      .replace('{audienceContext}', buildAudienceContext(audience))
      .replace('{goalAction}', goalAction)
      .replace('{emailCount}', emailCount.toString())
      .replace('{senderName}', senderName)
      .replace('{companyName}', companyName)
      .replace('{tone}', tone);

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.CREATIVE,
        max_tokens: 8000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<NurtureSequenceOutput>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Generate a single nurture email
 */
export async function generateNurtureEmail(
  params: SingleEmailParams
): Promise<NurtureEmailOutput> {
  try {
    const {
      emailType,
      product,
      audience,
      previousEmailContext,
      goalAction,
      senderName,
      companyName,
      tone = 'friendly',
    } = params;

    const prompt = SINGLE_EMAIL_PROMPT
      .replace('{emailType}', emailType)
      .replace('{previousContext}', previousEmailContext || 'This is the first email in the sequence')
      .replace('{goalAction}', goalAction)
      .replace('{productContext}', buildProductContext(product))
      .replace('{audienceContext}', buildAudienceContext(audience))
      .replace('{senderName}', senderName)
      .replace('{companyName}', companyName)
      .replace('{tone}', tone)
      .replace('{emailTypeGuidelines}', EMAIL_TYPE_GUIDELINES[emailType]);

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.CREATIVE,
        max_tokens: 3000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const emailContent = parseJsonResponse<Omit<NurtureEmailOutput, 'sequenceOrder' | 'delayDays' | 'emailType'>>(content);

    return {
      ...emailContent,
      sequenceOrder: 1,
      delayDays: 0,
      emailType,
    };
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Generate subject line variations for A/B testing
 */
export async function generateSubjectVariations(
  originalSubject: string,
  emailType: EmailType,
  count: number = 3
): Promise<string[]> {
  try {
    const prompt = `Generate ${count} alternative subject lines for this email.

Original subject: "${originalSubject}"
Email type: ${emailType}

Guidelines:
- Keep under 50 characters when possible
- Each should take a different angle
- Include emojis sparingly and only if appropriate
- Vary the approach: question, benefit, curiosity, urgency

Return as JSON array:
["subject1", "subject2", "subject3"]`;

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.CREATIVE,
        max_tokens: 500,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<string[]>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Improve an existing email's copy
 */
export async function improveEmailCopy(
  email: NurtureEmailOutput,
  feedback?: string
): Promise<NurtureEmailOutput> {
  try {
    const prompt = `Improve this nurture email based on best practices${feedback ? ' and the provided feedback' : ''}.

Current Email:
Subject: ${email.subject}
Preview: ${email.previewText}
Body: ${email.bodyText}
Type: ${email.emailType}

${feedback ? `Feedback to address: ${feedback}` : ''}

Improvements to consider:
- Clearer value proposition
- More compelling subject line
- Stronger opening hook
- Better flow and readability
- More effective CTA
- More personalized tone

Return the improved email as JSON with the same structure as input.`;

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.BALANCED,
        max_tokens: 3000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const improvedContent = parseJsonResponse<Partial<NurtureEmailOutput>>(content);

    return {
      ...email,
      ...improvedContent,
    };
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Calculate recommended sequence structure based on goal
 */
export function getRecommendedSequenceStructure(
  goalAction: 'trial' | 'demo' | 'purchase' | 'meeting',
  urgency: 'low' | 'medium' | 'high' = 'medium'
): { emailCount: number; types: EmailType[]; totalDays: number } {
  const structures = {
    trial: {
      low: { emailCount: 7, types: ['welcome', 'value', 'value', 'story', 'social_proof', 'cta', 'reminder'] as EmailType[], totalDays: 14 },
      medium: { emailCount: 5, types: ['welcome', 'value', 'case_study', 'cta', 'reminder'] as EmailType[], totalDays: 10 },
      high: { emailCount: 4, types: ['welcome', 'value', 'cta', 'urgency'] as EmailType[], totalDays: 7 },
    },
    demo: {
      low: { emailCount: 6, types: ['welcome', 'value', 'case_study', 'social_proof', 'cta', 'reminder'] as EmailType[], totalDays: 12 },
      medium: { emailCount: 5, types: ['welcome', 'value', 'case_study', 'cta', 'reminder'] as EmailType[], totalDays: 10 },
      high: { emailCount: 4, types: ['welcome', 'case_study', 'cta', 'urgency'] as EmailType[], totalDays: 7 },
    },
    purchase: {
      low: { emailCount: 8, types: ['welcome', 'value', 'value', 'story', 'case_study', 'objection_handler', 'cta', 'reminder'] as EmailType[], totalDays: 21 },
      medium: { emailCount: 6, types: ['welcome', 'value', 'case_study', 'objection_handler', 'cta', 'reminder'] as EmailType[], totalDays: 14 },
      high: { emailCount: 5, types: ['welcome', 'value', 'social_proof', 'cta', 'urgency'] as EmailType[], totalDays: 10 },
    },
    meeting: {
      low: { emailCount: 5, types: ['welcome', 'value', 'social_proof', 'cta', 'reminder'] as EmailType[], totalDays: 10 },
      medium: { emailCount: 4, types: ['welcome', 'value', 'cta', 'reminder'] as EmailType[], totalDays: 7 },
      high: { emailCount: 3, types: ['welcome', 'cta', 'reminder'] as EmailType[], totalDays: 5 },
    },
  };

  return structures[goalAction][urgency];
}
