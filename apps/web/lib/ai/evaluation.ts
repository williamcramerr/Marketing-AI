/**
 * Content Evaluation Utilities
 *
 * This module provides utilities for validating, scoring, and evaluating
 * AI-generated marketing content against defined quality standards.
 */

import type {
  BlogPostOutput,
  EmailContentOutput,
  SocialPostOutput,
  LandingPageOutput,
} from './content-writer';

// ============================================================================
// Type Definitions
// ============================================================================

export type ContentType = 'blog' | 'email' | 'social' | 'landing';

export type Platform = 'twitter' | 'linkedin' | 'facebook' | 'instagram';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface QualityScore {
  overall: number; // 0-100
  breakdown: {
    structure: number;
    completeness: number;
    constraints: number;
    relevance: number;
  };
  issues: string[];
  suggestions: string[];
}

export interface HallucinationCheck {
  hasPotentialHallucinations: boolean;
  suspiciousClaims: string[];
  verifiedClaimsCovered: string[];
}

// ============================================================================
// Platform Constraints
// ============================================================================

const PLATFORM_CONSTRAINTS = {
  twitter: {
    maxCharacters: 280,
    maxHashtags: 3,
    recommendedHashtags: 2,
  },
  linkedin: {
    maxCharacters: 3000,
    maxHashtags: 5,
    recommendedHashtags: 3,
  },
  facebook: {
    maxCharacters: 63206,
    maxHashtags: 5,
    recommendedHashtags: 3,
  },
  instagram: {
    maxCharacters: 2200,
    maxHashtags: 30,
    recommendedHashtags: 8,
  },
} as const;

const EMAIL_CONSTRAINTS = {
  subjectLineMax: 60,
  subjectLineRecommended: 50,
  previewTextMax: 100,
  previewTextRecommended: 80,
} as const;

const SEO_CONSTRAINTS = {
  metaDescriptionMin: 120,
  metaDescriptionMax: 160,
  titleMin: 30,
  titleMax: 60,
  minKeywords: 3,
  maxKeywords: 10,
} as const;

// ============================================================================
// Structure Validation
// ============================================================================

/**
 * Validates that content matches the expected JSON structure for its type
 */
export function validateStructure(
  content: unknown,
  contentType: ContentType
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    switch (contentType) {
      case 'blog':
        validateBlogPostStructure(content as BlogPostOutput, errors, warnings);
        break;
      case 'email':
        validateEmailStructure(content as EmailContentOutput, errors, warnings);
        break;
      case 'social':
        validateSocialPostStructure(content as SocialPostOutput, errors, warnings);
        break;
      case 'landing':
        validateLandingPageStructure(content as LandingPageOutput, errors, warnings);
        break;
      default:
        errors.push(`Unknown content type: ${contentType}`);
    }
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateBlogPostStructure(
  content: BlogPostOutput,
  errors: string[],
  warnings: string[]
): void {
  // Required fields
  if (!content.title) errors.push('Missing required field: title');
  if (!content.slug) errors.push('Missing required field: slug');
  if (!content.excerpt) errors.push('Missing required field: excerpt');
  if (!content.body) errors.push('Missing required field: body');

  // Sections
  if (!Array.isArray(content.sections)) {
    errors.push('sections must be an array');
  } else {
    if (content.sections.length === 0) {
      warnings.push('Blog post has no sections');
    }
    content.sections.forEach((section, idx) => {
      if (!section.heading) errors.push(`Section ${idx} missing heading`);
      if (!section.content) errors.push(`Section ${idx} missing content`);
    });
  }

  // Metadata
  if (!content.metadata) {
    errors.push('Missing required field: metadata');
  } else {
    if (!content.metadata.metaDescription) {
      errors.push('Missing metadata.metaDescription');
    }
    if (!Array.isArray(content.metadata.keywords)) {
      errors.push('metadata.keywords must be an array');
    }
    if (typeof content.metadata.estimatedReadTime !== 'number') {
      errors.push('metadata.estimatedReadTime must be a number');
    }
  }

  // CTA
  if (!content.cta) {
    errors.push('Missing required field: cta');
  } else {
    if (!content.cta.text) errors.push('Missing cta.text');
    if (!content.cta.description) warnings.push('Missing cta.description');
  }
}

function validateEmailStructure(
  content: EmailContentOutput,
  errors: string[],
  warnings: string[]
): void {
  // Required fields
  if (!content.subject) errors.push('Missing required field: subject');
  if (!content.previewText) errors.push('Missing required field: previewText');
  if (!content.headline) errors.push('Missing required field: headline');
  if (!content.body) errors.push('Missing required field: body');

  // Sections
  if (!Array.isArray(content.sections)) {
    errors.push('sections must be an array');
  } else {
    if (content.sections.length === 0) {
      warnings.push('Email has no sections');
    }
    content.sections.forEach((section, idx) => {
      if (!section.type) errors.push(`Section ${idx} missing type`);
      if (!section.content) errors.push(`Section ${idx} missing content`);
      if (section.type && !['hero', 'content', 'cta', 'footer'].includes(section.type)) {
        errors.push(`Section ${idx} has invalid type: ${section.type}`);
      }
    });
  }

  // CTA
  if (!content.cta) {
    errors.push('Missing required field: cta');
  } else {
    if (!content.cta.primary) {
      errors.push('Missing cta.primary');
    } else {
      if (!content.cta.primary.text) errors.push('Missing cta.primary.text');
      if (!content.cta.primary.url) errors.push('Missing cta.primary.url');
    }
  }

  // Metadata
  if (!content.metadata) {
    errors.push('Missing required field: metadata');
  } else {
    if (!content.metadata.campaignType) {
      errors.push('Missing metadata.campaignType');
    } else if (
      !['promotional', 'educational', 'transactional', 'nurture'].includes(
        content.metadata.campaignType
      )
    ) {
      errors.push(`Invalid campaignType: ${content.metadata.campaignType}`);
    }
    if (!content.metadata.tone) {
      warnings.push('Missing metadata.tone');
    }
  }
}

function validateSocialPostStructure(
  content: SocialPostOutput,
  errors: string[],
  warnings: string[]
): void {
  // Required fields
  if (!content.platform) {
    errors.push('Missing required field: platform');
  } else if (!['twitter', 'linkedin', 'facebook', 'instagram'].includes(content.platform)) {
    errors.push(`Invalid platform: ${content.platform}`);
  }

  // Posts
  if (!Array.isArray(content.posts)) {
    errors.push('posts must be an array');
  } else {
    if (content.posts.length === 0) {
      errors.push('No posts generated');
    }
    content.posts.forEach((post, idx) => {
      if (!post.text) errors.push(`Post ${idx} missing text`);
      if (!Array.isArray(post.hashtags)) {
        errors.push(`Post ${idx} hashtags must be an array`);
      }
      if (typeof post.characterCount !== 'number') {
        errors.push(`Post ${idx} characterCount must be a number`);
      }
    });
  }

  // Media recommendations
  if (!content.mediaRecommendations) {
    warnings.push('Missing mediaRecommendations');
  } else {
    if (!content.mediaRecommendations.type) {
      warnings.push('Missing mediaRecommendations.type');
    }
    if (!Array.isArray(content.mediaRecommendations.suggestions)) {
      warnings.push('mediaRecommendations.suggestions must be an array');
    }
  }

  // Metadata
  if (!content.metadata) {
    warnings.push('Missing metadata');
  }
}

function validateLandingPageStructure(
  content: LandingPageOutput,
  errors: string[],
  warnings: string[]
): void {
  // Required fields
  if (!content.title) errors.push('Missing required field: title');
  if (!content.sections) {
    errors.push('Missing required field: sections');
    return;
  }

  // Hero section
  if (!content.sections.hero) {
    errors.push('Missing sections.hero');
  } else {
    if (!content.sections.hero.headline) errors.push('Missing hero.headline');
    if (!content.sections.hero.subheadline) errors.push('Missing hero.subheadline');
    if (!content.sections.hero.cta) {
      errors.push('Missing hero.cta');
    } else {
      if (!content.sections.hero.cta.text) errors.push('Missing hero.cta.text');
    }
  }

  // Value proposition
  if (!content.sections.valueProposition) {
    errors.push('Missing sections.valueProposition');
  } else {
    if (!content.sections.valueProposition.headline) {
      errors.push('Missing valueProposition.headline');
    }
    if (!Array.isArray(content.sections.valueProposition.points)) {
      errors.push('valueProposition.points must be an array');
    } else if (content.sections.valueProposition.points.length < 3) {
      warnings.push('valueProposition should have at least 3 points');
    }
  }

  // Features
  if (!content.sections.features) {
    errors.push('Missing sections.features');
  } else {
    if (!Array.isArray(content.sections.features.items)) {
      errors.push('features.items must be an array');
    } else {
      if (content.sections.features.items.length === 0) {
        warnings.push('No feature items provided');
      }
      content.sections.features.items.forEach((item, idx) => {
        if (!item.title) errors.push(`Feature ${idx} missing title`);
        if (!item.description) errors.push(`Feature ${idx} missing description`);
        if (!item.benefit) warnings.push(`Feature ${idx} missing benefit`);
      });
    }
  }

  // Social proof
  if (!content.sections.socialProof) {
    warnings.push('Missing sections.socialProof');
  }

  // FAQ
  if (!content.sections.faq) {
    warnings.push('Missing sections.faq');
  } else {
    if (!Array.isArray(content.sections.faq.questions)) {
      errors.push('faq.questions must be an array');
    } else if (content.sections.faq.questions.length < 3) {
      warnings.push('FAQ should have at least 3 questions');
    }
  }

  // Final CTA
  if (!content.sections.finalCta) {
    errors.push('Missing sections.finalCta');
  } else {
    if (!content.sections.finalCta.buttonText) {
      errors.push('Missing finalCta.buttonText');
    }
  }

  // Metadata
  if (!content.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!content.metadata.metaDescription) {
      errors.push('Missing metadata.metaDescription');
    }
    if (!content.metadata.pageGoal) {
      errors.push('Missing metadata.pageGoal');
    }
  }
}

// ============================================================================
// Platform Constraints Checking
// ============================================================================

/**
 * Checks if content meets platform-specific constraints
 */
export function checkPlatformConstraints(
  content: unknown,
  platform?: Platform
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check email constraints
  if (isEmailContent(content)) {
    checkEmailConstraints(content, errors, warnings);
  }

  // Check social post constraints
  if (isSocialPostContent(content) && platform) {
    checkSocialPostConstraints(content, platform, errors, warnings);
  }

  // Check SEO constraints
  if (isBlogPostContent(content) || isLandingPageContent(content)) {
    checkSEOConstraints(content, errors, warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function checkEmailConstraints(
  content: EmailContentOutput,
  errors: string[],
  warnings: string[]
): void {
  if (content.subject) {
    if (content.subject.length > EMAIL_CONSTRAINTS.subjectLineMax) {
      errors.push(
        `Subject line exceeds ${EMAIL_CONSTRAINTS.subjectLineMax} characters (${content.subject.length})`
      );
    } else if (content.subject.length > EMAIL_CONSTRAINTS.subjectLineRecommended) {
      warnings.push(
        `Subject line longer than recommended ${EMAIL_CONSTRAINTS.subjectLineRecommended} characters`
      );
    }
  }

  if (content.previewText) {
    if (content.previewText.length > EMAIL_CONSTRAINTS.previewTextMax) {
      errors.push(
        `Preview text exceeds ${EMAIL_CONSTRAINTS.previewTextMax} characters (${content.previewText.length})`
      );
    } else if (content.previewText.length > EMAIL_CONSTRAINTS.previewTextRecommended) {
      warnings.push(
        `Preview text longer than recommended ${EMAIL_CONSTRAINTS.previewTextRecommended} characters`
      );
    }
  }
}

function checkSocialPostConstraints(
  content: SocialPostOutput,
  platform: Platform,
  errors: string[],
  warnings: string[]
): void {
  const constraints = PLATFORM_CONSTRAINTS[platform];

  content.posts.forEach((post, idx) => {
    // Check character count
    const actualCount = post.text.length;
    if (actualCount > constraints.maxCharacters) {
      errors.push(
        `Post ${idx} exceeds ${platform} character limit: ${actualCount}/${constraints.maxCharacters}`
      );
    }

    // Verify characterCount field matches actual
    if (post.characterCount !== actualCount) {
      warnings.push(
        `Post ${idx} characterCount field (${post.characterCount}) doesn't match actual length (${actualCount})`
      );
    }

    // Check hashtag count
    if (post.hashtags.length > constraints.maxHashtags) {
      errors.push(
        `Post ${idx} exceeds ${platform} hashtag limit: ${post.hashtags.length}/${constraints.maxHashtags}`
      );
    } else if (post.hashtags.length > constraints.recommendedHashtags) {
      warnings.push(
        `Post ${idx} has more hashtags than recommended for ${platform}`
      );
    }
  });
}

function checkSEOConstraints(
  content: BlogPostOutput | LandingPageOutput,
  errors: string[],
  warnings: string[]
): void {
  if (!content.metadata) return;

  // Meta description
  if (content.metadata.metaDescription) {
    const length = content.metadata.metaDescription.length;
    if (length < SEO_CONSTRAINTS.metaDescriptionMin) {
      warnings.push(
        `Meta description too short (${length}/${SEO_CONSTRAINTS.metaDescriptionMin})`
      );
    } else if (length > SEO_CONSTRAINTS.metaDescriptionMax) {
      errors.push(
        `Meta description too long (${length}/${SEO_CONSTRAINTS.metaDescriptionMax})`
      );
    }
  }

  // Keywords
  if (content.metadata.keywords) {
    const keywordCount = content.metadata.keywords.length;
    if (keywordCount < SEO_CONSTRAINTS.minKeywords) {
      warnings.push(`Too few keywords (${keywordCount}/${SEO_CONSTRAINTS.minKeywords})`);
    } else if (keywordCount > SEO_CONSTRAINTS.maxKeywords) {
      warnings.push(`Too many keywords (${keywordCount}/${SEO_CONSTRAINTS.maxKeywords})`);
    }
  }

  // Title length (for blog posts)
  if (isBlogPostContent(content) && content.title) {
    const titleLength = content.title.length;
    if (titleLength < SEO_CONSTRAINTS.titleMin) {
      warnings.push(`Title too short for SEO (${titleLength}/${SEO_CONSTRAINTS.titleMin})`);
    } else if (titleLength > SEO_CONSTRAINTS.titleMax) {
      warnings.push(`Title too long for SEO (${titleLength}/${SEO_CONSTRAINTS.titleMax})`);
    }
  }
}

// ============================================================================
// Quality Scoring
// ============================================================================

/**
 * Calculates a quality score for the content
 */
export function calculateQualityScore(
  content: unknown,
  contentType: ContentType,
  productContext?: { verifiedClaims?: string[] }
): QualityScore {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Structure validation (0-25 points)
  const structureValidation = validateStructure(content, contentType);
  const structureScore = structureValidation.valid ? 25 : Math.max(0, 25 - structureValidation.errors.length * 5);
  issues.push(...structureValidation.errors);

  // Completeness (0-25 points)
  const completenessScore = calculateCompletenessScore(content, contentType, issues, suggestions);

  // Constraint compliance (0-25 points)
  const constraintValidation = checkPlatformConstraints(content);
  const constraintScore = constraintValidation.valid ? 25 : Math.max(0, 25 - constraintValidation.errors.length * 5);
  issues.push(...constraintValidation.errors);
  suggestions.push(...constraintValidation.warnings);

  // Relevance and quality (0-25 points)
  const relevanceScore = calculateRelevanceScore(content, productContext, issues, suggestions);

  const overall = Math.round(structureScore + completenessScore + constraintScore + relevanceScore);

  return {
    overall,
    breakdown: {
      structure: Math.round(structureScore),
      completeness: Math.round(completenessScore),
      constraints: Math.round(constraintScore),
      relevance: Math.round(relevanceScore),
    },
    issues,
    suggestions,
  };
}

function calculateCompletenessScore(
  content: unknown,
  contentType: ContentType,
  issues: string[],
  suggestions: string[]
): number {
  let score = 25;

  if (isBlogPostContent(content)) {
    if (!content.excerpt || content.excerpt.length < 50) {
      score -= 5;
      suggestions.push('Excerpt should be at least 50 characters');
    }
    if (!content.sections || content.sections.length < 3) {
      score -= 8;
      suggestions.push('Blog post should have at least 3 sections');
    }
    if (!content.body || content.body.length < 500) {
      score -= 8;
      suggestions.push('Blog post body should be at least 500 characters');
    }
    if (!content.metadata?.keywords || content.metadata.keywords.length < 3) {
      score -= 4;
      suggestions.push('Blog post should have at least 3 keywords');
    }
  }

  if (isEmailContent(content)) {
    if (!content.sections || content.sections.length < 3) {
      score -= 5;
      suggestions.push('Email should have at least 3 sections');
    }
    const hasCTA = content.sections?.some((s) => s.type === 'cta');
    if (!hasCTA) {
      score -= 5;
      issues.push('Email missing CTA section');
    }
  }

  if (isSocialPostContent(content)) {
    if (!content.posts || content.posts.length === 0) {
      score -= 10;
      issues.push('No social posts generated');
    } else if (content.posts.length < 2 && content.platform !== 'linkedin') {
      score -= 3;
      suggestions.push('Consider generating multiple post variations');
    }
  }

  if (isLandingPageContent(content)) {
    if (!content.sections.faq || content.sections.faq.questions.length < 3) {
      score -= 5;
      suggestions.push('Landing page should have at least 3 FAQ items');
    }
    if (!content.sections.features || content.sections.features.items.length < 3) {
      score -= 5;
      suggestions.push('Landing page should highlight at least 3 features');
    }
  }

  return Math.max(0, score);
}

function calculateRelevanceScore(
  content: unknown,
  productContext: { verifiedClaims?: string[] } | undefined,
  issues: string[],
  suggestions: string[]
): number {
  let score = 25;

  // Check for placeholder text
  const contentStr = JSON.stringify(content).toLowerCase();

  if (contentStr.includes('lorem ipsum')) {
    score -= 15;
    issues.push('Content contains placeholder text');
  }

  // Check for other placeholder patterns
  if (contentStr.includes('[insert') || contentStr.includes('[add') || contentStr.includes('[your')) {
    score -= 10;
    issues.push('Content contains unfilled placeholder brackets');
  }

  if (contentStr.includes('{{') || contentStr.includes('}}')) {
    // Placeholders are OK for URLs in CTAs
    const urlPlaceholders = (contentStr.match(/\{\{.*?_url\}\}/gi) || []).length;
    const totalPlaceholders = (contentStr.match(/\{\{.*?\}\}/g) || []).length;

    if (totalPlaceholders > urlPlaceholders) {
      score -= 8;
      suggestions.push('Content contains template placeholders that should be filled');
    }
  }

  // Check for generic/weak language
  const weakPhrases = ['click here', 'learn more', 'read more', 'click now'];
  weakPhrases.forEach((phrase) => {
    if (contentStr.includes(phrase)) {
      score -= 3;
      suggestions.push(`Avoid generic phrase: "${phrase}" - be more specific`);
    }
  });

  return Math.max(0, score);
}

// ============================================================================
// Hallucination Detection
// ============================================================================

/**
 * Detects potential hallucinations by comparing content against verified claims
 */
export function detectHallucinations(
  content: unknown,
  verifiedClaims: string[]
): HallucinationCheck {
  const contentStr = JSON.stringify(content).toLowerCase();
  const suspiciousClaims: string[] = [];
  const verifiedClaimsCovered: string[] = [];

  // Check which verified claims are mentioned
  verifiedClaims.forEach((claim) => {
    const claimWords = claim.toLowerCase().split(' ').filter((w) => w.length > 3);
    const matchCount = claimWords.filter((word) => contentStr.includes(word)).length;

    if (matchCount >= claimWords.length * 0.5) {
      verifiedClaimsCovered.push(claim);
    }
  });

  // Look for suspicious numeric claims
  const numberPatterns = [
    /(\d+)%\s*(increase|decrease|faster|slower|more|less)/gi,
    /(\d+)x\s*(faster|slower|better|more)/gi,
    /save.*?(\d+)\s*(hours|dollars|%)/gi,
    /(increases?|reduces?|improves?).*?by\s*(\d+)%/gi,
  ];

  numberPatterns.forEach((pattern) => {
    const matches = contentStr.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        // Check if this claim appears in verified claims
        const isVerified = verifiedClaims.some((claim) =>
          claim.toLowerCase().includes(match.toLowerCase().trim())
        );

        if (!isVerified) {
          suspiciousClaims.push(match);
        }
      });
    }
  });

  // Look for superlatives that might be unsubstantiated
  const superlatives = ['best', 'fastest', 'most', 'largest', 'biggest', 'leading', 'top', '#1'];
  superlatives.forEach((superlative) => {
    const regex = new RegExp(`\\b${superlative}\\b`, 'gi');
    if (regex.test(contentStr)) {
      const isVerified = verifiedClaims.some((claim) =>
        claim.toLowerCase().includes(superlative)
      );

      if (!isVerified) {
        suspiciousClaims.push(`Unverified superlative: "${superlative}"`);
      }
    }
  });

  return {
    hasPotentialHallucinations: suspiciousClaims.length > 0,
    suspiciousClaims: [...new Set(suspiciousClaims)], // Remove duplicates
    verifiedClaimsCovered,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

function isBlogPostContent(content: unknown): content is BlogPostOutput {
  return (
    typeof content === 'object' &&
    content !== null &&
    'title' in content &&
    'slug' in content &&
    'body' in content
  );
}

function isEmailContent(content: unknown): content is EmailContentOutput {
  return (
    typeof content === 'object' &&
    content !== null &&
    'subject' in content &&
    'previewText' in content
  );
}

function isSocialPostContent(content: unknown): content is SocialPostOutput {
  return (
    typeof content === 'object' &&
    content !== null &&
    'platform' in content &&
    'posts' in content
  );
}

function isLandingPageContent(content: unknown): content is LandingPageOutput {
  return (
    typeof content === 'object' &&
    content !== null &&
    'sections' in content &&
    typeof (content as any).sections === 'object' &&
    'hero' in (content as any).sections
  );
}
