# AI Prompt Quality Testing Framework

This directory contains a comprehensive testing framework for validating AI-generated marketing content quality across all content types (blog posts, emails, social posts, and landing pages).

## Overview

The testing framework ensures that:
- AI-generated content matches expected JSON schemas
- Platform-specific constraints are respected (character limits, hashtag counts, etc.)
- Content quality meets minimum standards
- Hallucinations and unverified claims are detected
- All tests use MOCKED responses (no actual API calls)

## Structure

```
__tests__/
├── fixtures/
│   ├── products.json           # Test product profiles (8 diverse examples)
│   └── expected-outputs.json   # Golden output examples for each content type
├── prompt-quality.test.ts      # Comprehensive test suite
└── README.md                   # This file
```

## Test Product Fixtures

The `products.json` file contains 8 diverse product profiles:

1. **minimal** - Bare minimum fields for edge case testing
2. **saas_extensive** - Enterprise SaaS with comprehensive details
3. **ecommerce** - Fashion subscription box
4. **b2b_software** - Team collaboration platform
5. **consumer_app** - Gamified fitness app
6. **fintech** - AI investment platform
7. **education_tech** - Coding bootcamp
8. **healthcare_saas** - HIPAA-compliant scheduling software

Each product includes:
- Basic information (name, description, positioning)
- Brand guidelines (tone, voice, keywords)
- Verified claims (factual statements only)
- Features and benefits

## Expected Output Fixtures

The `expected-outputs.json` file contains golden examples for:

- **blogPost** - Well-structured blog post with SEO metadata
- **email** - Professional email with proper sections and CTAs
- **socialPost_twitter** - Twitter posts respecting 280-char limit
- **socialPost_linkedin** - Professional LinkedIn content
- **socialPost_instagram** - Visual-focused Instagram posts
- **landingPage** - Complete landing page with all sections

## Running Tests

```bash
# Run all AI prompt quality tests
pnpm test prompt-quality

# Run tests in watch mode
pnpm test prompt-quality --watch

# Run with coverage
pnpm test:coverage prompt-quality

# Run specific test suite
pnpm test prompt-quality -t "Blog Post Generation"
```

## Test Coverage

### Blog Post Generation
- ✓ Valid JSON structure validation
- ✓ Required fields presence
- ✓ Section structure validation
- ✓ SEO constraints (meta description, keywords, title length)
- ✓ Edge cases (minimal and extensive input)
- ✓ Quality scoring

### Email Content Generation
- ✓ Valid JSON structure validation
- ✓ Required fields presence
- ✓ Section type validation
- ✓ Subject line character limit (≤60 chars)
- ✓ Preview text character limit (≤100 chars)
- ✓ CTA structure (primary and optional secondary)
- ✓ Campaign type validation

### Social Post Generation
- ✓ Twitter: 280 character limit
- ✓ LinkedIn: 3000 character limit
- ✓ Instagram: 2200 character limit
- ✓ Platform-specific hashtag limits
- ✓ Multiple post variations
- ✓ Media recommendations
- ✓ Cross-platform content variation

### Landing Page Generation
- ✓ Valid JSON structure validation
- ✓ All required sections (hero, value prop, features, social proof, FAQ, final CTA)
- ✓ Feature items with benefits
- ✓ FAQ with Q&A pairs (minimum 3)
- ✓ Value proposition points (minimum 3)
- ✓ SEO metadata
- ✓ Goal alignment (signup, demo, purchase, download)

### Hallucination Detection
- ✓ Unverified numeric claims detection
- ✓ Unverified superlatives detection
- ✓ Verified claims coverage tracking
- ✓ Suspicious claim flagging

### Quality Scoring
- ✓ Structure validation (0-25 points)
- ✓ Completeness scoring (0-25 points)
- ✓ Constraint compliance (0-25 points)
- ✓ Relevance and quality (0-25 points)
- ✓ Placeholder text detection
- ✓ Weak language identification
- ✓ Actionable suggestions

## Platform Constraints

The framework validates the following constraints:

### Email
- Subject line: max 60 characters (recommended 50)
- Preview text: max 100 characters (recommended 80)

### Twitter
- Post length: max 280 characters
- Hashtags: max 3 (recommended 2)

### LinkedIn
- Post length: max 3000 characters
- Hashtags: max 5 (recommended 3)

### Instagram
- Post length: max 2200 characters
- Hashtags: max 30 (recommended 8)

### SEO (Blog Posts & Landing Pages)
- Meta description: 120-160 characters
- Keywords: 3-10 keywords
- Title: 30-60 characters (blog posts)

## Using the Evaluation Utilities

The `evaluation.ts` module provides four main functions:

### 1. validateStructure(content, contentType)

Validates that content matches the expected JSON schema for its type.

```typescript
import { validateStructure } from '../evaluation';

const validation = validateStructure(blogPost, 'blog');
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}
```

### 2. checkPlatformConstraints(content, platform?)

Checks platform-specific constraints (character limits, etc.).

```typescript
import { checkPlatformConstraints } from '../evaluation';

const validation = checkPlatformConstraints(socialPost, 'twitter');
if (!validation.valid) {
  console.error('Constraint violations:', validation.errors);
}
```

### 3. calculateQualityScore(content, contentType, productContext?)

Calculates a 0-100 quality score with detailed breakdown.

```typescript
import { calculateQualityScore } from '../evaluation';

const score = calculateQualityScore(emailContent, 'email', {
  verifiedClaims: product.verifiedClaims
});

console.log(`Overall score: ${score.overall}/100`);
console.log('Breakdown:', score.breakdown);
console.log('Issues:', score.issues);
console.log('Suggestions:', score.suggestions);
```

### 4. detectHallucinations(content, verifiedClaims)

Detects potential hallucinations and unverified claims.

```typescript
import { detectHallucinations } from '../evaluation';

const check = detectHallucinations(content, product.verifiedClaims);

if (check.hasPotentialHallucinations) {
  console.warn('Suspicious claims:', check.suspiciousClaims);
}
console.log('Verified claims covered:', check.verifiedClaimsCovered);
```

## Mocking Strategy

All tests use Vitest mocks to avoid actual API calls:

```typescript
// Mock the Anthropic client
vi.mock('../client', async () => {
  const actual = await vi.importActual<typeof client>('../client');
  return {
    ...actual,
    anthropic: {
      messages: {
        create: vi.fn(),
      },
    },
  };
});

// Mock a successful response
function mockApiResponse(output: any) {
  mockAnthropicCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(output) }],
    // ... other response fields
  });
}
```

## Adding New Tests

To add new test cases:

1. **Add test products** to `fixtures/products.json` if needed
2. **Add expected outputs** to `fixtures/expected-outputs.json`
3. **Write tests** in `prompt-quality.test.ts`:

```typescript
describe('New Feature', () => {
  it('validates new requirement', async () => {
    mockApiResponse(expectedOutput);

    const result = await contentWriter.generateBlogPost({
      product: products.new_product,
      audience: { /* ... */ },
      topic: 'Test Topic',
    });

    expect(result.newField).toBeDefined();
  });
});
```

## Best Practices

1. **Always mock API responses** - Never make real API calls in tests
2. **Use descriptive test names** - Clearly state what is being tested
3. **Test edge cases** - Include minimal input, extensive input, and error cases
4. **Validate both structure and content** - Don't just check for field presence
5. **Use fixtures** - Keep test data in fixtures for reusability
6. **Keep tests fast** - All tests should complete in under 10 seconds total
7. **Keep tests deterministic** - Tests should pass consistently

## Troubleshooting

### Tests failing with "Cannot find module"
Make sure you're running tests from the correct directory:
```bash
cd apps/web
pnpm test prompt-quality
```

### Mock not working
Ensure the mock is defined before the test and cleared between tests:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### Type errors
Make sure you're using the correct types from content-writer.ts:
```typescript
import type { BlogPostOutput } from '../content-writer';
```

## Future Enhancements

Potential additions to the testing framework:

- [ ] A/B testing support for content variations
- [ ] Performance benchmarking (token usage, response time)
- [ ] Tone analysis validation
- [ ] Brand voice consistency scoring
- [ ] Multi-language content validation
- [ ] Accessibility checks (reading level, inclusive language)
- [ ] Competitive analysis comparisons
- [ ] Automated regression testing on prompt changes

## Related Documentation

- [AI Integration README](../README.md) - Main AI documentation
- [Content Writer API](../content-writer.ts) - Content generation functions
- [Prompts Guide](../prompts.ts) - System prompts and templates
- [Evaluation Utilities](../evaluation.ts) - Quality scoring and validation

## Support

For questions or issues with the testing framework:
1. Check test output for specific error messages
2. Review this README for usage patterns
3. Examine fixture files for expected formats
4. Consult evaluation.ts for validation logic
