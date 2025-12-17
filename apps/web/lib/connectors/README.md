# Marketing Pilot AI - Connectors

This directory contains connector implementations for integrating with external services like email providers, CMS platforms, and social media APIs.

## Architecture

All connectors implement the base `BaseConnector` abstract class defined in `base.ts`. This provides a consistent interface for:

- Connection testing
- Configuration validation
- Rate limiting
- Usage tracking
- Status monitoring

## Email Connectors

### Resend Connector

Location: `/lib/connectors/email/resend.ts`

The Resend connector provides email sending capabilities with the following features:

#### Features

- Single email sending
- Batch email sending
- Custom email headers for task tracking
- Rate limiting support
- Delivery status tracking via webhooks
- Usage statistics

#### Configuration

```typescript
{
  credentials: {
    apiKey: "re_your-api-key"  // Or use RESEND_API_KEY env var
  },
  config: {
    defaultFrom: "noreply@yourdomain.com"
  },
  rateLimit: {
    perHour: 1000,
    perDay: 10000
  }
}
```

#### Usage Example

```typescript
import { createResendConnector } from '@/lib/connectors/email/resend';

// Create connector instance from database
const connector = await createResendConnector('connector-id');

// Send single email
const result = await connector.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to Marketing Pilot AI',
  body: '<h1>Welcome!</h1><p>Thanks for signing up.</p>',
  from: 'hello@yourdomain.com',
  replyTo: 'support@yourdomain.com',
  taskId: 'task-123',
  metadata: {
    campaignId: 'campaign-456',
    customField: 'value'
  }
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Error:', result.error);
}

// Send batch emails
const batchResult = await connector.sendBatch([
  {
    to: 'user1@example.com',
    subject: 'Email 1',
    body: 'Content 1',
    taskId: 'task-123'
  },
  {
    to: 'user2@example.com',
    subject: 'Email 2',
    body: 'Content 2',
    taskId: 'task-123'
  }
]);

console.log(`Sent ${batchResult.successful}/${batchResult.totalSent} emails`);
```

#### Task Integration

When sending emails with a `taskId`, the connector automatically:

1. Adds `X-Task-ID` header for webhook tracking
2. Records usage in the database
3. Updates task execution results with delivery metrics

#### Webhook Integration

The Resend webhook handler is located at `/app/api/webhooks/resend/route.ts`.

**Webhook URL:** `https://yourdomain.com/api/webhooks/resend`

**Supported Events:**
- `email.sent` - Email was accepted by the sending server
- `email.delivered` - Email was successfully delivered to recipient
- `email.opened` - Recipient opened the email (requires tracking pixel)
- `email.clicked` - Recipient clicked a link in the email
- `email.bounced` - Email bounced (hard or soft bounce)
- `email.complained` - Recipient marked email as spam
- `email.delivery_delayed` - Delivery was delayed

**What the webhook does:**
1. Validates webhook signature using RESEND_WEBHOOK_SECRET
2. Records metrics in `email_metrics` table
3. Updates task execution results with aggregated metrics
4. Adds bounced/complained emails to suppression list

**Setup in Resend:**

1. Go to Resend Dashboard > Webhooks
2. Add webhook endpoint: `https://yourdomain.com/api/webhooks/resend`
3. Select all email events
4. Copy the webhook secret to your `.env.local` file as `RESEND_WEBHOOK_SECRET`

#### Rate Limiting

The connector respects rate limits configured in the database:

```typescript
// Check if connector can execute
const canExecute = await connector.canExecute();

// Get usage statistics
const hourlyStats = await connector.getUsageStats('hour');
console.log(`Used: ${hourlyStats.used}/${hourlyStats.limit}`);
console.log(`Remaining: ${hourlyStats.remaining}`);
```

#### Error Handling

Errors are automatically:
- Logged to the connector's `last_error` field
- Returned in the result object
- Tracked in the database for monitoring

```typescript
const result = await connector.sendEmail({...});

if (!result.success) {
  console.error('Error:', result.error);
  console.error('Metadata:', result.metadata);
}
```

## Database Schema

The connectors require the following tables (add to your Supabase migrations):

### email_metrics

```sql
CREATE TABLE email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  connector_id UUID REFERENCES connectors(id) ON DELETE SET NULL,
  event TEXT NOT NULL, -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'delayed'
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL, -- 'sent', 'delivered', 'bounced', 'failed'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_metrics_message_id ON email_metrics(message_id);
CREATE INDEX idx_email_metrics_task_id ON email_metrics(task_id);
CREATE INDEX idx_email_metrics_connector_id ON email_metrics(connector_id);
CREATE INDEX idx_email_metrics_created_at ON email_metrics(created_at);
```

### suppression_list

```sql
CREATE TABLE suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL, -- 'hard_bounce', 'spam_complaint', 'unsubscribe', 'manual'
  source TEXT NOT NULL, -- 'resend_webhook', 'manual', 'import'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

CREATE INDEX idx_suppression_list_email ON suppression_list(email);
CREATE INDEX idx_suppression_list_org_id ON suppression_list(organization_id);
```

## Environment Variables

Add these to your `.env.local` file:

```bash
# Resend Configuration
RESEND_API_KEY=re_your-api-key
RESEND_WEBHOOK_SECRET=whsec_your-webhook-secret
```

## Creating New Connectors

To create a new connector:

1. Extend `BaseConnector` or use a specific interface like `EmailConnector`
2. Implement all required methods:
   - `testConnection()`
   - `getStatus()`
   - `validateConfig()`
3. Add connector-specific methods
4. Create a factory function to load from database
5. Document usage and configuration

Example:

```typescript
import { BaseConnector, EmailConnector } from '../base';

export class MyEmailConnector extends BaseConnector implements EmailConnector {
  async testConnection(): Promise<boolean> {
    // Test API connection
    return true;
  }

  async getStatus(): Promise<ConnectorStatus> {
    // Check connector status
    return 'active';
  }

  async validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    // Validate configuration
    return { valid: true };
  }

  async sendEmail(params: {...}): Promise<ConnectorResult> {
    // Send email implementation
    return { success: true, messageId: 'msg-123' };
  }

  async sendBatch(emails: [...]): Promise<BatchResult> {
    // Batch send implementation
    return { totalSent: 10, successful: 10, failed: 0, results: [] };
  }
}
```

## Testing

Test your connector before deploying:

```typescript
// Test connection
const isConnected = await connector.testConnection();
console.log('Connected:', isConnected);

// Test configuration
const validation = await connector.validateConfig({
  apiKey: 're_test_key',
  defaultFrom: 'test@example.com'
});
console.log('Valid:', validation.valid);

// Test sending
const result = await connector.sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  body: 'This is a test',
});
console.log('Sent:', result.success);
```

## Monitoring

Monitor connector health via:

1. **Status Endpoint**: Check `getStatus()` periodically
2. **Usage Stats**: Track rate limit usage
3. **Error Logs**: Review `last_error` in connectors table
4. **Metrics**: Analyze email_metrics for delivery rates

## Security

- Store API keys securely in the database (encrypted)
- Validate webhook signatures
- Use environment variables for sensitive data
- Implement rate limiting to prevent abuse
- Log all connector actions in audit_logs
