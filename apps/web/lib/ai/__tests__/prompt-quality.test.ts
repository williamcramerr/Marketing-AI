/**
 * AI Prompt Quality Testing Framework
 *
 * This test suite validates AI-generated content quality across all content types.
 * All tests use MOCKED Claude responses - no actual API calls are made.
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// ============================================================================
// Mock Setup - MUST be before any imports that use the client
// ============================================================================

// Create mock function using vi.hoisted so it's available in the mock factory
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Mock the Anthropic client BEFORE importing modules that use it
vi.mock('../client', () => ({
  anthropic: {
    messages: {
      create: mockCreate,
    },
  },
  DEFAULT_MODEL: 'claude-3-5-sonnet-20241022',
  DEFAULT_MESSAGE_PARAMS: {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    temperature: 0.7,
  },
  MODELS: {
    SONNET: 'claude-3-5-sonnet-20241022',
    OPUS: 'claude-3-opus-20240229',
    HAIKU: 'claude-3-haiku-20240307',
  },
  TEMPERATURE_PRESETS: {
    CREATIVE: 0.8,
    BALANCED: 0.7,
    FOCUSED: 0.5,
    DETERMINISTIC: 0.3,
  },
  createMessageParams: (overrides?: Record<string, unknown>) => ({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    temperature: 0.7,
    ...overrides,
  }),
  handleAnthropicError: (error: unknown) => { throw error; },
}));

// Now import modules that depend on the mocked client
import * as contentWriter from '../content-writer';
import type {
  BlogPostOutput,
  EmailContentOutput,
  SocialPostOutput,
  LandingPageOutput,
} from '../content-writer';
import {
  validateStructure,
  checkPlatformConstraints,
  calculateQualityScore,
  detectHallucinations,
} from '../evaluation';
import products from './fixtures/products.json';
import expectedOutputs from './fixtures/expected-outputs.json';

const mockAnthropicCreate = mockCreate as Mock;

// Helper to mock successful API responses
function mockApiResponse(output: any) {
  mockAnthropicCreate.mockResolvedValueOnce({
    id: 'msg_test123',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: JSON.stringify(output),
      },
    ],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 100,
      output_tokens: 200,
    },
  });
}

// ============================================================================
// Blog Post Generation Tests
// ============================================================================

describe('Blog Post Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Structure Validation', () => {
    it('produces valid JSON structure', async () => {
      mockApiResponse(expectedOutputs.blogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.saas_extensive as any,
        audience: {
          name: 'Business Leaders',
          painPoints: ['Data overload', 'Slow insights'],
          goals: ['Better decisions', 'Faster analysis'],
        },
        topic: '5 Ways AI is Revolutionizing Business Analytics',
      });

      const validation = validateStructure(result, 'blog');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('includes all required fields', async () => {
      mockApiResponse(expectedOutputs.blogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.saas_extensive as any,
        audience: {
          name: 'Business Leaders',
          painPoints: ['Data overload'],
          goals: ['Better decisions'],
        },
        topic: 'AI Analytics',
      });

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('slug');
      expect(result).toHaveProperty('excerpt');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('sections');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('cta');
      expect(Array.isArray(result.sections)).toBe(true);
    });

    it('has properly structured sections', async () => {
      mockApiResponse(expectedOutputs.blogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.saas_extensive as any,
        audience: {
          name: 'Data Analysts',
          painPoints: ['Manual reporting'],
          goals: ['Automation'],
        },
        topic: 'Automated Analytics',
      });

      expect(result.sections.length).toBeGreaterThan(0);
      result.sections.forEach((section) => {
        expect(section).toHaveProperty('heading');
        expect(section).toHaveProperty('content');
        expect(typeof section.heading).toBe('string');
        expect(typeof section.content).toBe('string');
      });
    });

    it('has complete metadata', async () => {
      mockApiResponse(expectedOutputs.blogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.b2b_software as any,
        audience: {
          name: 'Tech Teams',
          painPoints: ['Poor collaboration'],
          goals: ['Better teamwork'],
        },
        topic: 'Remote Team Collaboration',
      });

      expect(result.metadata).toHaveProperty('metaDescription');
      expect(result.metadata).toHaveProperty('keywords');
      expect(result.metadata).toHaveProperty('estimatedReadTime');
      expect(Array.isArray(result.metadata.keywords)).toBe(true);
      expect(typeof result.metadata.estimatedReadTime).toBe('number');
    });
  });

  describe('SEO Constraints', () => {
    it('respects meta description length', async () => {
      const blogPost = { ...expectedOutputs.blogPost };
      mockApiResponse(blogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.saas_extensive as any,
        audience: {
          name: 'Business Leaders',
          painPoints: ['Data overload'],
          goals: ['Better insights'],
        },
        topic: 'AI Analytics',
      });

      const validation = checkPlatformConstraints(result);
      const metaDescLength = result.metadata.metaDescription.length;

      expect(metaDescLength).toBeGreaterThanOrEqual(120);
      expect(metaDescLength).toBeLessThanOrEqual(160);
    });

    it('includes appropriate number of keywords', async () => {
      mockApiResponse(expectedOutputs.blogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.fintech as any,
        audience: {
          name: 'Investors',
          painPoints: ['High fees'],
          goals: ['Better returns'],
        },
        topic: 'Smart Investing',
      });

      expect(result.metadata.keywords.length).toBeGreaterThanOrEqual(3);
      expect(result.metadata.keywords.length).toBeLessThanOrEqual(10);
    });

    it('generates SEO-friendly slug', async () => {
      mockApiResponse(expectedOutputs.blogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.consumer_app as any,
        audience: {
          name: 'Fitness Enthusiasts',
          painPoints: ['Boring workouts'],
          goals: ['Stay motivated'],
        },
        topic: 'Make Fitness Fun',
      });

      expect(result.slug).toMatch(/^[a-z0-9-]+$/);
      expect(result.slug).not.toContain(' ');
      expect(result.slug).not.toContain('_');
    });
  });

  describe('Edge Cases', () => {
    it('handles minimal product information', async () => {
      const minimalBlogPost = {
        ...expectedOutputs.blogPost,
        title: 'Quick Task Management Tips',
        sections: [
          { heading: 'Introduction', content: 'Stay organized with simple tools.' },
          { heading: 'Getting Started', content: 'Create your first task list.' },
        ],
      };
      mockApiResponse(minimalBlogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.minimal as any,
        audience: {
          name: 'Busy Professionals',
          painPoints: ['Disorganized'],
          goals: ['Stay organized'],
        },
        topic: 'Simple Task Management',
      });

      const validation = validateStructure(result, 'blog');
      expect(validation.valid).toBe(true);
      expect(result.title).toBeTruthy();
      expect(result.body).toBeTruthy();
    });

    it('handles extensive product information', async () => {
      mockApiResponse(expectedOutputs.blogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.saas_extensive as any,
        audience: {
          name: 'Enterprise Decision Makers',
          painPoints: ['Complex data landscape', 'Slow insights', 'High costs'],
          goals: ['Real-time analytics', 'ROI improvement', 'Scalability'],
        },
        topic: 'Enterprise Analytics Transformation',
        keywords: ['AI analytics', 'enterprise BI', 'real-time insights'],
      });

      expect(result.title).toBeTruthy();
      expect(result.sections.length).toBeGreaterThan(2);
      const validation = validateStructure(result, 'blog');
      expect(validation.valid).toBe(true);
    });
  });

  describe('Content Quality', () => {
    it('achieves high quality score for well-formed content', async () => {
      mockApiResponse(expectedOutputs.blogPost);

      const result = await contentWriter.generateBlogPost({
        product: products.saas_extensive as any,
        audience: {
          name: 'Business Leaders',
          painPoints: ['Data overload'],
          goals: ['Better decisions'],
        },
        topic: 'AI Analytics',
      });

      const score = calculateQualityScore(result, 'blog', {
        verifiedClaims: products.saas_extensive.verifiedClaims,
      });

      expect(score.overall).toBeGreaterThanOrEqual(80);
      expect(score.breakdown.structure).toBeGreaterThan(20);
      expect(score.breakdown.completeness).toBeGreaterThan(20);
    });

    it('detects quality issues in incomplete content', () => {
      const incompleteBlogPost = {
        title: 'Test',
        slug: 'test',
        excerpt: 'Short',
        body: 'Too short',
        sections: [],
        metadata: {
          metaDescription: 'Short',
          keywords: [],
          estimatedReadTime: 1,
        },
        cta: { text: 'Click', description: 'Now' },
      };

      const score = calculateQualityScore(incompleteBlogPost, 'blog');

      expect(score.overall).toBeLessThan(80);
      expect(score.suggestions.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Email Content Generation Tests
// ============================================================================

describe('Email Content Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Structure Validation', () => {
    it('produces valid JSON structure', async () => {
      mockApiResponse(expectedOutputs.email);

      const result = await contentWriter.generateEmailContent({
        product: products.ecommerce as any,
        audience: {
          name: 'Fashion Enthusiasts',
          painPoints: ['Hard to find style'],
          goals: ['Look great'],
        },
        campaign: {
          name: 'Welcome Series',
          goal: 'Drive first subscription',
          type: 'promotional',
        },
      });

      const validation = validateStructure(result, 'email');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('includes all required fields', async () => {
      mockApiResponse(expectedOutputs.email);

      const result = await contentWriter.generateEmailContent({
        product: products.b2b_software as any,
        audience: {
          name: 'Remote Teams',
          painPoints: ['Communication gaps'],
          goals: ['Better collaboration'],
        },
        campaign: {
          name: 'Product Launch',
          goal: 'Drive sign-ups',
          type: 'promotional',
        },
      });

      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('previewText');
      expect(result).toHaveProperty('headline');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('sections');
      expect(result).toHaveProperty('cta');
      expect(result).toHaveProperty('metadata');
    });

    it('has properly typed sections', async () => {
      mockApiResponse(expectedOutputs.email);

      const result = await contentWriter.generateEmailContent({
        product: products.fintech as any,
        audience: {
          name: 'New Investors',
          painPoints: ['Intimidated by investing'],
          goals: ['Build wealth'],
        },
        campaign: {
          name: 'Educational Series',
          goal: 'Increase engagement',
          type: 'educational',
        },
      });

      const validTypes = ['hero', 'content', 'cta', 'footer'];
      result.sections.forEach((section) => {
        expect(validTypes).toContain(section.type);
      });
    });
  });

  describe('Platform Constraints', () => {
    it('respects subject line character limit', async () => {
      mockApiResponse(expectedOutputs.email);

      const result = await contentWriter.generateEmailContent({
        product: products.healthcare_saas as any,
        audience: {
          name: 'Healthcare Providers',
          painPoints: ['Scheduling chaos'],
          goals: ['Efficient operations'],
        },
        campaign: {
          name: 'Product Demo',
          goal: 'Schedule demos',
          type: 'promotional',
        },
      });

      expect(result.subject.length).toBeLessThanOrEqual(60);
    });

    it('respects preview text character limit', async () => {
      mockApiResponse(expectedOutputs.email);

      const result = await contentWriter.generateEmailContent({
        product: products.education_tech as any,
        audience: {
          name: 'Career Changers',
          painPoints: ['Need new skills'],
          goals: ['Tech career'],
        },
        campaign: {
          name: 'Bootcamp Launch',
          goal: 'Drive applications',
          type: 'promotional',
        },
      });

      expect(result.previewText.length).toBeLessThanOrEqual(100);
    });

    it('validates constraint compliance', async () => {
      mockApiResponse(expectedOutputs.email);

      const result = await contentWriter.generateEmailContent({
        product: products.consumer_app as any,
        audience: {
          name: 'Fitness Beginners',
          painPoints: ['Lack motivation'],
          goals: ['Get fit'],
        },
        campaign: {
          name: 'Onboarding',
          goal: 'Activate users',
          type: 'nurture',
        },
      });

      const validation = checkPlatformConstraints(result);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('CTA Structure', () => {
    it('includes primary CTA with URL', async () => {
      mockApiResponse(expectedOutputs.email);

      const result = await contentWriter.generateEmailContent({
        product: products.saas_extensive as any,
        audience: {
          name: 'Data Teams',
          painPoints: ['Manual work'],
          goals: ['Automation'],
        },
        campaign: {
          name: 'Free Trial',
          goal: 'Sign-ups',
          type: 'promotional',
        },
      });

      expect(result.cta.primary).toBeDefined();
      expect(result.cta.primary.text).toBeTruthy();
      expect(result.cta.primary.url).toBeTruthy();
    });

    it('supports optional secondary CTA', async () => {
      const emailWithSecondaryCTA = {
        ...expectedOutputs.email,
        cta: {
          primary: { text: 'Start Free Trial', url: '{{CTA_URL}}' },
          secondary: { text: 'Watch Demo', url: '{{SECONDARY_URL}}' },
        },
      };
      mockApiResponse(emailWithSecondaryCTA);

      const result = await contentWriter.generateEmailContent({
        product: products.b2b_software as any,
        audience: {
          name: 'Team Leaders',
          painPoints: ['Tool sprawl'],
          goals: ['Consolidation'],
        },
        campaign: {
          name: 'Product Tour',
          goal: 'Demo requests',
          type: 'educational',
        },
      });

      if (result.cta.secondary) {
        expect(result.cta.secondary.text).toBeTruthy();
        expect(result.cta.secondary.url).toBeTruthy();
      }
    });
  });

  describe('Campaign Types', () => {
    it('generates promotional campaign correctly', async () => {
      mockApiResponse(expectedOutputs.email);

      const result = await contentWriter.generateEmailContent({
        product: products.ecommerce as any,
        audience: {
          name: 'Subscribers',
          painPoints: ['Need style inspiration'],
          goals: ['Look fashionable'],
        },
        campaign: {
          name: 'Flash Sale',
          goal: 'Drive purchases',
          type: 'promotional',
        },
      });

      expect(result.metadata.campaignType).toBe('promotional');
    });

    it('generates educational campaign correctly', async () => {
      const educationalEmail = {
        ...expectedOutputs.email,
        metadata: { campaignType: 'educational' as const, tone: 'friendly' as const },
      };
      mockApiResponse(educationalEmail);

      const result = await contentWriter.generateEmailContent({
        product: products.fintech as any,
        audience: {
          name: 'Beginner Investors',
          painPoints: ['Confused about investing'],
          goals: ['Learn investing'],
        },
        campaign: {
          name: 'Investment 101',
          goal: 'Educate users',
          type: 'educational',
        },
      });

      expect(result.metadata.campaignType).toBe('educational');
    });
  });
});

// ============================================================================
// Social Post Generation Tests
// ============================================================================

describe('Social Post Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Twitter Posts', () => {
    it('respects Twitter 280 character limit', async () => {
      mockApiResponse(expectedOutputs.socialPost_twitter);

      const result = await contentWriter.generateSocialPost({
        product: products.consumer_app as any,
        platform: 'twitter',
        topic: 'Fitness motivation',
      });

      result.posts.forEach((post) => {
        expect(post.text.length).toBeLessThanOrEqual(280);
        expect(post.characterCount).toBeLessThanOrEqual(280);
      });
    });

    it('includes appropriate hashtags for Twitter', async () => {
      mockApiResponse(expectedOutputs.socialPost_twitter);

      const result = await contentWriter.generateSocialPost({
        product: products.saas_extensive as any,
        platform: 'twitter',
        topic: 'Data analytics tips',
      });

      result.posts.forEach((post) => {
        expect(post.hashtags.length).toBeLessThanOrEqual(3);
        expect(Array.isArray(post.hashtags)).toBe(true);
      });
    });

    it('generates multiple post variations', async () => {
      mockApiResponse(expectedOutputs.socialPost_twitter);

      const result = await contentWriter.generateSocialPost({
        product: products.b2b_software as any,
        platform: 'twitter',
        topic: 'Remote work productivity',
      });

      expect(result.posts.length).toBeGreaterThan(0);
    });

    it('validates platform constraints', async () => {
      mockApiResponse(expectedOutputs.socialPost_twitter);

      const result = await contentWriter.generateSocialPost({
        product: products.education_tech as any,
        platform: 'twitter',
        topic: 'Career change success',
      });

      const validation = checkPlatformConstraints(result, 'twitter');
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('LinkedIn Posts', () => {
    it('allows longer content for LinkedIn', async () => {
      mockApiResponse(expectedOutputs.socialPost_linkedin);

      const result = await contentWriter.generateSocialPost({
        product: products.saas_extensive as any,
        platform: 'linkedin',
        topic: 'Enterprise analytics transformation',
      });

      result.posts.forEach((post) => {
        expect(post.text.length).toBeLessThanOrEqual(3000);
      });
    });

    it('uses professional tone for LinkedIn', async () => {
      mockApiResponse(expectedOutputs.socialPost_linkedin);

      const result = await contentWriter.generateSocialPost({
        product: products.healthcare_saas as any,
        platform: 'linkedin',
        topic: 'Healthcare efficiency',
      });

      expect(result.platform).toBe('linkedin');
      expect(result.posts.length).toBeGreaterThan(0);
    });

    it('includes appropriate hashtags for LinkedIn', async () => {
      mockApiResponse(expectedOutputs.socialPost_linkedin);

      const result = await contentWriter.generateSocialPost({
        product: products.fintech as any,
        platform: 'linkedin',
        topic: 'Investment strategies',
      });

      result.posts.forEach((post) => {
        expect(post.hashtags.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Instagram Posts', () => {
    it('respects Instagram character limit', async () => {
      mockApiResponse(expectedOutputs.socialPost_instagram);

      const result = await contentWriter.generateSocialPost({
        product: products.ecommerce as any,
        platform: 'instagram',
        topic: 'Style inspiration',
      });

      result.posts.forEach((post) => {
        expect(post.text.length).toBeLessThanOrEqual(2200);
      });
    });

    it('includes visual recommendations', async () => {
      mockApiResponse(expectedOutputs.socialPost_instagram);

      const result = await contentWriter.generateSocialPost({
        product: products.consumer_app as any,
        platform: 'instagram',
        topic: 'Fitness journey',
      });

      expect(result.mediaRecommendations).toBeDefined();
      expect(result.mediaRecommendations.type).toBeTruthy();
      expect(Array.isArray(result.mediaRecommendations.suggestions)).toBe(true);
    });

    it('allows more hashtags for Instagram', async () => {
      mockApiResponse(expectedOutputs.socialPost_instagram);

      const result = await contentWriter.generateSocialPost({
        product: products.ecommerce as any,
        platform: 'instagram',
        topic: 'Fashion trends',
      });

      result.posts.forEach((post) => {
        expect(post.hashtags.length).toBeLessThanOrEqual(30);
      });
    });
  });

  describe('Platform Variations', () => {
    it('varies content by platform', async () => {
      const twitterOutput = expectedOutputs.socialPost_twitter;
      const linkedinOutput = expectedOutputs.socialPost_linkedin;

      mockApiResponse(twitterOutput);
      const twitter = await contentWriter.generateSocialPost({
        product: products.b2b_software as any,
        platform: 'twitter',
        topic: 'Team collaboration',
      });

      mockApiResponse(linkedinOutput);
      const linkedin = await contentWriter.generateSocialPost({
        product: products.b2b_software as any,
        platform: 'linkedin',
        topic: 'Team collaboration',
      });

      expect(twitter.platform).toBe('twitter');
      expect(linkedin.platform).toBe('linkedin');
      expect(twitter.posts[0].text.length).toBeLessThan(linkedin.posts[0].text.length);
    });
  });

  describe('Media Recommendations', () => {
    it('includes media recommendations', async () => {
      mockApiResponse(expectedOutputs.socialPost_twitter);

      const result = await contentWriter.generateSocialPost({
        product: products.saas_extensive as any,
        platform: 'twitter',
        topic: 'Analytics insights',
      });

      expect(result.mediaRecommendations).toBeDefined();
      expect(result.mediaRecommendations.type).toBeTruthy();
      expect(result.mediaRecommendations.description).toBeTruthy();
      expect(Array.isArray(result.mediaRecommendations.suggestions)).toBe(true);
    });
  });
});

// ============================================================================
// Landing Page Generation Tests
// ============================================================================

describe('Landing Page Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Structure Validation', () => {
    it('produces valid JSON structure', async () => {
      mockApiResponse(expectedOutputs.landingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.saas_extensive as any,
        audience: {
          name: 'Enterprise Leaders',
          painPoints: ['Data complexity'],
          goals: ['Better insights'],
        },
        cta: {
          primary: 'Start Free Trial',
          goal: 'signup',
        },
      });

      const validation = validateStructure(result, 'landing');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('includes all required sections', async () => {
      mockApiResponse(expectedOutputs.landingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.b2b_software as any,
        audience: {
          name: 'Remote Teams',
          painPoints: ['Scattered tools'],
          goals: ['Unified workspace'],
        },
        cta: {
          primary: 'Get Started',
          goal: 'signup',
        },
      });

      expect(result.sections).toHaveProperty('hero');
      expect(result.sections).toHaveProperty('valueProposition');
      expect(result.sections).toHaveProperty('features');
      expect(result.sections).toHaveProperty('socialProof');
      expect(result.sections).toHaveProperty('faq');
      expect(result.sections).toHaveProperty('finalCta');
    });

    it('has properly structured hero section', async () => {
      mockApiResponse(expectedOutputs.landingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.fintech as any,
        audience: {
          name: 'New Investors',
          painPoints: ['High fees'],
          goals: ['Grow wealth'],
        },
        cta: {
          primary: 'Start Investing',
          goal: 'signup',
        },
      });

      expect(result.sections.hero).toHaveProperty('headline');
      expect(result.sections.hero).toHaveProperty('subheadline');
      expect(result.sections.hero).toHaveProperty('cta');
      expect(result.sections.hero.cta).toHaveProperty('text');
    });

    it('has feature items with benefits', async () => {
      mockApiResponse(expectedOutputs.landingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.healthcare_saas as any,
        audience: {
          name: 'Healthcare Providers',
          painPoints: ['No-shows', 'Admin burden'],
          goals: ['Efficiency'],
        },
        cta: {
          primary: 'Book Demo',
          goal: 'demo',
        },
      });

      expect(Array.isArray(result.sections.features.items)).toBe(true);
      expect(result.sections.features.items.length).toBeGreaterThan(0);

      result.sections.features.items.forEach((item) => {
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('benefit');
      });
    });

    it('includes FAQ section with Q&A pairs', async () => {
      mockApiResponse(expectedOutputs.landingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.education_tech as any,
        audience: {
          name: 'Career Changers',
          painPoints: ['Outdated skills'],
          goals: ['Tech career'],
        },
        cta: {
          primary: 'Apply Now',
          goal: 'signup',
        },
      });

      expect(result.sections.faq).toBeDefined();
      expect(Array.isArray(result.sections.faq.questions)).toBe(true);
      expect(result.sections.faq.questions.length).toBeGreaterThanOrEqual(3);

      result.sections.faq.questions.forEach((qa) => {
        expect(qa).toHaveProperty('question');
        expect(qa).toHaveProperty('answer');
        expect(qa.question).toBeTruthy();
        expect(qa.answer).toBeTruthy();
      });
    });
  });

  describe('Value Proposition', () => {
    it('includes at least 3 value points', async () => {
      mockApiResponse(expectedOutputs.landingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.consumer_app as any,
        audience: {
          name: 'Fitness Beginners',
          painPoints: ['Boring gyms'],
          goals: ['Fun fitness'],
        },
        cta: {
          primary: 'Download App',
          goal: 'download',
        },
      });

      expect(result.sections.valueProposition.points.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Social Proof', () => {
    it('includes social proof section', async () => {
      mockApiResponse(expectedOutputs.landingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.ecommerce as any,
        audience: {
          name: 'Fashion Lovers',
          painPoints: ['Hard to find style'],
          goals: ['Look great'],
        },
        cta: {
          primary: 'Subscribe Now',
          goal: 'purchase',
        },
      });

      expect(result.sections.socialProof).toBeDefined();
      expect(result.sections.socialProof.headline).toBeTruthy();
      expect(Array.isArray(result.sections.socialProof.statsToHighlight)).toBe(true);
    });
  });

  describe('CTA Goals', () => {
    it('aligns with signup goal', async () => {
      mockApiResponse(expectedOutputs.landingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.saas_extensive as any,
        audience: {
          name: 'Business Teams',
          painPoints: ['Poor analytics'],
          goals: ['Better insights'],
        },
        cta: {
          primary: 'Start Free Trial',
          goal: 'signup',
        },
      });

      expect(result.metadata.pageGoal).toBe('signup');
    });

    it('aligns with demo goal', async () => {
      const demoLandingPage = {
        ...expectedOutputs.landingPage,
        metadata: {
          ...expectedOutputs.landingPage.metadata,
          pageGoal: 'demo' as const,
        },
      };
      mockApiResponse(demoLandingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.healthcare_saas as any,
        audience: {
          name: 'Clinic Owners',
          painPoints: ['Scheduling chaos'],
          goals: ['Streamlined operations'],
        },
        cta: {
          primary: 'Schedule Demo',
          goal: 'demo',
        },
      });

      expect(result.metadata.pageGoal).toBe('demo');
    });
  });

  describe('SEO Metadata', () => {
    it('includes proper SEO metadata', async () => {
      mockApiResponse(expectedOutputs.landingPage);

      const result = await contentWriter.generateLandingPage({
        product: products.b2b_software as any,
        audience: {
          name: 'Project Managers',
          painPoints: ['Project delays'],
          goals: ['On-time delivery'],
        },
        cta: {
          primary: 'Try TeamSync',
          goal: 'signup',
        },
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.metaDescription).toBeTruthy();
      expect(Array.isArray(result.metadata.keywords)).toBe(true);
      expect(result.metadata.keywords.length).toBeGreaterThan(0);

      const validation = checkPlatformConstraints(result);
      expect(validation.errors.length).toBe(0);
    });
  });
});

// ============================================================================
// Hallucination Detection Tests
// ============================================================================

describe('Hallucination Detection', () => {
  it('detects unverified numeric claims', () => {
    const content = {
      title: 'Amazing Product',
      body: 'Our product increases productivity by 500% and saves 100 hours per week!',
    };

    const verifiedClaims = ['Used by 1000 customers'];

    const result = detectHallucinations(content, verifiedClaims);

    expect(result.hasPotentialHallucinations).toBe(true);
    expect(result.suspiciousClaims.length).toBeGreaterThan(0);
  });

  it('detects unverified superlatives', () => {
    const content = {
      title: 'The Best Analytics Platform Ever',
      body: 'We are the fastest and most accurate solution on the market.',
    };

    const verifiedClaims = ['SOC2 compliant', '99.9% uptime'];

    const result = detectHallucinations(content, verifiedClaims);

    expect(result.hasPotentialHallucinations).toBe(true);
    expect(result.suspiciousClaims.some((c) => c.includes('best') || c.includes('fastest'))).toBe(
      true
    );
  });

  it('accepts verified claims', () => {
    const content = {
      title: 'Trusted by 15,000 Companies',
      body: 'We process over 10 billion data points daily with 99.99% uptime.',
    };

    const verifiedClaims = [
      'Trusted by 15,000+ companies worldwide',
      'Processes over 10 billion data points daily',
      '99.99% uptime SLA guarantee',
    ];

    const result = detectHallucinations(content, verifiedClaims);

    expect(result.verifiedClaimsCovered.length).toBeGreaterThan(0);
  });

  it('identifies verified claims coverage', () => {
    const content = {
      title: 'Award-Winning Analytics',
      body: 'Named Leader in Gartner Magic Quadrant for Analytics 2024',
    };

    const verifiedClaims = ['Named Leader in Gartner Magic Quadrant for Analytics 2024'];

    const result = detectHallucinations(content, verifiedClaims);

    expect(result.verifiedClaimsCovered).toContain(verifiedClaims[0]);
  });
});

// ============================================================================
// Quality Scoring Tests
// ============================================================================

describe('Quality Scoring', () => {
  it('gives high scores to complete, valid content', () => {
    const score = calculateQualityScore(expectedOutputs.blogPost, 'blog');

    expect(score.overall).toBeGreaterThanOrEqual(80);
    expect(score.breakdown.structure).toBeGreaterThan(20);
    expect(score.breakdown.completeness).toBeGreaterThan(20);
    expect(score.breakdown.constraints).toBeGreaterThan(20);
  });

  it('penalizes incomplete content', () => {
    const incompleteEmail = {
      subject: 'Hi',
      previewText: 'Preview',
      headline: 'Headline',
      body: 'Body',
      sections: [],
      cta: { primary: { text: 'Click', url: 'url' } },
      metadata: { campaignType: 'promotional' as const, tone: 'casual' as const },
    };

    const score = calculateQualityScore(incompleteEmail, 'email');

    expect(score.overall).toBeLessThan(100);
    expect(score.suggestions.length).toBeGreaterThan(0);
  });

  it('detects placeholder text', () => {
    const contentWithPlaceholders = {
      ...expectedOutputs.blogPost,
      body: 'Lorem ipsum dolor sit amet',
    };

    const score = calculateQualityScore(contentWithPlaceholders, 'blog');

    expect(score.overall).toBeLessThan(80);
    expect(score.issues.some((i) => i.includes('placeholder'))).toBe(true);
  });

  it('identifies weak language', () => {
    const weakContent = {
      ...expectedOutputs.landingPage,
      sections: {
        ...expectedOutputs.landingPage.sections,
        hero: {
          headline: 'Click here to learn more',
          subheadline: 'Click now to read more',
          cta: { text: 'Click here', description: 'Learn more' },
        },
      },
    };

    const score = calculateQualityScore(weakContent, 'landing');

    expect(score.suggestions.some((s) => s.includes('generic'))).toBe(true);
  });

  it('provides actionable suggestions', () => {
    const shortBlogPost = {
      title: 'Test',
      slug: 'test',
      excerpt: 'Short',
      body: 'Very short body',
      sections: [{ heading: 'One', content: 'Section' }],
      metadata: {
        metaDescription: 'Too short description',
        keywords: ['one'],
        estimatedReadTime: 1,
      },
      cta: { text: 'CTA', description: 'Description' },
    };

    const score = calculateQualityScore(shortBlogPost, 'blog');

    expect(score.suggestions.length).toBeGreaterThan(0);
    expect(score.overall).toBeLessThan(80);
  });
});

// ============================================================================
// Cross-Content Type Tests
// ============================================================================

describe('Cross-Content Type Validation', () => {
  it('rejects blog post structure for email content type', () => {
    const validation = validateStructure(expectedOutputs.blogPost, 'email');

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('rejects email structure for blog content type', () => {
    const validation = validateStructure(expectedOutputs.email, 'blog');

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('rejects social post structure for landing page type', () => {
    const validation = validateStructure(expectedOutputs.socialPost_twitter, 'landing');

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
