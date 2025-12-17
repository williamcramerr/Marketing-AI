/**
 * Example usage of the Resend Email Connector
 *
 * This file shows how to integrate the Resend connector with tasks
 * and demonstrates common usage patterns.
 */

import { createResendConnector } from './resend';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Execute an email task using the Resend connector
 *
 * This is called from the task workflow when executing email tasks
 */
export async function executeEmailTask(
  taskId: string,
  connectorId: string,
  content: {
    to: string | string[];
    subject: string;
    body: string;
    from?: string;
    replyTo?: string;
  }
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}> {
  try {
    // Check if recipients are suppressed
    const supabase = createAdminClient();
    const { data: task } = await supabase
      .from('tasks')
      .select('campaign:campaigns(product:products(organization_id))')
      .eq('id', taskId)
      .single();

    const organizationId = (task as any)?.campaign?.product?.organization_id;

    if (organizationId) {
      const recipients = Array.isArray(content.to) ? content.to : [content.to];

      // Check suppression list
      const { data: suppressedEmails } = await supabase
        .from('suppression_list')
        .select('email')
        .eq('organization_id', organizationId)
        .in('email', recipients.map(e => e.toLowerCase()));

      if (suppressedEmails && suppressedEmails.length > 0) {
        return {
          success: false,
          error: `Cannot send to suppressed emails: ${suppressedEmails.map(s => s.email).join(', ')}`,
        };
      }
    }

    // Create connector instance
    const connector = await createResendConnector(connectorId);

    // Check if connector can execute (rate limits)
    const canExecute = await connector.canExecute();
    if (!canExecute) {
      return {
        success: false,
        error: 'Connector rate limit exceeded or inactive',
      };
    }

    // Send email
    const result = await connector.sendEmail({
      ...content,
      taskId,
    });

    return result;
  } catch (error: any) {
    console.error('Error executing email task:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Execute a batch email task using the Resend connector
 *
 * Used for email sequences or campaigns
 */
export async function executeBatchEmailTask(
  taskId: string,
  connectorId: string,
  emails: Array<{
    to: string;
    subject: string;
    body: string;
    from?: string;
    replyTo?: string;
    metadata?: Record<string, unknown>;
  }>
): Promise<{
  success: boolean;
  totalSent: number;
  successful: number;
  failed: number;
  errors?: string[];
}> {
  try {
    // Check suppression list
    const supabase = createAdminClient();
    const { data: task } = await supabase
      .from('tasks')
      .select('campaign:campaigns(product:products(organization_id))')
      .eq('id', taskId)
      .single();

    const organizationId = (task as any)?.campaign?.product?.organization_id;

    if (organizationId) {
      const recipients = emails.map(e => e.to.toLowerCase());

      // Get suppressed emails
      const { data: suppressedEmails } = await supabase
        .from('suppression_list')
        .select('email')
        .eq('organization_id', organizationId)
        .in('email', recipients);

      const suppressedSet = new Set(
        suppressedEmails?.map(s => s.email.toLowerCase()) || []
      );

      // Filter out suppressed emails
      const filteredEmails = emails.filter(
        e => !suppressedSet.has(e.to.toLowerCase())
      );

      if (filteredEmails.length === 0) {
        return {
          success: false,
          totalSent: 0,
          successful: 0,
          failed: emails.length,
          errors: ['All recipients are suppressed'],
        };
      }

      if (filteredEmails.length < emails.length) {
        console.warn(
          `Filtered out ${emails.length - filteredEmails.length} suppressed emails`
        );
      }

      // Update emails to use filtered list
      emails = filteredEmails;
    }

    // Create connector instance
    const connector = await createResendConnector(connectorId);

    // Check rate limits
    const canExecute = await connector.canExecute();
    if (!canExecute) {
      return {
        success: false,
        totalSent: 0,
        successful: 0,
        failed: emails.length,
        errors: ['Connector rate limit exceeded or inactive'],
      };
    }

    // Send batch
    const result = await connector.sendBatch(
      emails.map(email => ({
        ...email,
        taskId,
      }))
    );

    return {
      success: result.successful > 0,
      totalSent: result.totalSent,
      successful: result.successful,
      failed: result.failed,
      errors: result.results
        .filter(r => !r.success)
        .map(r => r.error || 'Unknown error'),
    };
  } catch (error: any) {
    console.error('Error executing batch email task:', error);
    return {
      success: false,
      totalSent: 0,
      successful: 0,
      failed: emails.length,
      errors: [error.message || 'Unknown error'],
    };
  }
}

/**
 * Get email metrics for a task
 */
export async function getTaskEmailMetrics(taskId: string): Promise<{
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}> {
  const supabase = createAdminClient();

  const { data: metrics } = await supabase
    .from('email_metrics')
    .select('event')
    .eq('task_id', taskId);

  if (!metrics || metrics.length === 0) {
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
    };
  }

  const counts = {
    sent: metrics.filter(m => m.event === 'sent').length,
    delivered: metrics.filter(m => m.event === 'delivered').length,
    opened: metrics.filter(m => m.event === 'opened').length,
    clicked: metrics.filter(m => m.event === 'clicked').length,
    bounced: metrics.filter(m => m.event === 'bounced').length,
    complained: metrics.filter(m => m.event === 'complained').length,
  };

  return {
    ...counts,
    deliveryRate: counts.sent > 0
      ? Number(((counts.delivered / counts.sent) * 100).toFixed(2))
      : 0,
    openRate: counts.delivered > 0
      ? Number(((counts.opened / counts.delivered) * 100).toFixed(2))
      : 0,
    clickRate: counts.delivered > 0
      ? Number(((counts.clicked / counts.delivered) * 100).toFixed(2))
      : 0,
    bounceRate: counts.sent > 0
      ? Number(((counts.bounced / counts.sent) * 100).toFixed(2))
      : 0,
  };
}

/**
 * Check if an email is suppressed
 */
export async function isEmailSuppressed(
  organizationId: string,
  email: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('suppression_list')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('email', email.toLowerCase())
    .single();

  return !!data;
}

/**
 * Add an email to the suppression list
 */
export async function suppressEmail(
  organizationId: string,
  email: string,
  reason: 'hard_bounce' | 'soft_bounce' | 'spam_complaint' | 'unsubscribe' | 'manual',
  source: 'resend_webhook' | 'manual' | 'import' | 'api' = 'manual',
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.from('suppression_list').insert({
      organization_id: organizationId,
      email: email.toLowerCase(),
      reason,
      source,
      metadata: metadata || {},
    });

    if (error) {
      // Check if it's a duplicate key error
      if (error.code === '23505') {
        console.log('Email already suppressed:', email);
        return true;
      }
      console.error('Error suppressing email:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error suppressing email:', error);
    return false;
  }
}

/**
 * Remove an email from the suppression list
 */
export async function unsuppressEmail(
  organizationId: string,
  email: string
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('suppression_list')
      .delete()
      .eq('organization_id', organizationId)
      .eq('email', email.toLowerCase());

    if (error) {
      console.error('Error unsuppressing email:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error unsuppressing email:', error);
    return false;
  }
}
