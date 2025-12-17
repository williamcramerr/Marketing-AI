/**
 * Email Sending Service
 *
 * Renders React Email templates and sends them via Resend.
 */

import { Resend } from 'resend';
import { render } from '@react-email/components';
import * as React from 'react';

// Transactional templates
import { WelcomeEmail } from '@/emails/transactional/welcome';
import { PasswordResetEmail } from '@/emails/transactional/password-reset';
import { InviteEmail } from '@/emails/transactional/invite';

// Notification templates
import { TaskCompleteEmail } from '@/emails/notifications/task-complete';
import { ApprovalRequestEmail } from '@/emails/notifications/approval-request';
import { UsageWarningEmail } from '@/emails/notifications/usage-warning';

import { logger } from '@/lib/logging';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'Marketing Pilot AI <noreply@marketingpilot.ai>';

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  to: string,
  userName: string
): Promise<SendEmailResult> {
  try {
    const html = await render(
      React.createElement(WelcomeEmail, {
        userName,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      })
    );

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Welcome to Marketing Pilot AI!',
      html,
    });

    if (error) {
      logger.error('Failed to send welcome email', { to, error });
      return { success: false, error: error.message };
    }

    logger.info('Welcome email sent', { to, emailId: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    logger.error('Error sending welcome email', { to, error });
    return { success: false, error: String(error) };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetToken: string
): Promise<SendEmailResult> {
  try {
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

    const html = await render(
      React.createElement(PasswordResetEmail, {
        userName,
        resetUrl,
        expiresInMinutes: 60,
      })
    );

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Reset your Marketing Pilot AI password',
      html,
    });

    if (error) {
      logger.error('Failed to send password reset email', { to, error });
      return { success: false, error: error.message };
    }

    logger.info('Password reset email sent', { to, emailId: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    logger.error('Error sending password reset email', { to, error });
    return { success: false, error: String(error) };
  }
}

/**
 * Send team invitation email
 */
export async function sendInviteEmail(
  to: string,
  inviterName: string,
  organizationName: string,
  role: string,
  inviteToken: string
): Promise<SendEmailResult> {
  try {
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${inviteToken}`;

    const html = await render(
      React.createElement(InviteEmail, {
        inviterName,
        organizationName,
        role,
        inviteUrl,
        expiresInDays: 7,
      })
    );

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You've been invited to join ${organizationName} on Marketing Pilot AI`,
      html,
    });

    if (error) {
      logger.error('Failed to send invite email', { to, error });
      return { success: false, error: error.message };
    }

    logger.info('Invite email sent', { to, organizationName, emailId: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    logger.error('Error sending invite email', { to, error });
    return { success: false, error: String(error) };
  }
}

/**
 * Send task completion notification
 */
export async function sendTaskCompleteEmail(
  to: string,
  userName: string,
  taskId: string,
  taskTitle: string,
  taskType: string,
  campaignName: string,
  status: 'completed' | 'failed',
  previewContent?: string
): Promise<SendEmailResult> {
  try {
    const taskUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tasks/${taskId}`;

    const html = await render(
      React.createElement(TaskCompleteEmail, {
        userName,
        taskTitle,
        taskType,
        campaignName,
        status,
        taskUrl,
        previewContent,
      })
    );

    const subject =
      status === 'completed'
        ? `Your content "${taskTitle}" is ready for review`
        : `Task "${taskTitle}" needs attention`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error('Failed to send task complete email', { to, taskId, error });
      return { success: false, error: error.message };
    }

    logger.info('Task complete email sent', { to, taskId, emailId: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    logger.error('Error sending task complete email', { to, taskId, error });
    return { success: false, error: String(error) };
  }
}

/**
 * Send approval request notification
 */
export async function sendApprovalRequestEmail(
  to: string,
  userName: string,
  approvalId: string,
  taskTitle: string,
  taskType: string,
  campaignName: string,
  requestorName: string,
  previewContent?: string,
  dueDate?: string
): Promise<SendEmailResult> {
  try {
    const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/approvals/${approvalId}`;

    const html = await render(
      React.createElement(ApprovalRequestEmail, {
        userName,
        requestorName,
        taskTitle,
        taskType,
        campaignName,
        approvalUrl,
        previewContent,
        dueDate,
      })
    );

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Approval needed: ${taskTitle}`,
      html,
    });

    if (error) {
      logger.error('Failed to send approval request email', { to, approvalId, error });
      return { success: false, error: error.message };
    }

    logger.info('Approval request email sent', { to, approvalId, emailId: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    logger.error('Error sending approval request email', { to, approvalId, error });
    return { success: false, error: String(error) };
  }
}

/**
 * Send usage warning notification
 */
export async function sendUsageWarningEmail(
  to: string,
  userName: string,
  organizationName: string,
  usagePercent: number,
  tokensUsed: number,
  tokensLimit: number,
  level: 'warning' | 'critical'
): Promise<SendEmailResult> {
  try {
    const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`;

    const html = await render(
      React.createElement(UsageWarningEmail, {
        userName,
        organizationName,
        usagePercent,
        tokensUsed,
        tokensLimit,
        billingUrl,
        level,
      })
    );

    const subject =
      level === 'critical'
        ? `URGENT: ${organizationName} has reached AI usage limit`
        : `${organizationName} is approaching AI usage limit (${usagePercent}%)`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error('Failed to send usage warning email', { to, level, error });
      return { success: false, error: error.message };
    }

    logger.info('Usage warning email sent', { to, level, emailId: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    logger.error('Error sending usage warning email', { to, level, error });
    return { success: false, error: String(error) };
  }
}
