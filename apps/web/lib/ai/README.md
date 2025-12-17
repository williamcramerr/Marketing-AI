# AI Content Generation System

This module provides AI-powered content generation capabilities for Marketing Pilot AI using Anthropic's Claude AI.

## Installation

First, install the required Anthropic SDK dependency:

```bash
# From the project root
pnpm add @anthropic-ai/sdk --filter @marketing-pilot/web
```

## Environment Setup

Add your Anthropic API key to `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your API key from: https://console.anthropic.com/

## Features

- **Blog Post Generation**: Create comprehensive, SEO-optimized blog posts
- **Email Content**: Generate compelling email campaigns
- **Social Media Posts**: Create platform-optimized social content
- **Landing Pages**: Build high-converting landing page copy
- **Content Revision**: Refine content based on feedback

## Usage Examples

### Blog Post Generation

```typescript
import { generateBlogPost } from '@/lib/ai';

const blogPost = await generateBlogPost({
  product: {
    name: "TaskMaster Pro",
    description: "AI-powered task management platform",
    positioning: "The smartest way to organize your work",
    verifiedClaims: [
      "Increases team productivity by 40%",
      "Trusted by over 10,000 companies worldwide"
    ],
    features: [
      "AI-powered task prioritization",
      "Real-time team collaboration",
      "Smart deadline predictions"
    ],
    benefits: [
      "Save 10+ hours per week",
      "Never miss a deadline",
      "Improve team coordination"
    ],
    brandGuidelines: {
      tone: "Professional yet approachable",
      voice: "Confident and helpful",
      keywords: ["productivity", "efficiency", "collaboration"],
      avoidWords: ["cheap", "basic"]
    }
  },
  audience: {
    name: "Busy Professionals",
    demographics: "Ages 28-45, working in tech and creative industries",
    painPoints: [
      "Overwhelmed by too many tasks",
      "Poor team communication",
      "Missing important deadlines"
    ],
    goals: [
      "Better time management",
      "Increased productivity",
      "Stress-free work environment"
    ]
  },
  topic: "5 Ways AI is Revolutionizing Task Management in 2025",
  keywords: ["AI task management", "productivity tools", "work efficiency"]
});

console.log(blogPost.title);
console.log(blogPost.body);
```

### Email Content Generation

```typescript
import { generateEmailContent } from '@/lib/ai';

const email = await generateEmailContent({
  product: productContext,
  audience: audienceContext,
  campaign: {
    name: "Product Launch - Beta Program",
    goal: "Drive sign-ups for beta program",
    type: "promotional"
  },
  tone: "exciting and urgent"
});

console.log(email.subject);
console.log(email.body);
```

### Social Media Post

```typescript
import { generateSocialPost } from '@/lib/ai';

const socialPost = await generateSocialPost({
  product: productContext,
  platform: "linkedin",
  topic: "Productivity tips for remote teams",
  tone: "professional and insightful",
  includeLink: true
});

console.log(socialPost.posts[0].text);
console.log(socialPost.posts[0].hashtags);
```

### Landing Page

```typescript
import { generateLandingPage } from '@/lib/ai';

const landingPage = await generateLandingPage({
  product: productContext,
  audience: audienceContext,
  cta: {
    primary: "Start Free Trial",
    goal: "signup"
  },
  tone: "compelling and benefit-focused"
});

console.log(landingPage.sections.hero.headline);
console.log(landingPage.sections.features);
```

### Content Revision

```typescript
import { reviseContent } from '@/lib/ai';

const revisedBlogPost = await reviseContent({
  originalContent: blogPost,
  feedback: "Make the tone more professional and add more specific data points about productivity gains",
  contentType: "blog"
});
```

## Type Definitions

All generated content follows strict TypeScript types for consistency:

- `BlogPostOutput`: Blog post structure with title, body, sections, metadata, and CTA
- `EmailContentOutput`: Email structure with subject, preview, body, sections, and CTAs
- `SocialPostOutput`: Social media posts with platform-specific formatting
- `LandingPageOutput`: Complete landing page structure with hero, features, FAQ, etc.

## Architecture

The system is organized into three main files:

### 1. `client.ts`
- Configures the Anthropic SDK client
- Handles API authentication
- Provides error handling utilities
- Defines model and temperature presets

### 2. `prompts.ts`
- Contains all system prompts for different content types
- Defines context builders for products and audiences
- Exports TypeScript interfaces for input data

### 3. `content-writer.ts`
- Main content generation functions
- Type-safe interfaces for all inputs and outputs
- Revision and batch generation capabilities

## Best Practices

### 1. Provide Detailed Context

The more context you provide about your product and audience, the better the generated content:

```typescript
const product: ProductContext = {
  name: "Your Product",
  description: "Detailed description",
  positioning: "Clear positioning statement",
  verifiedClaims: ["Only factual, verified claims"],
  features: ["Specific features"],
  benefits: ["Clear user benefits"],
  brandGuidelines: {
    tone: "How your brand sounds",
    voice: "Your brand personality",
    keywords: ["Important", "brand", "terms"],
    avoidWords: ["Words", "to", "avoid"]
  }
};
```

### 2. Use Verified Claims Only

Only include claims you can verify and substantiate. The AI will use these as the basis for content:

```typescript
verifiedClaims: [
  "Increases productivity by 40% (based on user study)",
  "Used by 10,000+ companies",
  "4.8/5 star rating on G2"
]
```

### 3. Define Clear Audience Personas

```typescript
const audience: AudienceContext = {
  name: "Product Managers",
  demographics: "Ages 30-45, B2B SaaS companies",
  painPoints: [
    "Struggling to prioritize features",
    "Poor stakeholder communication"
  ],
  goals: [
    "Build better products",
    "Improve team alignment"
  ],
  psychographics: "Data-driven, collaborative, always learning"
};
```

### 4. Handle Errors Gracefully

```typescript
try {
  const content = await generateBlogPost(params);
  return content;
} catch (error) {
  console.error('Content generation failed:', error);
  // Handle error appropriately
}
```

### 5. Rate Limiting

Be mindful of API rate limits when generating multiple pieces of content:

```typescript
// Generate multiple pieces with controlled concurrency
const content = await generateBatch([
  () => generateBlogPost(blogParams),
  () => generateEmailContent(emailParams),
  // Limit to reasonable batch sizes
]);
```

## Model Configuration

The system uses Claude 3.5 Sonnet by default, which provides the best balance of quality, speed, and cost for marketing content.

You can customize the model and parameters:

```typescript
import { createMessageParams, MODELS, TEMPERATURE_PRESETS } from '@/lib/ai';

const params = createMessageParams({
  model: MODELS.SONNET, // or MODELS.OPUS for more complex tasks
  temperature: TEMPERATURE_PRESETS.CREATIVE,
  max_tokens: 8192 // for longer content
});
```

## Error Handling

The system provides comprehensive error handling:

- **401 Errors**: Invalid API key
- **429 Errors**: Rate limit exceeded
- **500/529 Errors**: Service unavailable
- **Parse Errors**: Invalid JSON response

All errors are logged and converted to user-friendly messages.

## Advanced Usage

### Custom Prompts

You can use the lower-level client for custom prompts:

```typescript
import { anthropic, DEFAULT_MESSAGE_PARAMS } from '@/lib/ai';

const message = await anthropic.messages.create({
  ...DEFAULT_MESSAGE_PARAMS,
  messages: [
    {
      role: 'user',
      content: 'Your custom prompt here'
    }
  ],
  system: 'Your custom system prompt'
});
```

### Streaming Responses

For long-form content, you can use streaming:

```typescript
const stream = await anthropic.messages.create({
  ...DEFAULT_MESSAGE_PARAMS,
  stream: true,
  messages: [{ role: 'user', content: 'Generate content...' }]
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

## Testing

Example test structure:

```typescript
describe('Content Generation', () => {
  it('should generate a blog post', async () => {
    const result = await generateBlogPost({
      product: mockProductContext,
      audience: mockAudienceContext,
      topic: 'Test Topic'
    });

    expect(result.title).toBeDefined();
    expect(result.body).toBeDefined();
    expect(result.sections.length).toBeGreaterThan(0);
  });
});
```

## Cost Optimization

Tips for managing API costs:

1. **Cache Results**: Store generated content to avoid regeneration
2. **Use Batch Generation**: Generate multiple pieces in one session
3. **Set Reasonable Token Limits**: Default is 4096, adjust based on needs
4. **Monitor Usage**: Track API calls and costs via Anthropic Console

## Support

- Anthropic Documentation: https://docs.anthropic.com/
- Claude API Reference: https://docs.anthropic.com/claude/reference/
- Rate Limits: https://docs.anthropic.com/claude/reference/rate-limits

## License

Part of Marketing Pilot AI - Internal Use Only
