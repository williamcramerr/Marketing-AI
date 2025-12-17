/**
 * AI Partnership Finder Module
 *
 * Analyzes potential partnership opportunities and generates
 * personalized outreach content.
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

export interface PartnershipAnalysis {
  partnershipPotential: number; // 0-100
  customerOverlapScore: number; // 0-100
  complementaryScore: number; // 0-100
  reachScore: number; // 0-100
  reasoning: string;
  suggestedPartnershipTypes: PartnershipType[];
  valueExchangeIdeas: ValueExchange[];
  potentialRisks: string[];
  similarSuccessfulPartnerships: string[];
  recommendedApproach: string;
  priorityLevel: 'low' | 'medium' | 'high' | 'urgent';
}

export type PartnershipType =
  | 'affiliate'
  | 'co_marketing'
  | 'integration'
  | 'reseller'
  | 'referral'
  | 'technology'
  | 'strategic';

export interface ValueExchange {
  weProvide: string;
  theyProvide: string;
  mutualBenefit: string;
}

export interface CompanyInfo {
  name: string;
  website?: string;
  description?: string;
  industry?: string;
  companySize?: string;
  products?: string[];
  targetAudience?: string;
  recentNews?: string[];
}

export interface OutreachParams {
  partner: CompanyInfo;
  product: ProductContext;
  partnershipType: PartnershipType;
  analysis: PartnershipAnalysis;
  senderName: string;
  senderTitle: string;
  companyName: string;
  tone?: 'professional' | 'casual' | 'enthusiastic';
  mutualConnections?: string[];
  personalizedHook?: string;
}

export interface OutreachEmail {
  subject: string;
  body: string;
  followUpSubject: string;
  followUpBody: string;
  linkedInMessage: string;
  personalizations: string[];
  bestTimeToSend: string;
  warnings: string[];
}

export interface DiscoveryParams {
  product: ProductContext;
  existingPartners?: string[];
  targetIndustries?: string[];
  targetCompanySize?: string[];
  partnershipGoals?: string[];
}

export interface DiscoverySuggestions {
  companies: Array<{
    name: string;
    website: string;
    reason: string;
    partnershipType: PartnershipType;
    estimatedPotential: number;
  }>;
  categories: Array<{
    category: string;
    description: string;
    exampleCompanies: string[];
  }>;
  searchQueries: string[];
}

// ============================================================================
// Prompts
// ============================================================================

const PARTNERSHIP_ANALYSIS_PROMPT = `You are an expert business development strategist who identifies and evaluates partnership opportunities.

## Your Product/Company
{productContext}

## Potential Partner Company
Name: {partnerName}
Website: {partnerWebsite}
Description: {partnerDescription}
Industry: {partnerIndustry}
Company Size: {partnerSize}
Products/Services: {partnerProducts}
Target Audience: {partnerAudience}
Recent News: {partnerNews}

## Your Task
Analyze this company as a potential partner. Consider:
1. Customer overlap - Do we serve similar but non-competing audiences?
2. Complementary offerings - Do our products work well together?
3. Reach potential - Could this partnership expand our market?
4. Strategic fit - Does this align with our goals?
5. Competitive risk - Any risk they become a competitor?

## Partnership Types to Consider
- Affiliate: They refer customers for commission
- Co-marketing: Joint content, webinars, campaigns
- Integration: Technical product integration
- Reseller: They sell our product to their customers
- Referral: Informal referral relationship
- Technology: API/tech partnership
- Strategic: Long-term strategic alliance

Return your analysis as JSON:
{
  "partnershipPotential": number (0-100),
  "customerOverlapScore": number (0-100),
  "complementaryScore": number (0-100),
  "reachScore": number (0-100),
  "reasoning": "detailed analysis",
  "suggestedPartnershipTypes": ["type1", "type2"],
  "valueExchangeIdeas": [
    {
      "weProvide": "what we offer them",
      "theyProvide": "what they offer us",
      "mutualBenefit": "how both parties win"
    }
  ],
  "potentialRisks": ["risk1", "risk2"],
  "similarSuccessfulPartnerships": ["example partnership 1"],
  "recommendedApproach": "how to approach this partner",
  "priorityLevel": "low" | "medium" | "high" | "urgent"
}`;

const OUTREACH_PROMPT = `You are an expert at writing partnership outreach emails that get responses. Your emails are personal, specific, and clearly communicate value - not generic sales pitches.

## Your Company
{productContext}
Sender: {senderName}, {senderTitle} at {companyName}

## Target Partner
{partnerInfo}

## Partnership Analysis
Type: {partnershipType}
Potential Score: {potentialScore}
Value Exchange: {valueExchange}
Recommended Approach: {recommendedApproach}

## Personalization Opportunities
Mutual Connections: {mutualConnections}
Personal Hook: {personalizedHook}

## Guidelines
- Tone: {tone}
- Lead with value for them, not what you want
- Be specific about why them specifically
- Reference something relevant and recent
- Make the ask clear but low-commitment
- Keep it concise (under 150 words for initial)
- Sound human, not like a template

## What NOT to Do
- Don't be vague or generic
- Don't make it about you
- Don't ask for too much upfront
- Don't use corporate buzzwords
- Don't lie or exaggerate

Return as JSON:
{
  "subject": "compelling subject line",
  "body": "email body with {{first_name}} merge tag",
  "followUpSubject": "follow-up subject line",
  "followUpBody": "follow-up email body",
  "linkedInMessage": "shorter LinkedIn connection message",
  "personalizations": ["specific personalization points used"],
  "bestTimeToSend": "recommended timing",
  "warnings": ["any concerns about this outreach"]
}`;

const DISCOVERY_PROMPT = `You are an expert at identifying potential business partners. Given a company's profile, suggest types of companies that would make excellent partners.

## Your Company
{productContext}

## Existing Partners (to avoid suggesting)
{existingPartners}

## Target Criteria
Industries to Focus: {targetIndustries}
Company Sizes: {targetCompanySize}
Partnership Goals: {partnershipGoals}

## Your Task
Suggest specific types of companies and search strategies to find partners. Think about:
1. Companies whose customers need our product
2. Companies whose products complement ours
3. Companies with large audiences we want to reach
4. Companies in adjacent markets
5. Influencers and thought leaders in our space

Return as JSON:
{
  "companies": [
    {
      "name": "specific company name",
      "website": "their website",
      "reason": "why they'd be a good partner",
      "partnershipType": "suggested type",
      "estimatedPotential": number (0-100)
    }
  ],
  "categories": [
    {
      "category": "category of companies to target",
      "description": "why this category",
      "exampleCompanies": ["example1", "example2"]
    }
  ],
  "searchQueries": ["search queries to find more partners"]
}`;

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

function formatCompanyInfo(company: CompanyInfo): string {
  return `
Name: ${company.name}
Website: ${company.website || 'Unknown'}
Description: ${company.description || 'Not available'}
Industry: ${company.industry || 'Unknown'}
Company Size: ${company.companySize || 'Unknown'}
Products/Services: ${company.products?.join(', ') || 'Not specified'}
Target Audience: ${company.targetAudience || 'Not specified'}
Recent News: ${company.recentNews?.join('\n- ') || 'None available'}`;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Analyze a company for partnership potential
 */
export async function analyzePartnership(
  partner: CompanyInfo,
  product: ProductContext
): Promise<PartnershipAnalysis> {
  try {
    const prompt = PARTNERSHIP_ANALYSIS_PROMPT
      .replace('{productContext}', buildProductContext(product))
      .replace('{partnerName}', partner.name)
      .replace('{partnerWebsite}', partner.website || 'Unknown')
      .replace('{partnerDescription}', partner.description || 'Not available')
      .replace('{partnerIndustry}', partner.industry || 'Unknown')
      .replace('{partnerSize}', partner.companySize || 'Unknown')
      .replace('{partnerProducts}', partner.products?.join(', ') || 'Not specified')
      .replace('{partnerAudience}', partner.targetAudience || 'Not specified')
      .replace('{partnerNews}', partner.recentNews?.join('\n- ') || 'None available');

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.FOCUSED,
        max_tokens: 2000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<PartnershipAnalysis>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Generate partnership outreach content
 */
export async function generateOutreach(
  params: OutreachParams
): Promise<OutreachEmail> {
  try {
    const {
      partner,
      product,
      partnershipType,
      analysis,
      senderName,
      senderTitle,
      companyName,
      tone = 'professional',
      mutualConnections,
      personalizedHook,
    } = params;

    const valueExchange = analysis.valueExchangeIdeas[0];

    const prompt = OUTREACH_PROMPT
      .replace('{productContext}', buildProductContext(product))
      .replace('{senderName}', senderName)
      .replace('{senderTitle}', senderTitle)
      .replace('{companyName}', companyName)
      .replace('{partnerInfo}', formatCompanyInfo(partner))
      .replace('{partnershipType}', partnershipType)
      .replace('{potentialScore}', analysis.partnershipPotential.toString())
      .replace(
        '{valueExchange}',
        valueExchange
          ? `We provide: ${valueExchange.weProvide}\nThey provide: ${valueExchange.theyProvide}\nMutual benefit: ${valueExchange.mutualBenefit}`
          : 'Not specified'
      )
      .replace('{recommendedApproach}', analysis.recommendedApproach)
      .replace('{mutualConnections}', mutualConnections?.join(', ') || 'None identified')
      .replace('{personalizedHook}', personalizedHook || 'None provided')
      .replace('{tone}', tone);

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.CREATIVE,
        max_tokens: 2500,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<OutreachEmail>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Discover potential partners based on product and goals
 */
export async function discoverPartners(
  params: DiscoveryParams
): Promise<DiscoverySuggestions> {
  try {
    const {
      product,
      existingPartners,
      targetIndustries,
      targetCompanySize,
      partnershipGoals,
    } = params;

    const prompt = DISCOVERY_PROMPT
      .replace('{productContext}', buildProductContext(product))
      .replace('{existingPartners}', existingPartners?.join(', ') || 'None')
      .replace('{targetIndustries}', targetIndustries?.join(', ') || 'All relevant')
      .replace('{targetCompanySize}', targetCompanySize?.join(', ') || 'All sizes')
      .replace('{partnershipGoals}', partnershipGoals?.join(', ') || 'General growth');

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.CREATIVE,
        max_tokens: 3000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<DiscoverySuggestions>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Generate follow-up sequence for non-responsive partners
 */
export async function generateFollowUpSequence(
  params: {
    partner: CompanyInfo;
    originalOutreach: string;
    daysSinceOriginal: number;
    product: ProductContext;
  }
): Promise<Array<{ day: number; subject: string; body: string }>> {
  try {
    const prompt = `Generate a follow-up email sequence for a partner who hasn't responded.

Original Outreach:
${params.originalOutreach}

Partner: ${params.partner.name}
Days Since Original: ${params.daysSinceOriginal}

Our Product: ${buildProductContext(params.product)}

Generate 2-3 follow-up emails spaced appropriately. Each should:
- Add new value or angle
- Reference the original without being desperate
- Be shorter than the previous
- Final one should be a polite "breakup" email

Return as JSON array:
[
  { "day": number, "subject": "subject", "body": "email body" }
]`;

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.BALANCED,
        max_tokens: 2000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<Array<{ day: number; subject: string; body: string }>>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Calculate overall partnership score from analysis
 */
export function calculatePartnershipScore(analysis: PartnershipAnalysis): number {
  const weights = {
    partnershipPotential: 0.3,
    customerOverlapScore: 0.25,
    complementaryScore: 0.25,
    reachScore: 0.2,
  };

  return Math.round(
    analysis.partnershipPotential * weights.partnershipPotential +
    analysis.customerOverlapScore * weights.customerOverlapScore +
    analysis.complementaryScore * weights.complementaryScore +
    analysis.reachScore * weights.reachScore
  );
}

/**
 * Prioritize a list of partnership opportunities
 */
export function prioritizeOpportunities(
  analyses: Array<{ partner: CompanyInfo; analysis: PartnershipAnalysis }>
): Array<{ partner: CompanyInfo; analysis: PartnershipAnalysis; score: number; rank: number }> {
  const scored = analyses.map(item => ({
    ...item,
    score: calculatePartnershipScore(item.analysis),
    rank: 0,
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Assign ranks
  scored.forEach((item, index) => {
    item.rank = index + 1;
  });

  return scored;
}
