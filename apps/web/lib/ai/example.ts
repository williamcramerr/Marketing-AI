/**
 * Example Usage of AI Content Generation System
 *
 * This file demonstrates how to use the content generation functions.
 * Copy and adapt these examples for your specific use cases.
 */

import {
  generateBlogPost,
  generateEmailContent,
  generateSocialPost,
  generateLandingPage,
  reviseContent,
  type ProductContext,
  type AudienceContext,
} from './index';

// ============================================================================
// Sample Product Context
// ============================================================================

const exampleProduct: ProductContext = {
  name: 'Marketing Pilot AI',
  description:
    'AI-powered marketing content generation platform that helps teams create high-quality, on-brand content in minutes.',
  positioning: 'The fastest way to generate professional marketing content with AI',
  verifiedClaims: [
    'Generate blog posts 10x faster than manual writing',
    'Maintains consistent brand voice across all content',
    'Used by 500+ marketing teams worldwide',
    'Supports 15+ content types and formats',
  ],
  features: [
    'AI-powered content generation using Claude 3.5 Sonnet',
    'Brand guidelines integration',
    'Multi-format support (blog, email, social, landing pages)',
    'Content revision based on feedback',
    'Team collaboration tools',
    'Analytics and performance tracking',
  ],
  benefits: [
    'Save 20+ hours per week on content creation',
    'Ensure brand consistency across all channels',
    'Scale content production without hiring',
    'Get to market faster with quick iterations',
    'Data-driven content optimization',
  ],
  brandGuidelines: {
    tone: 'Professional yet approachable, innovative, helpful',
    voice: 'Expert guide, confident but not arrogant, focused on customer success',
    keywords: ['AI marketing', 'content generation', 'productivity', 'efficiency', 'automation'],
    avoidWords: ['cheap', 'basic', 'simple', 'just', 'easy'],
  },
};

// ============================================================================
// Sample Audience Contexts
// ============================================================================

const marketingManager: AudienceContext = {
  name: 'Marketing Managers',
  demographics: 'Ages 30-45, B2B and B2C companies, 5-15 years marketing experience',
  painPoints: [
    'Overwhelmed by content demands from stakeholders',
    'Struggling to maintain brand consistency',
    'Limited budget for content writers',
    'Slow content production cycles',
    'Difficulty scaling content for multiple channels',
  ],
  goals: [
    'Increase content output without sacrificing quality',
    'Maintain consistent brand voice',
    'Prove marketing ROI with better content',
    'Free up time for strategy over execution',
  ],
  psychographics:
    'Data-driven, strategic thinkers who value efficiency and results. Early adopters of marketing technology.',
};

const contentCreator: AudienceContext = {
  name: 'Content Creators & Copywriters',
  demographics: 'Ages 25-40, freelance or in-house, 3-10 years experience',
  painPoints: [
    'Writer\'s block and creative fatigue',
    'Tight deadlines with high volume demands',
    'Repetitive content requests',
    'Need to write for unfamiliar industries',
  ],
  goals: [
    'Overcome writer\'s block with AI assistance',
    'Deliver more content in less time',
    'Focus on creative work, not repetitive tasks',
    'Maintain quality while increasing output',
  ],
  psychographics:
    'Creative professionals who see AI as a tool to enhance their work, not replace it. Value quality and efficiency.',
};

// ============================================================================
// Example 1: Generate a Blog Post
// ============================================================================

export async function exampleBlogPost() {
  console.log('Generating blog post...');

  const blogPost = await generateBlogPost({
    product: exampleProduct,
    audience: marketingManager,
    topic: 'How AI is Transforming Marketing Content Creation in 2025',
    keywords: ['AI marketing', 'content creation', 'marketing automation', 'productivity'],
    tone: 'informative and forward-thinking',
  });

  console.log('\n=== Blog Post Generated ===');
  console.log('Title:', blogPost.title);
  console.log('Slug:', blogPost.slug);
  console.log('Excerpt:', blogPost.excerpt);
  console.log('Read Time:', blogPost.metadata.estimatedReadTime, 'minutes');
  console.log('Keywords:', blogPost.metadata.keywords.join(', '));
  console.log('\nSections:');
  blogPost.sections.forEach((section, i) => {
    console.log(`${i + 1}. ${section.heading}`);
  });
  console.log('\nCTA:', blogPost.cta.text);

  return blogPost;
}

// ============================================================================
// Example 2: Generate Email Content
// ============================================================================

export async function exampleEmail() {
  console.log('Generating email content...');

  const email = await generateEmailContent({
    product: exampleProduct,
    audience: marketingManager,
    campaign: {
      name: 'Product Launch - AI Content Generator',
      goal: 'Drive sign-ups for free trial',
      type: 'promotional',
    },
    tone: 'exciting but professional',
  });

  console.log('\n=== Email Content Generated ===');
  console.log('Subject:', email.subject);
  console.log('Preview Text:', email.previewText);
  console.log('Headline:', email.headline);
  console.log('Campaign Type:', email.metadata.campaignType);
  console.log('Tone:', email.metadata.tone);
  console.log('\nSections:');
  email.sections.forEach((section, i) => {
    console.log(`${i + 1}. ${section.type}`);
  });
  console.log('\nPrimary CTA:', email.cta.primary.text);

  return email;
}

// ============================================================================
// Example 3: Generate Social Media Posts
// ============================================================================

export async function exampleSocialPost() {
  console.log('Generating social media posts...');

  const socialPost = await generateSocialPost({
    product: exampleProduct,
    platform: 'linkedin',
    topic: '5 signs your marketing team needs AI-powered content tools',
    tone: 'professional and thought-provoking',
    includeLink: true,
  });

  console.log('\n=== Social Media Posts Generated ===');
  console.log('Platform:', socialPost.platform);
  console.log('Content Pillar:', socialPost.metadata.contentPillar);
  console.log('Expected Engagement:', socialPost.metadata.expectedEngagement);
  console.log('Best Time to Post:', socialPost.metadata.bestTimeToPost);

  socialPost.posts.forEach((post, i) => {
    console.log(`\nPost ${i + 1}:`);
    console.log(post.text);
    console.log('Hashtags:', post.hashtags.join(' '));
    console.log('Character Count:', post.characterCount);
  });

  console.log('\nMedia Recommendation:', socialPost.mediaRecommendations.type);
  console.log('Description:', socialPost.mediaRecommendations.description);

  return socialPost;
}

// ============================================================================
// Example 4: Generate Landing Page
// ============================================================================

export async function exampleLandingPage() {
  console.log('Generating landing page...');

  const landingPage = await generateLandingPage({
    product: exampleProduct,
    audience: marketingManager,
    cta: {
      primary: 'Start Free Trial',
      goal: 'signup',
    },
    tone: 'compelling and benefit-focused',
  });

  console.log('\n=== Landing Page Generated ===');
  console.log('Title:', landingPage.title);
  console.log('Page Goal:', landingPage.metadata.pageGoal);

  console.log('\n--- Hero Section ---');
  console.log('Headline:', landingPage.sections.hero.headline);
  console.log('Subheadline:', landingPage.sections.hero.subheadline);
  console.log('CTA:', landingPage.sections.hero.cta.text);

  console.log('\n--- Value Proposition ---');
  console.log('Headline:', landingPage.sections.valueProposition.headline);
  landingPage.sections.valueProposition.points.forEach((point, i) => {
    console.log(`${i + 1}. ${point}`);
  });

  console.log('\n--- Features ---');
  console.log('Count:', landingPage.sections.features.items.length);

  console.log('\n--- FAQ ---');
  console.log('Questions:', landingPage.sections.faq.questions.length);

  console.log('\n--- Final CTA ---');
  console.log('Headline:', landingPage.sections.finalCta.headline);
  console.log('Button:', landingPage.sections.finalCta.buttonText);

  return landingPage;
}

// ============================================================================
// Example 5: Revise Content
// ============================================================================

export async function exampleRevision() {
  console.log('Generating initial blog post...');

  // First, generate initial content
  const originalBlogPost = await generateBlogPost({
    product: exampleProduct,
    audience: contentCreator,
    topic: 'Overcoming Writer\'s Block with AI',
  });

  console.log('Original Title:', originalBlogPost.title);

  // Now revise it based on feedback
  console.log('\nRevising with feedback...');

  const revisedBlogPost = await reviseContent({
    originalContent: originalBlogPost,
    feedback: `
      1. Make the tone more empathetic and understanding
      2. Add specific examples of how AI helps with different types of writer's block
      3. Include more actionable tips readers can implement immediately
      4. Shorten the introduction and get to the value faster
    `,
    contentType: 'blog',
  });

  console.log('\n=== Revision Complete ===');
  console.log('Original Title:', originalBlogPost.title);
  console.log('Revised Title:', revisedBlogPost.title);
  console.log('\nChanges applied based on feedback.');

  return { original: originalBlogPost, revised: revisedBlogPost };
}

// ============================================================================
// Example 6: Batch Generation
// ============================================================================

export async function exampleBatchGeneration() {
  console.log('Generating multiple content pieces in parallel...');

  const [blogPost, email, socialPost] = await Promise.all([
    generateBlogPost({
      product: exampleProduct,
      audience: marketingManager,
      topic: 'AI Content Strategy for 2025',
    }),
    generateEmailContent({
      product: exampleProduct,
      audience: marketingManager,
      campaign: {
        name: 'Weekly Newsletter',
        goal: 'Engagement and education',
        type: 'educational',
      },
    }),
    generateSocialPost({
      product: exampleProduct,
      platform: 'twitter',
      topic: 'Quick marketing tip of the day',
    }),
  ]);

  console.log('\n=== Batch Generation Complete ===');
  console.log('Blog Post:', blogPost.title);
  console.log('Email:', email.subject);
  console.log('Social Post:', socialPost.posts[0].text.substring(0, 50) + '...');

  return { blogPost, email, socialPost };
}

// ============================================================================
// Run Examples (Uncomment to test)
// ============================================================================

/*
async function runExamples() {
  try {
    // Run individual examples
    await exampleBlogPost();
    await exampleEmail();
    await exampleSocialPost();
    await exampleLandingPage();
    await exampleRevision();
    await exampleBatchGeneration();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Uncomment to run:
// runExamples();
*/
