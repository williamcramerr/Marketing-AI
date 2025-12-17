/**
 * Resend Webhook Handler
 *
 * Handles webhook events from Resend for email delivery tracking:
 * - email.sent
 * - email.delivered
 * - email.opened
 * - email.clicked
 * - email.bounced
 * - email.complained (spam complaint)
 * - email.delivery_delayed
 *
 * This endpoint validates webhook signatures, records metrics in the database,
 * and manages suppression lists for bounces and unsubscribes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import { verifySvixSignature } from '@/lib/webhooks';

// Resend webhook event types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked';

interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>;
    click?: {
      link: string;
      timestamp: string;
      ipAddress?: string;
      userAgent?: string;
    };
    bounce?: {
      bounceType: 'hard' | 'soft';
      diagnosticCode?: string;
    };
  };
}

/**
 * POST /api/webhooks/resend
 *
 * Handles incoming webhook events from Resend
 */
export async function POST(request: NextRequest) {
  try {
    // Get headers
    const headersList = await headers();
    const signature = headersList.get('svix-signature');
    const timestamp = headersList.get('svix-timestamp');
    const webhookId = headersList.get('svix-id');

    // Get raw body for signature verification
    const body = await request.text();
    const payload: ResendWebhookPayload = JSON.parse(body);

    // Verify webhook signature
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      // In development without secret, log warning but continue
      if (process.env.NODE_ENV === 'development') {
        console.warn('RESEND_WEBHOOK_SECRET not configured - skipping signature verification in development');
      } else {
        console.error('RESEND_WEBHOOK_SECRET not configured');
        return NextResponse.json(
          { error: 'Webhook secret not configured' },
          { status: 500 }
        );
      }
    } else {
      const verification = verifySvixSignature({
        payload: body,
        signature,
        timestamp,
        webhookId,
        secret: webhookSecret,
      });

      if (!verification.valid) {
        console.error('Invalid webhook signature:', verification.error);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Process the webhook event
    await processWebhookEvent(payload);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing Resend webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Process webhook event and update database
 */
async function processWebhookEvent(payload: ResendWebhookPayload): Promise<void> {
  const supabase = createAdminClient();
  const { type, data, created_at } = payload;

  // Extract task_id from headers if present
  const taskId = data.headers?.['X-Task-ID'] || data.headers?.['x-task-id'];
  const metadata = data.headers?.['X-Metadata']
    ? JSON.parse(data.headers['X-Metadata'])
    : {};

  // Get connector_id from email_metrics or tasks
  let connectorId: string | undefined;
  if (taskId) {
    const { data: task } = await supabase
      .from('tasks')
      .select('connector_id')
      .eq('id', taskId)
      .single();
    connectorId = task?.connector_id || undefined;
  }

  // Record the metric based on event type
  switch (type) {
    case 'email.sent':
      await recordMetric({
        supabase,
        messageId: data.email_id,
        taskId,
        connectorId,
        event: 'sent',
        recipient: data.to[0],
        subject: data.subject,
        timestamp: created_at,
        metadata: {
          from: data.from,
          to: data.to,
          ...metadata,
        },
      });
      break;

    case 'email.delivered':
      await recordMetric({
        supabase,
        messageId: data.email_id,
        taskId,
        connectorId,
        event: 'delivered',
        recipient: data.to[0],
        timestamp: created_at,
      });
      break;

    case 'email.opened':
      await recordMetric({
        supabase,
        messageId: data.email_id,
        taskId,
        connectorId,
        event: 'opened',
        recipient: data.to[0],
        timestamp: created_at,
      });
      break;

    case 'email.clicked':
      await recordMetric({
        supabase,
        messageId: data.email_id,
        taskId,
        connectorId,
        event: 'clicked',
        recipient: data.to[0],
        timestamp: created_at,
        metadata: {
          link: data.click?.link,
          ipAddress: data.click?.ipAddress,
          userAgent: data.click?.userAgent,
        },
      });
      break;

    case 'email.bounced':
      await recordMetric({
        supabase,
        messageId: data.email_id,
        taskId,
        connectorId,
        event: 'bounced',
        recipient: data.to[0],
        timestamp: created_at,
        metadata: {
          bounceType: data.bounce?.bounceType,
          diagnosticCode: data.bounce?.diagnosticCode,
        },
      });

      // Add to suppression list if hard bounce
      if (data.bounce?.bounceType === 'hard') {
        await addToSuppressionList({
          supabase,
          email: data.to[0],
          reason: 'hard_bounce',
          connectorId,
          metadata: {
            messageId: data.email_id,
            diagnosticCode: data.bounce?.diagnosticCode,
          },
        });
      }
      break;

    case 'email.complained':
      await recordMetric({
        supabase,
        messageId: data.email_id,
        taskId,
        connectorId,
        event: 'complained',
        recipient: data.to[0],
        timestamp: created_at,
      });

      // Add to suppression list for spam complaints
      await addToSuppressionList({
        supabase,
        email: data.to[0],
        reason: 'spam_complaint',
        connectorId,
        metadata: {
          messageId: data.email_id,
        },
      });
      break;

    case 'email.delivery_delayed':
      await recordMetric({
        supabase,
        messageId: data.email_id,
        taskId,
        connectorId,
        event: 'delayed',
        recipient: data.to[0],
        timestamp: created_at,
      });
      break;
  }

  // Update task execution result if task_id is present
  if (taskId) {
    await updateTaskMetrics({
      supabase,
      taskId,
      event: type,
      messageId: data.email_id,
    });
  }
}

/**
 * Record email metric in the database
 */
async function recordMetric({
  supabase,
  messageId,
  taskId,
  connectorId,
  event,
  recipient,
  subject,
  timestamp,
  metadata,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  messageId: string;
  taskId?: string;
  connectorId?: string;
  event: string;
  recipient: string;
  subject?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Check if email_metrics table exists, if not, store in audit_logs
    const { error } = await supabase.from('email_metrics').insert({
      message_id: messageId,
      task_id: taskId,
      connector_id: connectorId,
      event,
      recipient,
      subject,
      status: event === 'bounced' ? 'bounced' : event === 'delivered' ? 'delivered' : 'sent',
      metadata: metadata || {},
      created_at: timestamp,
    });

    if (error) {
      console.error('Error recording email metric:', error);

      // Fallback to audit_logs if email_metrics table doesn't exist
      if (connectorId) {
        const { data: connector } = await supabase
          .from('connectors')
          .select('organization_id')
          .eq('id', connectorId)
          .single();

        if (connector) {
          await supabase.from('audit_logs').insert({
            organization_id: connector.organization_id,
            action: `email.${event}`,
            actor_type: 'system',
            actor_id: 'resend',
            resource_type: 'email',
            resource_id: messageId,
            metadata: {
              recipient,
              subject,
              taskId,
              ...metadata,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error recording metric:', error);
  }
}

/**
 * Add email to suppression list
 */
async function addToSuppressionList({
  supabase,
  email,
  reason,
  connectorId,
  metadata,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  email: string;
  reason: string;
  connectorId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Get organization_id from connector
    let organizationId: string | undefined;
    if (connectorId) {
      const { data: connector } = await supabase
        .from('connectors')
        .select('organization_id')
        .eq('id', connectorId)
        .single();
      organizationId = connector?.organization_id;
    }

    if (!organizationId) {
      console.warn('Cannot add to suppression list without organization_id');
      return;
    }

    // Check if suppression_list table exists
    const { error } = await supabase.from('suppression_list').insert({
      organization_id: organizationId,
      email: email.toLowerCase(),
      reason,
      source: 'resend_webhook',
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error adding to suppression list:', error);

      // Fallback: Create a policy to suppress this email
      await supabase.from('policies').insert({
        organization_id: organizationId,
        type: 'suppression',
        name: `Auto-suppression: ${email}`,
        description: `Automatically created from ${reason}`,
        rule: {
          type: 'email_suppression',
          email: email.toLowerCase(),
          reason,
        },
        severity: 'block',
        active: true,
      });
    }
  } catch (error) {
    console.error('Error adding to suppression list:', error);
  }
}

/**
 * Update task metrics based on email events
 */
async function updateTaskMetrics({
  supabase,
  taskId,
  event,
  messageId,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  taskId: string;
  event: string;
  messageId: string;
}): Promise<void> {
  try {
    const { data: task } = await supabase
      .from('tasks')
      .select('execution_result')
      .eq('id', taskId)
      .single();

    if (!task) return;

    const executionResult = (task.execution_result as Record<string, any>) || {};
    const metrics = executionResult.metrics || {};

    // Update metrics based on event type
    switch (event) {
      case 'email.sent':
        metrics.sent = (metrics.sent || 0) + 1;
        break;
      case 'email.delivered':
        metrics.delivered = (metrics.delivered || 0) + 1;
        break;
      case 'email.opened':
        metrics.opened = (metrics.opened || 0) + 1;
        metrics.openRate = metrics.delivered
          ? (metrics.opened / metrics.delivered * 100).toFixed(2)
          : '0.00';
        break;
      case 'email.clicked':
        metrics.clicked = (metrics.clicked || 0) + 1;
        metrics.clickRate = metrics.delivered
          ? (metrics.clicked / metrics.delivered * 100).toFixed(2)
          : '0.00';
        break;
      case 'email.bounced':
        metrics.bounced = (metrics.bounced || 0) + 1;
        metrics.bounceRate = metrics.sent
          ? (metrics.bounced / metrics.sent * 100).toFixed(2)
          : '0.00';
        break;
      case 'email.complained':
        metrics.complained = (metrics.complained || 0) + 1;
        break;
    }

    // Update task with new metrics
    await supabase
      .from('tasks')
      .update({
        execution_result: {
          ...executionResult,
          metrics,
          lastUpdated: new Date().toISOString(),
        },
      })
      .eq('id', taskId);
  } catch (error) {
    console.error('Error updating task metrics:', error);
  }
}
