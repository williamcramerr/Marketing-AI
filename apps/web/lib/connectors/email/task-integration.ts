/**
 * Integration between email connectors and task workflow
 *
 * This file should be imported into lib/inngest/functions/task-workflow.ts
 * to replace the placeholder executeTask function for email tasks.
 */

import { createResendConnector } from './resend';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Execute an email task using the configured connector
 *
 * This function is called from the task workflow when executing email tasks.
 * It supports both single emails and email sequences.
 */
export async function executeEmailTask(
  task: any,
  connector: any,
  content: any
): Promise<Record<string, unknown>> {
  try {
    const supabase = createAdminClient();

    // Validate connector type
    if (connector.type !== 'email') {
      throw new Error(`Invalid connector type: ${connector.type}. Expected 'email'.`);
    }

    // Get organization ID for suppression check
    const organizationId = task.campaign?.product?.organization_id;

    // Determine if this is a single email or sequence
    const isBatch = task.type === 'email_sequence';

    if (isBatch) {
      // Handle email sequence
      return await executeBatchEmail(task, connector, content, organizationId);
    } else {
      // Handle single email
      return await executeSingleEmail(task, connector, content, organizationId);
    }
  } catch (error: any) {
    console.error('Error executing email task:', error);
    return {
      type: 'email',
      status: 'failed',
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Execute a single email task
 */
async function executeSingleEmail(
  task: any,
  connector: any,
  content: any,
  organizationId?: string
): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();

  // Extract email details from content
  const to = content.to || task.input_data?.to;
  const subject = content.subject || task.title;
  const body = content.body || content.html || content.text;
  const from = content.from || connector.config?.defaultFrom;
  const replyTo = content.replyTo || connector.config?.replyTo;

  if (!to || !subject || !body) {
    throw new Error('Missing required email fields: to, subject, body');
  }

  // Check suppression list
  if (organizationId) {
    const recipients = Array.isArray(to) ? to : [to];
    const { data: suppressedEmails } = await supabase
      .from('suppression_list')
      .select('email, reason')
      .eq('organization_id', organizationId)
      .in('email', recipients.map((e: string) => e.toLowerCase()));

    if (suppressedEmails && suppressedEmails.length > 0) {
      return {
        type: 'email',
        status: 'blocked',
        reason: 'suppression_list',
        suppressed: suppressedEmails,
        message: `Email blocked: recipient(s) on suppression list`,
      };
    }
  }

  // Create connector instance
  const emailConnector = await createResendConnector(connector.id);

  // Check rate limits
  const canExecute = await emailConnector.canExecute();
  if (!canExecute) {
    return {
      type: 'email',
      status: 'rate_limited',
      message: 'Connector rate limit exceeded',
    };
  }

  // Send email
  const result = await emailConnector.sendEmail({
    to,
    subject,
    body,
    from,
    replyTo,
    taskId: task.id,
    metadata: {
      campaignId: task.campaign_id,
      taskType: task.type,
      ...(content.metadata || {}),
    },
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to send email');
  }

  return {
    type: 'email',
    status: 'sent',
    messageId: result.messageId,
    externalId: result.externalId,
    recipient: to,
    subject,
    sentAt: new Date().toISOString(),
    metadata: result.metadata,
  };
}

/**
 * Execute a batch email task (email sequence)
 */
async function executeBatchEmail(
  task: any,
  connector: any,
  content: any,
  organizationId?: string
): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();

  // Extract email list from content
  const emails = content.emails || task.input_data?.emails || [];

  if (!Array.isArray(emails) || emails.length === 0) {
    throw new Error('No emails found in batch');
  }

  // Check suppression list
  if (organizationId) {
    const recipients = emails.map((e: any) => e.to.toLowerCase());
    const { data: suppressedEmails } = await supabase
      .from('suppression_list')
      .select('email')
      .eq('organization_id', organizationId)
      .in('email', recipients);

    const suppressedSet = new Set(
      suppressedEmails?.map((s: any) => s.email.toLowerCase()) || []
    );

    // Filter out suppressed emails
    const filteredEmails = emails.filter(
      (e: any) => !suppressedSet.has(e.to.toLowerCase())
    );

    if (filteredEmails.length === 0) {
      return {
        type: 'email_sequence',
        status: 'blocked',
        reason: 'suppression_list',
        message: 'All recipients are suppressed',
        totalEmails: emails.length,
        suppressed: emails.length,
      };
    }

    // Update emails to filtered list
    emails.splice(0, emails.length, ...filteredEmails);
  }

  // Create connector instance
  const emailConnector = await createResendConnector(connector.id);

  // Check rate limits
  const canExecute = await emailConnector.canExecute();
  if (!canExecute) {
    return {
      type: 'email_sequence',
      status: 'rate_limited',
      message: 'Connector rate limit exceeded',
      totalEmails: emails.length,
      sent: 0,
    };
  }

  // Send batch
  const result = await emailConnector.sendBatch(
    emails.map((email: any) => ({
      to: email.to,
      subject: email.subject || task.title,
      body: email.body || email.html || email.text,
      from: email.from || connector.config?.defaultFrom,
      replyTo: email.replyTo || connector.config?.replyTo,
      taskId: task.id,
      metadata: {
        campaignId: task.campaign_id,
        taskType: task.type,
        ...(email.metadata || {}),
      },
    }))
  );

  return {
    type: 'email_sequence',
    status: result.successful > 0 ? 'sent' : 'failed',
    totalEmails: result.totalSent,
    successful: result.successful,
    failed: result.failed,
    sentAt: new Date().toISOString(),
    results: result.results,
  };
}

/**
 * Helper function to be called from task-workflow.ts
 *
 * Replace the existing executeTask switch case for email tasks with:
 *
 * ```typescript
 * import { executeEmailTask } from '@/lib/connectors/email/task-integration';
 *
 * async function executeTask(task: any, connector: any, content: any) {
 *   switch (task.type) {
 *     case 'email_single':
 *     case 'email_sequence':
 *       return await executeEmailTask(task, connector, content);
 *
 *     case 'blog_post':
 *       // ... existing blog post logic
 *
 *     // ... other cases
 *   }
 * }
 * ```
 */
export { executeEmailTask as default };
