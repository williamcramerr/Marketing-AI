# Installation Instructions

## Step 1: Install the Anthropic SDK

From the project root directory, run:

```bash
pnpm add @anthropic-ai/sdk --filter @marketing-pilot/web
```

This will install the `@anthropic-ai/sdk` package only in the web app workspace.

## Step 2: Verify Environment Variables

Make sure your `/apps/web/.env.local` file includes:

```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

You can get an API key from: https://console.anthropic.com/

## Step 3: Test the Installation

Create a simple test file to verify everything works:

```typescript
// apps/web/test-ai.ts
import { generateBlogPost } from './lib/ai';

async function test() {
  const result = await generateBlogPost({
    product: {
      name: 'Test Product',
      description: 'A test product',
      positioning: 'Best in class',
      verifiedClaims: ['Claim 1'],
      features: ['Feature 1'],
      benefits: ['Benefit 1'],
    },
    audience: {
      name: 'Test Audience',
      painPoints: ['Pain 1'],
      goals: ['Goal 1'],
    },
    topic: 'Test Topic',
  });

  console.log('Success!', result.title);
}

test();
```

Run it:

```bash
cd apps/web
npx tsx test-ai.ts
```

If you see a generated title, the installation is successful!

## Troubleshooting

### Error: "Missing ANTHROPIC_API_KEY"
- Make sure `.env.local` exists in `/apps/web/`
- Verify the environment variable is correctly named `ANTHROPIC_API_KEY`
- Restart your development server after adding the key

### Error: "Cannot find module '@anthropic-ai/sdk'"
- Run the pnpm install command from Step 1 again
- Make sure you're in the project root when running the command
- Check that `@anthropic-ai/sdk` appears in `/apps/web/package.json`

### Error: "Rate limit exceeded"
- You're making too many requests too quickly
- Add delays between requests or reduce concurrent calls
- Check your Anthropic Console for usage limits

### Error: "Invalid API key"
- Verify your API key is correct in `.env.local`
- Make sure there are no extra spaces or quotes around the key
- Generate a new key from the Anthropic Console if needed

## Next Steps

Once installed, check out:
- `README.md` - Full documentation and usage examples
- `example.ts` - Comprehensive code examples
- `content-writer.ts` - Main API reference

## Support

- Anthropic Documentation: https://docs.anthropic.com/
- Claude API Reference: https://docs.anthropic.com/claude/reference/
