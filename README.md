# Marketing Pilot AI

An autonomous marketing automation platform powered by Claude AI. Marketing Pilot AI enables businesses to create, manage, and execute multi-channel marketing campaigns with AI-driven content generation, policy enforcement, and continuous learning.

## Features

### Core Capabilities

- **AI-Powered Content Generation**: Leverages Claude AI to generate marketing content including emails, social media posts, blog articles, and ad copy
- **Multi-Channel Campaign Management**: Orchestrate campaigns across email, social media, CMS, and advertising platforms
- **Policy Engine**: Enforce brand guidelines, content rules, rate limits, and compliance requirements
- **Agent Learning System**: Continuously improves content quality based on performance metrics and user feedback
- **A/B Testing**: Built-in experimentation framework for testing content variations
- **Human-in-the-Loop Approvals**: Configurable approval workflows for AI-generated content

### Supported Integrations

#### Email
- **Resend**: Transactional and marketing email delivery

#### Social Media
- **Twitter/X**: Post tweets, threads, and engage with followers
- **LinkedIn**: Share posts and articles on LinkedIn

#### Content Management
- **Ghost CMS**: Publish blog posts and articles
- **WordPress**: Publish to WordPress sites via REST API

#### Advertising
- **Google Ads**: Manage and track Google Ads campaigns
- **Meta Ads**: Create and monitor Facebook/Instagram ads

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Server Actions
- **Database**: Supabase (PostgreSQL with Row-Level Security)
- **AI**: Anthropic Claude API
- **Workflow Engine**: Inngest (event-driven automation)
- **Testing**: Vitest, React Testing Library

## Project Structure

```
marketing-pilot-ai/
├── apps/
│   └── web/                    # Next.js web application
│       ├── app/                # Next.js App Router pages
│       │   ├── (auth)/         # Authentication pages
│       │   ├── (dashboard)/    # Dashboard pages
│       │   └── api/            # API routes
│       ├── components/         # React components
│       ├── lib/                # Core libraries
│       │   ├── actions/        # Server actions
│       │   ├── agent/          # AI agent learning system
│       │   ├── ai/             # Claude AI integration
│       │   ├── connectors/     # External service connectors
│       │   ├── inngest/        # Workflow definitions
│       │   ├── policies/       # Policy engine
│       │   └── supabase/       # Database client
│       └── __tests__/          # Test files
├── supabase/                   # Supabase configuration
│   ├── migrations/             # Database migrations
│   └── functions/              # Edge functions
└── packages/                   # Shared packages
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- Supabase CLI
- A Supabase project
- Anthropic API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/marketing-pilot-ai.git
   cd marketing-pilot-ai
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

   Configure the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   INNGEST_EVENT_KEY=your_inngest_key
   INNGEST_SIGNING_KEY=your_inngest_signing_key
   ```

4. Set up the database:
   ```bash
   pnpm db:push
   ```

5. Generate TypeScript types:
   ```bash
   pnpm db:generate
   ```

6. Start the development server:
   ```bash
   pnpm dev
   ```

## Dashboard Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/dashboard` | Overview with key metrics and recent activity |
| Products | `/dashboard/products` | Manage products and services |
| Campaigns | `/dashboard/campaigns` | Create and manage marketing campaigns |
| Tasks | `/dashboard/tasks` | View and manage AI-generated tasks |
| Approvals | `/dashboard/approvals` | Review and approve pending content |
| Analytics | `/dashboard/analytics` | Performance metrics and insights |
| Content | `/dashboard/content` | Manage content assets |
| Experiments | `/dashboard/experiments` | A/B testing management |
| Agents | `/dashboard/agents` | AI agent performance and learnings |
| Policies | `/dashboard/policies` | Content and compliance policies |
| Connectors | `/dashboard/connectors` | Integration configuration |
| Settings | `/dashboard/settings` | Organization settings |

## Policy Engine

The policy engine enforces rules at multiple stages:

- **Pre-Draft**: Rate limits, budget limits, time windows
- **Content**: Banned phrases, required phrases, content rules
- **Pre-Execute**: Final validation before publishing

Policy severities:
- `block`: Prevents task execution
- `escalate`: Requires manual approval
- `warn`: Logs warning but allows execution

## Agent Learning System

The learning system continuously improves content generation by:

1. **Recording Performance**: Tracks metrics like open rates, click rates, and approval rates
2. **Processing Feedback**: Learns from user corrections and ratings
3. **Identifying Patterns**: Discovers successful content patterns and anti-patterns
4. **Generating Insights**: Provides actionable recommendations for improvement

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests once
pnpm test:run

# Run with coverage
pnpm test:coverage
```

## Emergency Controls

The platform includes emergency controls for safety:

- **Pause All Campaigns**: Immediately stops all active campaigns
- **Cancel Pending Tasks**: Cancels all queued and executing tasks
- **Enable Global Sandbox**: Prevents any real external API calls
- **Require All Approvals**: Forces manual approval for all tasks

Access these controls from **Settings > Emergency Controls**.

## Development

### Adding a New Connector

1. Create a new connector file in `lib/connectors/`:
   ```typescript
   // lib/connectors/your-service/client.ts
   import { BaseConnector } from '../base';

   export class YourServiceConnector extends BaseConnector {
     // Implement required methods
   }
   ```

2. Add the connector type to the database schema
3. Create UI components for configuration

### Adding a New Policy Type

1. Add the type definition in `lib/policies/types.ts`
2. Create a checker function in `lib/policies/checkers/`
3. Register the checker in `lib/policies/engine.ts`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For support, please contact support@example.com or open an issue in this repository.
