# Policy Engine - Quick Reference

## Basic Usage

```typescript
import { validatePolicies } from '@/lib/policies';
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const result = await validatePolicies(task, orgId, 'content', supabase);

if (!result.allowed) {
  // Handle violations
}
```

## Check Types

| Type | When | What It Checks |
|------|------|----------------|
| `pre-draft` | Before content generation | Rate limits, time windows, budget |
| `content` | After content is drafted | Banned phrases, required phrases, content rules, claims |
| `pre-execute` | Before publishing | All policies (comprehensive final check) |

## Policy Types

| Type | Purpose | Example Rule |
|------|---------|--------------|
| `rate_limit` | Limit task frequency | Max 10 emails/hour |
| `banned_phrase` | Block prohibited words | No "guarantee" or "free" |
| `required_phrase` | Enforce disclaimers | Must include "Unsubscribe" |
| `claim_lock` | Verify product claims | Only use verified claims |
| `domain_allowlist` | Restrict external links | Only link to approved domains |
| `suppression` | Check email blacklist | Don't email suppressed addresses |
| `time_window` | Limit send times | Only M-F, 9am-5pm |
| `budget_limit` | Enforce spending caps | Max $500/day |
| `content_rule` | Validate structure | Min 100 chars, max 2000 chars |

## Severity Levels

| Severity | Behavior | Use Case |
|----------|----------|----------|
| `warn` | Log warning, allow task | Best practices |
| `block` | Prevent task execution | Legal compliance |
| `escalate` | Require manual approval | Risky content |

## Common Patterns

### Pattern 1: Pre-flight Check
```typescript
const result = await canDraftTask(task, orgId, supabase);
if (!result.allowed) {
  throw new Error('Cannot proceed');
}
```

### Pattern 2: Content Validation
```typescript
const result = await validateContent(task, orgId, supabase);
if (result.violations.some(v => v.severity === 'block')) {
  await markTaskFailed(task.id);
}
```

### Pattern 3: Approval Flow
```typescript
const result = await validateContent(task, orgId, supabase);
const needsApproval = result.violations.some(v => v.severity === 'escalate');

if (needsApproval) {
  await createApprovalRequest(task.id);
}
```

### Pattern 4: Warning Collection
```typescript
const result = await validatePolicies(task, orgId, checkType, supabase);
if (result.warnings.length > 0) {
  await logWarnings(task.id, result.warnings);
}
```

## API Response Format

```typescript
{
  allowed: boolean,
  violations: [
    {
      policyId: string,
      policyName: string,
      policyType: string,
      severity: 'warn' | 'block' | 'escalate',
      message: string,
      details: object,
      timestamp: string
    }
  ],
  warnings: [
    {
      policyId: string,
      policyName: string,
      policyType: string,
      message: string,
      details: object,
      timestamp: string
    }
  ],
  feedback?: string
}
```

## Creating Policies

### Via SQL
```sql
INSERT INTO policies (organization_id, type, name, rule, severity, active)
VALUES (
  'org-123',
  'banned_phrase',
  'No spam words',
  '{"phrases": ["guarantee", "free money"], "caseSensitive": false}',
  'block',
  true
);
```

### Via Supabase Client
```typescript
await supabase.from('policies').insert({
  organization_id: 'org-123',
  type: 'rate_limit',
  name: 'Email hourly limit',
  rule: {
    limit: 10,
    window: 'hour',
    scope: 'organization'
  },
  severity: 'block',
  active: true
});
```

## Error Handling

The policy engine **fails open** by default - if a policy check errors, the task is allowed to proceed.

To change this behavior, modify `engine.ts`:

```typescript
// Current (fail open)
catch (error) {
  console.error('Policy check failed:', error);
  return null; // Allow task
}

// Fail closed (stricter)
catch (error) {
  console.error('Policy check failed:', error);
  return {
    policy,
    result: {
      passed: false,
      violation: createViolation(policy, 'Policy check system error')
    }
  };
}
```

## Integration Points

### 1. Inngest Workflow
```typescript
// lib/inngest/functions/task-workflow.ts
import { canDraftTask, validateContent, canExecuteTask } from '@/lib/policies';

// Add checks at each stage
const preDraft = await canDraftTask(task, orgId, supabase);
const content = await validateContent(task, orgId, supabase);
const preExecute = await canExecuteTask(task, orgId, supabase);
```

### 2. API Routes
```typescript
// app/api/tasks/[id]/validate/route.ts
import { validateContent } from '@/lib/policies';

export async function POST(req: Request) {
  const result = await validateContent(task, orgId, supabase);
  return Response.json(result);
}
```

### 3. React Server Actions
```typescript
// app/tasks/actions.ts
'use server';
import { validateContent } from '@/lib/policies';

export async function validateTaskContent(taskId: string) {
  const result = await validateContent(task, orgId, supabase);
  return result;
}
```

## Testing

```typescript
import { validatePolicies } from '@/lib/policies';

test('blocks banned phrases', async () => {
  const result = await validatePolicies(task, orgId, 'content', mockSupabase);
  expect(result.allowed).toBe(false);
  expect(result.violations[0].policyType).toBe('banned_phrase');
});
```

## Performance Tips

1. Policies run in parallel - no sequential blocking
2. Use appropriate check types - don't run all checks at every stage
3. Set `active: false` on unused policies instead of deleting
4. Use product-level policies to reduce query scope
5. Consider caching policy results for identical content

## Common Issues

### Issue: Policy not firing
- Check `active` is `true`
- Verify `organization_id` matches
- Confirm policy type applies to check stage
- Check rule format matches expected structure

### Issue: Too many false positives
- Adjust `caseSensitive` and `wholeWord` settings
- Use `warn` instead of `block` during testing
- Add exclusions to phrase lists

### Issue: Performance problems
- Index the `policies` table on `organization_id` and `active`
- Limit number of active policies
- Use more specific policy rules
- Consider async processing for non-critical checks

## Support

- See `README.md` for detailed documentation
- See `examples.ts` for usage patterns
- See `__tests__/engine.test.ts` for test examples
