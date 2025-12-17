/**
 * Resend Email Connector
 *
 * Implements email sending functionality using the Resend API.
 * Includes batch sending, tracking headers, and error handling.
 */

import { Resend } from 'resend';
import {
  BaseConnector,
  ConnectorConfig,
  ConnectorResult,
  ConnectorStatus,
  BatchResult,
  EmailConnector,
} from '../base';
import { createAdminClient } from '@/lib/supabase/admin';

export class ResendConnector extends BaseConnector implements EmailConnector {
  private client: Resend;
  private defaultFrom: string;

  constructor(config: ConnectorConfig) {
    super(config);

    const apiKey = (config.credentials.apiKey as string) || process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('Resend API key is required');
    }

    this.client = new Resend(apiKey);
    this.defaultFrom = (config.config.defaultFrom as string) || 'noreply@example.com';
  }

  /**
   * Test the Resend API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Resend doesn't have a dedicated test endpoint, so we validate the API key format
      // and optionally try to get API key info
      const apiKey = (this.config.credentials.apiKey as string) || process.env.RESEND_API_KEY;
      return apiKey?.startsWith('re_') || false;
    } catch (error) {
      console.error('Resend connection test failed:', error);
      return false;
    }
  }

  /**
   * Get the current status of the connector
   */
  async getStatus(): Promise<ConnectorStatus> {
    if (!this.config.active) {
      return 'inactive';
    }

    try {
      const canConnect = await this.testConnection();
      if (!canConnect) {
        return 'error';
      }

      // Check rate limits
      const stats = await this.getUsageStats('hour');
      if (stats.remaining <= 0) {
        return 'rate_limited';
      }

      return 'active';
    } catch (error) {
      console.error('Error checking Resend status:', error);
      return 'error';
    }
  }

  /**
   * Validate Resend configuration
   */
  async validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];

    // Validate API key format
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      errors.push('API key is required');
    } else if (!apiKey.startsWith('re_')) {
      errors.push('Invalid API key format (must start with "re_")');
    }

    // Validate default from email
    const defaultFrom = config.defaultFrom as string;
    if (defaultFrom && !this.isValidEmail(defaultFrom)) {
      errors.push('Invalid default from email address');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Send a single email via Resend
   */
  async sendEmail(params: {
    to: string | string[];
    subject: string;
    body: string;
    from?: string;
    replyTo?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorResult> {
    try {
      // Check if we can execute
      const canExecute = await this.canExecute();
      if (!canExecute) {
        return {
          success: false,
          error: 'Connector is not active or rate limit exceeded',
        };
      }

      // Prepare email
      const fromAddress = params.from || this.defaultFrom;
      const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

      // Build custom headers for tracking
      const headers: Record<string, string> = {};
      if (params.taskId) {
        headers['X-Task-ID'] = params.taskId;
      }
      if (params.metadata) {
        headers['X-Metadata'] = JSON.stringify(params.metadata);
      }

      // Send email via Resend
      const result = await this.client.emails.send({
        from: fromAddress,
        to: toAddresses,
        subject: params.subject,
        html: params.body,
        reply_to: params.replyTo,
        headers,
      });

      // Record usage
      await this.recordUsage(params.taskId);

      return {
        success: true,
        messageId: result.data?.id,
        externalId: result.data?.id,
        metadata: {
          to: toAddresses,
          subject: params.subject,
          sentAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error sending email via Resend:', error);

      // Log error to connector
      await this.recordError(error.message, params.taskId);

      return {
        success: false,
        error: error.message || 'Failed to send email',
        metadata: {
          errorCode: error.statusCode,
          errorType: error.name,
        },
      };
    }
  }

  /**
   * Send multiple emails in batch
   */
  async sendBatch(emails: Array<{
    to: string | string[];
    subject: string;
    body: string;
    from?: string;
    replyTo?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  }>): Promise<BatchResult> {
    const results: BatchResult['results'] = [];
    let successful = 0;
    let failed = 0;

    // Resend supports batch sending via multiple API calls
    // We could optimize this with Promise.all, but for now we'll be conservative
    for (const email of emails) {
      const result = await this.sendEmail(email);

      results.push({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        metadata: result.metadata,
      });

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      // Add a small delay to avoid rate limiting
      if (emails.length > 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      totalSent: emails.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Get email delivery status (if available)
   */
  async getDeliveryStatus(messageId: string): Promise<{
    status: 'sent' | 'delivered' | 'bounced' | 'failed';
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }> {
    try {
      // Resend provides webhook events for delivery status
      // For now, we'll query our own database for status
      const supabase = createAdminClient();

      const { data } = await supabase
        .from('email_metrics')
        .select('*')
        .eq('message_id', messageId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!data) {
        return {
          status: 'sent',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: data.status as any,
        timestamp: data.created_at,
        metadata: data.metadata as Record<string, unknown>,
      };
    } catch (error) {
      console.error('Error getting delivery status:', error);
      return {
        status: 'sent',
      };
    }
  }

  /**
   * Get usage statistics for rate limiting
   */
  async getUsageStats(timeWindow: 'hour' | 'day'): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    try {
      const supabase = createAdminClient();

      // Calculate time window
      const now = new Date();
      const windowStart = new Date(
        timeWindow === 'hour'
          ? now.getTime() - 60 * 60 * 1000
          : now.getTime() - 24 * 60 * 60 * 1000
      ).toISOString();

      // Query usage from email_metrics table
      const { count } = await supabase
        .from('email_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('connector_id', this.config.id)
        .gte('created_at', windowStart);

      const used = count || 0;
      const limit = timeWindow === 'hour'
        ? (this.config.rateLimit?.perHour || 1000)
        : (this.config.rateLimit?.perDay || 10000);

      return {
        used,
        limit,
        remaining: Math.max(0, limit - used),
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return {
        used: 0,
        limit: Infinity,
        remaining: Infinity,
      };
    }
  }

  /**
   * Record usage in the database
   */
  private async recordUsage(taskId?: string): Promise<void> {
    try {
      const supabase = createAdminClient();

      // Update connector last_used_at
      await supabase
        .from('connectors')
        .update({
          last_used_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', this.config.id);
    } catch (error) {
      console.error('Error recording usage:', error);
    }
  }

  /**
   * Record error in the database
   */
  private async recordError(error: string, taskId?: string): Promise<void> {
    try {
      const supabase = createAdminClient();

      // Update connector with last error
      await supabase
        .from('connectors')
        .update({
          last_error: error,
        })
        .eq('id', this.config.id);
    } catch (err) {
      console.error('Error recording error:', err);
    }
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Factory function to create a ResendConnector instance
 */
export async function createResendConnector(
  connectorId: string
): Promise<ResendConnector> {
  const supabase = createAdminClient();

  const { data: connector, error } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .eq('type', 'email')
    .single();

  if (error || !connector) {
    throw new Error(`Connector not found: ${connectorId}`);
  }

  return new ResendConnector({
    id: connector.id,
    organizationId: connector.organization_id,
    type: 'email',
    name: connector.name,
    credentials: connector.credentials as Record<string, unknown>,
    config: connector.config as Record<string, unknown>,
    active: connector.active,
    rateLimit: {
      perHour: connector.rate_limit_per_hour || undefined,
      perDay: connector.rate_limit_per_day || undefined,
    },
  });
}
