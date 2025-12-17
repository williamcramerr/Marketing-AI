/**
 * AI SEO Content Writer
 *
 * Generates SEO-optimized content including briefs, blog posts,
 * and meta content based on keyword research and SERP analysis.
 */

import {
  anthropic,
  createMessageParams,
  handleAnthropicError,
  TEMPERATURE_PRESETS,
} from './client';
import { buildProductContext, ProductContext, AudienceContext } from './prompts';
import { SerpAnalysis, OrganicResult } from '../connectors/seo/serpapi';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ContentBriefOutput {
  title: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  lsiKeywords: string[];
  suggestedWordCount: number;
  suggestedReadingTime: number;
  contentGoal: string;
  targetAudience: string;
  searchIntent: 'informational' | 'navigational' | 'commercial' | 'transactional';
  suggestedHeadings: HeadingStructure[];
  outline: OutlineSection[];
  metaTitleSuggestion: string;
  metaDescriptionSuggestion: string;
  urlSlugSuggestion: string;
  questionsToAnswer: string[];
  pointsToCover: string[];
  uniqueAngle: string;
  competitorGaps: string[];
  internalLinkSuggestions: string[];
  externalSourcesSuggestions: string[];
}

export interface HeadingStructure {
  level: 'h2' | 'h3';
  text: string;
  subsections?: HeadingStructure[];
}

export interface OutlineSection {
  heading: string;
  keyPoints: string[];
  wordCountTarget: number;
  contentType: 'introduction' | 'body' | 'example' | 'cta' | 'conclusion';
}

export interface SEOBlogPostOutput {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  body: string;
  sections: Array<{
    heading: string;
    content: string;
    wordCount: number;
  }>;
  keywords: {
    primary: string;
    secondary: string[];
    lsi: string[];
  };
  readingTime: number;
  wordCount: number;
  seoScore: number;
  suggestions: string[];
}

export interface ContentBriefParams {
  keyword: string;
  serpAnalysis?: SerpAnalysis;
  product: ProductContext;
  audience?: AudienceContext;
  contentType?: 'blog_post' | 'landing_page' | 'pillar_page' | 'how_to' | 'listicle' | 'comparison';
  competitorContent?: Array<{
    title: string;
    url: string;
    wordCount?: number;
    headings?: string[];
  }>;
}

export interface SEOContentParams {
  brief: ContentBriefOutput;
  product: ProductContext;
  audience?: AudienceContext;
  tone?: 'professional' | 'casual' | 'authoritative' | 'friendly';
  includeImages?: boolean;
  includeCTA?: boolean;
}

// ============================================================================
// Prompts
// ============================================================================

const CONTENT_BRIEF_PROMPT = `You are an expert SEO content strategist who creates comprehensive content briefs that help writers produce content that ranks well and converts visitors.

## Target Keyword
Primary Keyword: {keyword}
Search Volume: {searchVolume}
Keyword Difficulty: {difficulty}

## SERP Analysis
{serpAnalysis}

## Competitor Content Analysis
{competitorAnalysis}

## Product Context
{productContext}

## Target Audience
{audienceContext}

## Content Type
{contentType}

## Your Task
Create a comprehensive content brief that will help a writer create content that:
1. Ranks on the first page for the target keyword
2. Provides genuine value to readers
3. Addresses search intent completely
4. Stands out from existing top-ranking content
5. Naturally guides readers toward our product

## Analysis to Include
- What searchers are really looking for (search intent)
- Gaps in existing content we can fill
- Unique angles to differentiate our content
- Questions we must answer to satisfy searchers
- Related topics to cover for topical authority

## Structure Guidelines
- Introduction should hook readers immediately
- Each section should target a search intent cluster
- Include practical, actionable advice
- Add relevant examples and data
- End with a clear next step

Return as JSON:
{
  "title": "compelling title including target keyword",
  "targetKeyword": "{keyword}",
  "secondaryKeywords": ["keyword2", "keyword3"],
  "lsiKeywords": ["semantic keyword 1", "semantic keyword 2"],
  "suggestedWordCount": number,
  "suggestedReadingTime": number (minutes),
  "contentGoal": "what this content should achieve",
  "targetAudience": "who this content is for",
  "searchIntent": "informational" | "navigational" | "commercial" | "transactional",
  "suggestedHeadings": [
    { "level": "h2", "text": "heading", "subsections": [{ "level": "h3", "text": "subheading" }] }
  ],
  "outline": [
    {
      "heading": "section heading",
      "keyPoints": ["point 1", "point 2"],
      "wordCountTarget": number,
      "contentType": "introduction" | "body" | "example" | "cta" | "conclusion"
    }
  ],
  "metaTitleSuggestion": "under 60 chars with keyword",
  "metaDescriptionSuggestion": "under 160 chars with keyword and CTA",
  "urlSlugSuggestion": "url-friendly-slug",
  "questionsToAnswer": ["question 1", "question 2"],
  "pointsToCover": ["point 1", "point 2"],
  "uniqueAngle": "what makes our content different",
  "competitorGaps": ["gap 1 we can fill", "gap 2"],
  "internalLinkSuggestions": ["related topics to link to"],
  "externalSourcesSuggestions": ["authoritative sources to cite"]
}`;

const SEO_BLOG_POST_PROMPT = `You are an expert SEO content writer who creates engaging, well-optimized blog posts that rank well and provide genuine value to readers.

## Content Brief
Title: {title}
Target Keyword: {targetKeyword}
Secondary Keywords: {secondaryKeywords}
Word Count Target: {wordCountTarget}
Search Intent: {searchIntent}

## Outline to Follow
{outline}

## Questions to Answer
{questionsToAnswer}

## Points to Cover
{pointsToCover}

## Unique Angle
{uniqueAngle}

## Product Context (for natural mentions)
{productContext}

## Target Audience
{audienceContext}

## Writing Guidelines
- Tone: {tone}
- Write for humans first, search engines second
- Use the target keyword naturally 3-5 times
- Include secondary keywords where they fit naturally
- Use short paragraphs (2-3 sentences max)
- Include bullet points and numbered lists
- Add relevant subheadings every 200-300 words
- Provide actionable takeaways
- Use examples and data where possible
- {imageGuidelines}
- {ctaGuidelines}

## SEO Best Practices
- Keyword in first paragraph
- Keyword in at least one H2
- Natural keyword density (1-2%)
- Related terms throughout
- Compelling meta description
- Internal linking opportunities marked

Return as JSON:
{
  "title": "final title",
  "slug": "url-slug",
  "metaTitle": "under 60 chars",
  "metaDescription": "under 160 chars",
  "excerpt": "2-3 sentence summary",
  "body": "full HTML formatted content",
  "sections": [
    { "heading": "h2 heading", "content": "section content", "wordCount": number }
  ],
  "keywords": {
    "primary": "target keyword",
    "secondary": ["kw1", "kw2"],
    "lsi": ["semantic term 1", "semantic term 2"]
  },
  "readingTime": number,
  "wordCount": number,
  "seoScore": number (0-100),
  "suggestions": ["improvement suggestion 1", "suggestion 2"]
}`;

const META_CONTENT_PROMPT = `Generate optimized meta content for this page.

Title: {title}
Primary Keyword: {keyword}
Content Summary: {summary}

Return JSON:
{
  "metaTitle": "under 60 chars, keyword near start",
  "metaDescription": "under 160 chars, keyword + value prop + CTA",
  "ogTitle": "for social sharing",
  "ogDescription": "for social sharing"
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

function formatSerpAnalysis(analysis?: SerpAnalysis): string {
  if (!analysis) {
    return 'No SERP analysis available - will use general best practices.';
  }

  let output = `
Total Results: ${analysis.totalResults || 'Unknown'}
Has Featured Snippet: ${analysis.featuredSnippet ? 'Yes' : 'No'}
Has Local Pack: ${analysis.hasLocalPack ? 'Yes' : 'No'}
Has Knowledge Panel: ${analysis.hasKnowledgePanel ? 'Yes' : 'No'}
Has Ads: ${analysis.hasAds ? 'Yes' : 'No'}

Top Ranking Domains:
${analysis.topDomains.slice(0, 5).map((d, i) => `${i + 1}. ${d}`).join('\n')}

Related Questions (People Also Ask):
${analysis.relatedQuestions.slice(0, 5).map(q => `- ${q.question}`).join('\n')}

Related Searches:
${analysis.relatedSearches.slice(0, 5).map(s => `- ${s}`).join('\n')}`;

  if (analysis.featuredSnippet) {
    output += `\n\nFeatured Snippet:
Type: ${analysis.featuredSnippet.type}
Content: ${analysis.featuredSnippet.content.substring(0, 200)}...`;
  }

  return output;
}

function formatCompetitorAnalysis(
  competitors?: Array<{ title: string; url: string; wordCount?: number; headings?: string[] }>
): string {
  if (!competitors || competitors.length === 0) {
    return 'No competitor content provided.';
  }

  return competitors.map((c, i) => `
Competitor ${i + 1}: ${c.title}
URL: ${c.url}
Word Count: ${c.wordCount || 'Unknown'}
Headings: ${c.headings?.slice(0, 5).join(' | ') || 'Not analyzed'}`
  ).join('\n');
}

function buildAudienceContext(audience?: AudienceContext): string {
  if (!audience) {
    return 'General audience interested in this topic.';
  }

  return `
Target: ${audience.name || 'Primary audience'}
Pain Points: ${audience.painPoints?.join(', ') || 'Not specified'}
Goals: ${audience.goals?.join(', ') || 'Not specified'}
Knowledge Level: ${audience.demographics || 'Intermediate'}
`;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate a comprehensive content brief from keyword and SERP data
 */
export async function generateContentBrief(
  params: ContentBriefParams
): Promise<ContentBriefOutput> {
  try {
    const { keyword, serpAnalysis, product, audience, contentType, competitorContent } = params;

    const prompt = CONTENT_BRIEF_PROMPT
      .replace('{keyword}', keyword)
      .replace('{searchVolume}', 'See SERP analysis')
      .replace('{difficulty}', 'See SERP analysis')
      .replace('{serpAnalysis}', formatSerpAnalysis(serpAnalysis))
      .replace('{competitorAnalysis}', formatCompetitorAnalysis(competitorContent))
      .replace('{productContext}', buildProductContext(product))
      .replace('{audienceContext}', buildAudienceContext(audience))
      .replace('{contentType}', contentType || 'blog_post');

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.FOCUSED,
        max_tokens: 4000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<ContentBriefOutput>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Generate a full SEO-optimized blog post from a content brief
 */
export async function generateSEOBlogPost(
  params: SEOContentParams
): Promise<SEOBlogPostOutput> {
  try {
    const { brief, product, audience, tone, includeImages, includeCTA } = params;

    const prompt = SEO_BLOG_POST_PROMPT
      .replace('{title}', brief.title)
      .replace('{targetKeyword}', brief.targetKeyword)
      .replace('{secondaryKeywords}', brief.secondaryKeywords.join(', '))
      .replace('{wordCountTarget}', brief.suggestedWordCount.toString())
      .replace('{searchIntent}', brief.searchIntent)
      .replace('{outline}', JSON.stringify(brief.outline, null, 2))
      .replace('{questionsToAnswer}', brief.questionsToAnswer.join('\n- '))
      .replace('{pointsToCover}', brief.pointsToCover.join('\n- '))
      .replace('{uniqueAngle}', brief.uniqueAngle)
      .replace('{productContext}', buildProductContext(product))
      .replace('{audienceContext}', buildAudienceContext(audience))
      .replace('{tone}', tone || 'professional')
      .replace(
        '{imageGuidelines}',
        includeImages
          ? 'Include [IMAGE: description] placeholders for relevant images'
          : 'No images needed'
      )
      .replace(
        '{ctaGuidelines}',
        includeCTA
          ? 'Include a natural CTA section at the end'
          : 'No explicit CTA needed'
      );

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.BALANCED,
        max_tokens: 8000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<SEOBlogPostOutput>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Generate meta title and description for content
 */
export async function generateMetaContent(params: {
  title: string;
  keyword: string;
  summary: string;
}): Promise<{
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
}> {
  try {
    const prompt = META_CONTENT_PROMPT
      .replace('{title}', params.title)
      .replace('{keyword}', params.keyword)
      .replace('{summary}', params.summary);

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.FOCUSED,
        max_tokens: 500,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<{
      metaTitle: string;
      metaDescription: string;
      ogTitle: string;
      ogDescription: string;
    }>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Analyze existing content for SEO improvements
 */
export async function analyzeContentSEO(params: {
  content: string;
  targetKeyword: string;
  currentMetaTitle?: string;
  currentMetaDescription?: string;
}): Promise<{
  score: number;
  issues: Array<{ severity: 'high' | 'medium' | 'low'; issue: string; suggestion: string }>;
  keywordAnalysis: {
    density: number;
    inTitle: boolean;
    inH1: boolean;
    inFirstParagraph: boolean;
    inH2s: number;
  };
  readability: {
    avgSentenceLength: number;
    readingLevel: string;
    suggestions: string[];
  };
}> {
  try {
    const prompt = `Analyze this content for SEO optimization.

Target Keyword: ${params.targetKeyword}
Meta Title: ${params.currentMetaTitle || 'Not provided'}
Meta Description: ${params.currentMetaDescription || 'Not provided'}

Content:
${params.content.substring(0, 10000)}

Analyze and return JSON with:
- Overall SEO score (0-100)
- Issues found with severity and suggestions
- Keyword usage analysis
- Readability analysis`;

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.DETERMINISTIC,
        max_tokens: 2000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<{
      score: number;
      issues: Array<{ severity: 'high' | 'medium' | 'low'; issue: string; suggestion: string }>;
      keywordAnalysis: {
        density: number;
        inTitle: boolean;
        inH1: boolean;
        inFirstParagraph: boolean;
        inH2s: number;
      };
      readability: {
        avgSentenceLength: number;
        readingLevel: string;
        suggestions: string[];
      };
    }>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}

/**
 * Suggest related keywords for topical coverage
 */
export async function suggestRelatedKeywords(
  primaryKeyword: string,
  existingKeywords: string[] = []
): Promise<{
  semantic: string[];
  questions: string[];
  longTail: string[];
  relatedTopics: string[];
}> {
  try {
    const prompt = `Suggest related keywords for comprehensive topical coverage.

Primary Keyword: ${primaryKeyword}
Already Targeting: ${existingKeywords.join(', ') || 'None'}

Return JSON with:
- semantic: LSI/semantic keywords
- questions: Question-based keywords
- longTail: Long-tail variations
- relatedTopics: Related topics to build authority`;

    const response = await anthropic.messages.create(
      createMessageParams({
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE_PRESETS.CREATIVE,
        max_tokens: 1000,
      })
    );

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJsonResponse<{
      semantic: string[];
      questions: string[];
      longTail: string[];
      relatedTopics: string[];
    }>(content);
  } catch (error) {
    handleAnthropicError(error);
  }
}
