import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Lead Captured - Starts nurture sequence
 */
export const leadCapturedHandler = inngest.createFunction(
  {
    id: 'lead-captured',
    retries: 3,
  },
  { event: 'lead/captured' },
  async ({ event, step }) => {
    const { leadId, leadMagnetId, email, organizationId } = event.data;
    const supabase = createAdminClient();

    // Load lead magnet and its nurture sequence
    const data = await step.run('load-data', async () => {
      const { data: leadMagnet, error } = await supabase
        .from('lead_magnets')
        .select(`
          *,
          nurture_sequences (
            *,
            nurture_emails (*)
          )
        `)
        .eq('id', leadMagnetId)
        .single();

      if (error) throw error;
      return leadMagnet;
    });

    if (!data.nurture_sequence_id || !data.nurture_sequences) {
      return { status: 'no_sequence_configured', leadId };
    }

    const sequence = data.nurture_sequences;
    const emails = sequence.nurture_emails?.sort(
      (a: any, b: any) => a.sequence_order - b.sequence_order
    ) || [];

    if (emails.length === 0) {
      return { status: 'empty_sequence', leadId };
    }

    // Update lead with sequence info
    await step.run('assign-sequence', async () => {
      await supabase
        .from('leads')
        .update({
          nurture_sequence_id: sequence.id,
          nurture_status: 'active',
          current_email_index: 0,
        })
        .eq('id', leadId);
    });

    // Send first email immediately (welcome email)
    const firstEmail = emails[0];
    if (firstEmail.delay_days === 0) {
      await step.run('send-welcome-email', async () => {
        await sendNurtureEmail(supabase, leadId, firstEmail, email, organizationId);
      });

      // Log event
      await step.run('log-welcome-event', async () => {
        await supabase.from('lead_events').insert({
          lead_id: leadId,
          event_type: 'email_sent',
          nurture_email_id: firstEmail.id,
          metadata: { email_type: 'welcome', sequence_order: 1 },
        });
      });
    }

    // Schedule remaining emails
    for (let i = firstEmail.delay_days === 0 ? 1 : 0; i < emails.length; i++) {
      const email = emails[i];
      const delayMs = email.delay_days * 24 * 60 * 60 * 1000;

      await step.sendEvent(`schedule-email-${i}`, {
        name: 'nurture/email-due',
        data: {
          leadId,
          sequenceId: sequence.id,
          emailId: email.id,
          organizationId,
        },
        ts: Date.now() + delayMs,
      });
    }

    return { status: 'sequence_started', leadId, emailsScheduled: emails.length };
  }
);

/**
 * Process scheduled nurture email
 */
export const nurtureEmailDueHandler = inngest.createFunction(
  {
    id: 'nurture-email-due',
    retries: 3,
  },
  { event: 'nurture/email-due' },
  async ({ event, step }) => {
    const { leadId, sequenceId, emailId, organizationId } = event.data;
    const supabase = createAdminClient();

    // Load lead and check status
    const lead = await step.run('load-lead', async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error) throw error;
      return data;
    });

    // Check if lead is still active in sequence
    if (lead.nurture_status !== 'active' || lead.nurture_sequence_id !== sequenceId) {
      return { status: 'skipped', reason: 'lead_not_active', leadId };
    }

    if (!lead.subscribed) {
      return { status: 'skipped', reason: 'unsubscribed', leadId };
    }

    // Load the email
    const email = await step.run('load-email', async () => {
      const { data, error } = await supabase
        .from('nurture_emails')
        .select('*')
        .eq('id', emailId)
        .eq('active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    });

    if (!email) {
      return { status: 'skipped', reason: 'email_inactive', leadId };
    }

    // Check send window (if configured)
    const sequence = await step.run('load-sequence', async () => {
      const { data } = await supabase
        .from('nurture_sequences')
        .select('send_on_days, send_time_utc')
        .eq('id', sequenceId)
        .single();
      return data;
    });

    // If send_on_days is configured, check if today is valid
    if (sequence?.send_on_days?.length > 0) {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
      if (!sequence.send_on_days.includes(today)) {
        // Reschedule for next valid day
        const nextValidDay = getNextValidDay(sequence.send_on_days);
        await step.sendEvent('reschedule-email', {
          name: 'nurture/email-due',
          data: { leadId, sequenceId, emailId, organizationId },
          ts: nextValidDay.getTime(),
        });
        return { status: 'rescheduled', nextSend: nextValidDay.toISOString() };
      }
    }

    // Send the email
    await step.run('send-email', async () => {
      await sendNurtureEmail(supabase, leadId, email, lead.email, organizationId);
    });

    // Update lead progress
    await step.run('update-progress', async () => {
      await supabase
        .from('leads')
        .update({
          current_email_index: email.sequence_order,
        })
        .eq('id', leadId);

      // Log event
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'email_sent',
        nurture_email_id: emailId,
        metadata: { sequence_order: email.sequence_order },
      });
    });

    // Check if sequence is complete
    const isComplete = await step.run('check-completion', async () => {
      const { count } = await supabase
        .from('nurture_emails')
        .select('*', { count: 'exact', head: true })
        .eq('sequence_id', sequenceId)
        .eq('active', true)
        .gt('sequence_order', email.sequence_order);

      return count === 0;
    });

    if (isComplete) {
      await step.run('mark-complete', async () => {
        await supabase
          .from('leads')
          .update({ nurture_status: 'completed' })
          .eq('id', leadId);

        await supabase.from('lead_events').insert({
          lead_id: leadId,
          event_type: 'sequence_completed',
          metadata: { sequence_id: sequenceId },
        });
      });
    }

    return { status: 'sent', leadId, emailId, isComplete };
  }
);

/**
 * Hourly check for pending nurture emails
 */
export const nurtureProcessQueue = inngest.createFunction(
  {
    id: 'nurture-process-queue',
    retries: 1,
  },
  { cron: '0 * * * *' }, // Every hour
  async ({ step }) => {
    const supabase = createAdminClient();

    // Find leads that need emails sent
    const pendingLeads = await step.run('find-pending', async () => {
      const { data } = await supabase
        .from('leads')
        .select(`
          id,
          email,
          organization_id,
          nurture_sequence_id,
          current_email_index,
          nurture_sequences (
            id,
            nurture_emails (
              id,
              sequence_order,
              delay_days
            )
          )
        `)
        .eq('nurture_status', 'active')
        .eq('subscribed', true)
        .not('nurture_sequence_id', 'is', null);

      return data || [];
    });

    let emailsTriggered = 0;

    for (const lead of pendingLeads) {
      const sequence = (lead as any).nurture_sequences;
      if (!sequence?.nurture_emails) continue;

      const emails = sequence.nurture_emails.sort(
        (a: any, b: any) => a.sequence_order - b.sequence_order
      );

      // Find next email to send
      const nextEmail = emails.find(
        (e: any) => e.sequence_order > lead.current_email_index
      );

      if (nextEmail) {
        // Check if enough time has passed since last email
        const { data: lastEvent } = await supabase
          .from('lead_events')
          .select('created_at')
          .eq('lead_id', lead.id)
          .eq('event_type', 'email_sent')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastEvent) {
          const lastSentAt = new Date(lastEvent.created_at);
          const dueAt = new Date(lastSentAt.getTime() + nextEmail.delay_days * 24 * 60 * 60 * 1000);

          if (new Date() >= dueAt) {
            await inngest.send({
              name: 'nurture/email-due',
              data: {
                leadId: lead.id,
                sequenceId: sequence.id,
                emailId: nextEmail.id,
                organizationId: lead.organization_id,
              },
            });
            emailsTriggered++;
          }
        }
      }
    }

    return { status: 'completed', emailsTriggered };
  }
);

/**
 * Handle email tracking events (opens, clicks)
 */
export const nurtureEmailTracking = inngest.createFunction(
  {
    id: 'nurture-email-tracking',
    retries: 2,
  },
  { event: 'nurture/email-sent' },
  async ({ event, step }) => {
    const { leadId, emailId, messageId } = event.data;
    const supabase = createAdminClient();

    // Store message ID for tracking
    await step.run('store-tracking', async () => {
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'email_sent',
        nurture_email_id: emailId,
        metadata: { message_id: messageId },
      });
    });

    // Wait for tracking events (with timeout)
    // This would integrate with email provider webhooks
    await step.sleep('wait-for-tracking', '24h');

    // Check for opens/clicks from webhook data
    const trackingData = await step.run('check-tracking', async () => {
      const { data } = await supabase
        .from('lead_events')
        .select('event_type')
        .eq('lead_id', leadId)
        .eq('nurture_email_id', emailId)
        .in('event_type', ['email_opened', 'email_clicked']);

      return {
        opened: data?.some(e => e.event_type === 'email_opened') || false,
        clicked: data?.some(e => e.event_type === 'email_clicked') || false,
      };
    });

    return { status: 'tracked', ...trackingData };
  }
);

/**
 * Daily metrics aggregation for nurture sequences
 */
export const nurtureDailyMetrics = inngest.createFunction(
  {
    id: 'nurture-daily-metrics',
    retries: 1,
  },
  { cron: '0 3 * * *' }, // 3am daily
  async ({ step }) => {
    const supabase = createAdminClient();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    await step.run('aggregate-metrics', async () => {
      // Get all sequences
      const { data: sequences } = await supabase
        .from('nurture_sequences')
        .select('id, organization_id');

      for (const sequence of sequences || []) {
        // Count events from yesterday
        const { data: events } = await supabase
          .from('lead_events')
          .select('event_type, lead_id')
          .eq('nurture_email_id', sequence.id)
          .gte('created_at', `${dateStr}T00:00:00`)
          .lt('created_at', `${dateStr}T23:59:59`);

        const emailsSent = events?.filter(e => e.event_type === 'email_sent').length || 0;
        const emailsOpened = events?.filter(e => e.event_type === 'email_opened').length || 0;
        const emailsClicked = events?.filter(e => e.event_type === 'email_clicked').length || 0;

        // Count conversions
        const { data: conversions } = await supabase
          .from('leads')
          .select('id')
          .eq('nurture_sequence_id', sequence.id)
          .gte('converted_at', `${dateStr}T00:00:00`)
          .lt('converted_at', `${dateStr}T23:59:59`);

        // Upsert metrics
        await supabase.from('nurture_sequence_metrics').upsert({
          sequence_id: sequence.id,
          organization_id: sequence.organization_id,
          date: dateStr,
          emails_sent: emailsSent,
          emails_opened: emailsOpened,
          emails_clicked: emailsClicked,
          conversions: conversions?.length || 0,
          open_rate: emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0,
          click_rate: emailsSent > 0 ? (emailsClicked / emailsSent) * 100 : 0,
        });
      }
    });

    return { status: 'completed' };
  }
);

// Helper functions

async function sendNurtureEmail(
  supabase: ReturnType<typeof createAdminClient>,
  leadId: string,
  email: any,
  recipientEmail: string,
  organizationId: string
) {
  // Get lead for merge tags
  const { data: lead } = await supabase
    .from('leads')
    .select('first_name, last_name, company')
    .eq('id', leadId)
    .single();

  // Replace merge tags
  let subject = email.subject;
  let bodyHtml = email.body_html;
  let bodyText = email.body_text;

  const mergeTags: Record<string, string> = {
    '{{first_name}}': lead?.first_name || 'there',
    '{{last_name}}': lead?.last_name || '',
    '{{company_name}}': lead?.company || '',
    '{{email}}': recipientEmail,
  };

  for (const [tag, value] of Object.entries(mergeTags)) {
    subject = subject.replace(new RegExp(tag, 'g'), value);
    bodyHtml = bodyHtml?.replace(new RegExp(tag, 'g'), value) || '';
    bodyText = bodyText?.replace(new RegExp(tag, 'g'), value) || '';
  }

  // Get email connector
  const { data: connector } = await supabase
    .from('connectors')
    .select('credentials, config')
    .eq('organization_id', organizationId)
    .eq('type', 'email')
    .eq('status', 'active')
    .single();

  // Send via email service (e.g., Resend)
  // This would integrate with the actual email service
  // For now, we'll simulate the send

  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // In production, this would be:
  // const resend = new Resend(connector.credentials.api_key);
  // const result = await resend.emails.send({
  //   from: connector.config.from_email,
  //   to: recipientEmail,
  //   subject,
  //   html: bodyHtml,
  //   text: bodyText,
  // });

  console.log(`Nurture email sent to ${recipientEmail}: ${subject}`);

  return { messageId };
}

function getNextValidDay(validDays: string[]): Date {
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const validDayNumbers = validDays.map(d => dayMap[d.toLowerCase()]).sort();
  const today = new Date();
  const currentDay = today.getDay();

  // Find next valid day
  let nextDay = validDayNumbers.find(d => d > currentDay);
  if (nextDay === undefined) {
    nextDay = validDayNumbers[0]; // Wrap to next week
  }

  const daysUntil = nextDay > currentDay ? nextDay - currentDay : 7 - currentDay + nextDay;
  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + daysUntil);
  nextDate.setHours(10, 0, 0, 0); // Default to 10am

  return nextDate;
}
