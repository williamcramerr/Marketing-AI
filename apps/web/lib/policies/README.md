# Marketing Pilot AI - Policy Engine

A comprehensive policy validation engine for ensuring marketing tasks comply with organizational rules and regulations.

## Overview

The policy engine validates marketing tasks at three critical checkpoints:
1. **Pre-draft** - Before content generation begins
2. **Content** - After content is drafted
3. **Pre-execute** - Before publishing/executing the task

## Architecture

```
lib/policies/
├── index.ts       # Main exports
├── types.ts       # TypeScript type definitions
├── engine.ts      # Core validation engine
├── checkers.ts    # Individual policy checkers
└── README.md      # Documentation
```

## Policy Types

### 1. Rate Limit
Prevents exceeding task execution limits within time windows.

```typescript
{
  type: 'rate_limit',
  rule: {
    limit: 10,
    window: 'hour' | 'day' | 'week' | 'month',
    scope: 'connector' | 'campaign' | 'product' | 'organization',
    taskTypes: ['email_single', 'social_post'] // optional
  }
}
```

### 2. Banned Phrase
Blocks content containing prohibited words or phrases.

```typescript
{
  type: 'banned_phrase',
  rule: {
    phrases: ['guarantee', 'free money', 'click here'],
    caseSensitive: false,
    wholeWord: true,
    regex: false
  }
}
```

### 3. Required Phrase
Ensures content includes mandatory disclaimers or phrases.

```typescript
{
  type: 'required_phrase',
  rule: {
    phrases: ['Unsubscribe', 'Terms apply'],
    atLeastOne: false, // all required if false
    caseSensitive: false,
    location: 'footer' | 'header' | 'anywhere'
  }
}
```

### 4. Claim Lock
Verifies only approved product claims are used.

```typescript
{
  type: 'claim_lock',
  rule: {
    requireVerified: true,
    allowedClaims: ['FDA approved', 'Patent pending'],
    blockedClaims: ['cure', 'miracle']
  }
}
```

### 5. Domain Allowlist
Restricts external links to approved domains.

```typescript
{
  type: 'domain_allowlist',
  rule: {
    allowedDomains: ['example.com', 'partner.com'],
    blockAll: false
  }
}
```

### 6. Suppression
Checks email addresses against suppression lists.

```typescript
{
  type: 'suppression',
  rule: {
    suppressionListId: 'uuid',
    checkGlobalList: true,
    checkProductList: true
  }
}
```

### 7. Time Window
Restricts task execution to specific days and hours.

```typescript
{
  type: 'time_window',
  rule: {
    allowedDays: [1, 2, 3, 4, 5], // Monday-Friday
    allowedHours: {
      start: 9, // 9 AM
      end: 17   // 5 PM
    },
    timezone: 'America/New_York'
  }
}
```

### 8. Budget Limit
Enforces spending caps per time period or campaign.

```typescript
{
  type: 'budget_limit',
  rule: {
    maxSpendCents: 50000, // $500
    window: 'day' | 'week' | 'month' | 'campaign' | 'lifetime',
    scope: 'campaign' | 'product' | 'organization'
  }
}
```

### 9. Content Rule
Validates content structure and formatting.

```typescript
{
  type: 'content_rule',
  rule: {
    maxLength: 2000,
    minLength: 100,
    requiredElements: ['heading', 'cta'],
    forbiddenElements: ['popup', 'autoplay'],
    styleGuidelines: { /* custom guidelines */ }
  }
}
```

## Severity Levels

- **warn** - Log warning but allow task to proceed
- **block** - Prevent task from proceeding
- **escalate** - Require manual approval before proceeding

## Usage

### Basic Validation

```typescript
import { validatePolicies } from '@/lib/policies';
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();

const task = {
  id: 'task-123',
  campaign_id: 'campaign-456',
  type: 'email_single',
  title: 'Newsletter',
  scheduled_for: new Date().toISOString(),
  draft_content: {
    subject: 'Check this out!',
    body: 'Hello, ...'
  }
};

const result = await validatePolicies(
  task,
  'org-789',
  'content',
  supabase
);

if (!result.allowed) {
  console.error('Policy violations:', result.violations);
  // Handle blocking violations
}

if (result.warnings.length > 0) {
  console.warn('Policy warnings:', result.warnings);
  // Log warnings
}
```

### Convenience Functions

```typescript
import {
  canDraftTask,
  validateContent,
  canExecuteTask
} from '@/lib/policies';

// Before drafting
const preDraftResult = await canDraftTask(task, orgId, supabase);

// After drafting
const contentResult = await validateContent(task, orgId, supabase);

// Before execution
const preExecuteResult = await canExecuteTask(task, orgId, supabase);
```

### Formatting Results

```typescript
import {
  formatViolationSummary,
  formatWarningSummary
} from '@/lib/policies';

const violationText = formatViolationSummary(result.violations);
const warningText = formatWarningSummary(result.warnings);

console.log(violationText);
console.log(warningText);
```

## Integration Points

### 1. Task Workflow (Inngest)

```typescript
// In lib/inngest/functions/task-workflow.ts
import { canDraftTask, validateContent, canExecuteTask } from '@/lib/policies';

// Pre-draft check
const preDraftCheck = await canDraftTask(task, orgId, supabase);
if (!preDraftCheck.allowed) {
  await step.run('block-task', async () => {
    // Update task status to failed
    // Log violation
  });
  return;
}

// Content validation
const contentCheck = await validateContent(task, orgId, supabase);
if (!contentCheck.allowed) {
  // Escalate for approval if severity is 'escalate'
  // Block if severity is 'block'
}

// Pre-execution check
const preExecuteCheck = await canExecuteTask(task, orgId, supabase);
if (!preExecuteCheck.allowed) {
  // Block execution
}
```

### 2. API Routes

```typescript
// In app/api/tasks/[id]/draft/route.ts
import { validateContent } from '@/lib/policies';

export async function POST(request: Request) {
  const task = await getTask(taskId);
  const result = await validateContent(task, orgId, supabase);

  return Response.json({
    success: result.allowed,
    violations: result.violations,
    warnings: result.warnings,
    feedback: result.feedback
  });
}
```

### 3. UI Components

```typescript
// In components/tasks/task-actions.tsx
'use client';

import { validateContent } from '@/lib/policies';

async function handleApprove() {
  const result = await fetch(`/api/tasks/${taskId}/validate`, {
    method: 'POST'
  });

  const { violations, warnings } = await result.json();

  if (violations.length > 0) {
    setErrors(violations);
    return;
  }

  // Proceed with approval
}
```

## Database Schema

Policies are stored in the `policies` table:

```sql
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  product_id UUID REFERENCES products(id),
  type policy_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rule JSONB NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warn',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enum for policy types
CREATE TYPE policy_type AS ENUM (
  'rate_limit',
  'banned_phrase',
  'required_phrase',
  'claim_lock',
  'domain_allowlist',
  'suppression',
  'time_window',
  'budget_limit',
  'content_rule'
);
```

## Testing

```typescript
import { validatePolicies } from '@/lib/policies';

describe('Policy Engine', () => {
  it('should block task with banned phrases', async () => {
    const task = {
      // ... task with banned content
    };

    const result = await validatePolicies(
      task,
      orgId,
      'content',
      supabase
    );

    expect(result.allowed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].policyType).toBe('banned_phrase');
  });
});
```

## Error Handling

The policy engine follows a "fail open" strategy - if a policy check encounters an error, it logs the error and allows the task to proceed. This prevents policy infrastructure issues from blocking critical operations.

To change this behavior, modify the error handling in `engine.ts`:

```typescript
try {
  const result = await checker(policy, task, context);
  return { policy, result };
} catch (error) {
  console.error(`Error checking policy ${policy.id}:`, error);

  // Option 1: Fail open (current)
  return null;

  // Option 2: Fail closed (stricter)
  return {
    policy,
    result: {
      passed: false,
      violation: createViolation(
        policy,
        'Policy check failed due to system error'
      )
    }
  };
}
```

## Performance Considerations

- Policy checks run in parallel using `Promise.all()`
- Database queries are optimized with proper indexes
- Results are not cached - implement caching if needed
- Consider rate limiting the policy engine itself for high-volume operations

## Future Enhancements

- [ ] Policy templates for common use cases
- [ ] Policy simulation/dry-run mode
- [ ] Analytics dashboard for policy violations
- [ ] Machine learning for automatic policy suggestions
- [ ] Policy version control and rollback
- [ ] Real-time policy updates without restart
- [ ] Policy inheritance and composition
