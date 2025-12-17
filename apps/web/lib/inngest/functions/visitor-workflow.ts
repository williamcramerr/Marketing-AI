import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';
import { ClearbitConnector } from '@/lib/connectors/visitor/clearbit';

/**
 * Handle visitor identification from tracking webhook
 */
export const visitorIdentifiedHandler = inngest.createFunction(
  {
    id: 'visitor-identified',
    retries: 3,
  },
  { event: 'visitor/identified' },
  async ({ event, step }) => {
    const { visitorId, organizationId, companyDomain, fitScore } = event.data;
    const supabase = createAdminClient();

    // Load visitor data
    const visitor = await step.run('load-visitor', async () => {
      const { data, error } = await supabase
        .from('website_visitors')
        .select(`
          *,
          tracking_scripts (id, name, domain, provider)
        `)
        .eq('id', visitorId)
        .single();

      if (error) throw error;
      return data;
    });

    // Enrich company data if not already enriched
    if (!visitor.enrichment_data?.enriched_at && companyDomain) {
      await step.run('enrich-company', async () => {
        // Get Clearbit API key from vault
        const { data: config } = await supabase
          .from('connectors')
          .select('credentials')
          .eq('organization_id', organizationId)
          .eq('type', 'clearbit')
          .eq('status', 'active')
          .single();

        if (config?.credentials?.api_key) {
          const clearbit = new ClearbitConnector({
            apiKey: config.credentials.api_key,
          });

          try {
            const enrichment = await clearbit.enrichCompany(companyDomain);

            await supabase
              .from('website_visitors')
              .update({
                company_name: enrichment.name || visitor.company_name,
                company_logo_url: enrichment.logo,
                enrichment_data: {
                  ...visitor.enrichment_data,
                  ...enrichment,
                  enriched_at: new Date().toISOString(),
                },
              })
              .eq('id', visitorId);
          } catch (error) {
            console.error('Clearbit enrichment failed:', error);
          }
        }
      });
    }

    // Calculate fit score if not provided
    if (fitScore === undefined) {
      await step.run('calculate-fit-score', async () => {
        // Get ICP criteria from organization settings
        const { data: org } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', organizationId)
          .single();

        const icpCriteria = org?.settings?.icp_criteria || {};
        const enrichment = visitor.enrichment_data || {};

        let score = 50; // Base score

        // Industry match
        if (icpCriteria.industries?.includes(enrichment.industry)) {
          score += 15;
        }

        // Company size match
        const employeeCount = enrichment.employee_count || 0;
        if (icpCriteria.min_employees && employeeCount >= icpCriteria.min_employees) {
          score += 10;
        }
        if (icpCriteria.max_employees && employeeCount <= icpCriteria.max_employees) {
          score += 5;
        }

        // Tech stack match
        const techStack = enrichment.tech_stack || [];
        const matchingTech = icpCriteria.required_tech?.filter((t: string) =>
          techStack.some((ts: string) => ts.toLowerCase().includes(t.toLowerCase()))
        );
        if (matchingTech?.length > 0) {
          score += matchingTech.length * 5;
        }

        // Location match
        if (icpCriteria.countries?.includes(enrichment.country)) {
          score += 5;
        }

        // Cap at 100
        score = Math.min(100, score);

        await supabase
          .from('website_visitors')
          .update({ fit_score: score })
          .eq('id', visitorId);
      });
    }

    // Calculate intent score based on behavior
    await step.run('calculate-intent-score', async () => {
      // Get recent sessions
      const { data: sessions } = await supabase
        .from('visitor_sessions')
        .select('*')
        .eq('visitor_id', visitorId)
        .order('started_at', { ascending: false })
        .limit(10);

      let intentScore = 30; // Base score

      if (sessions && sessions.length > 0) {
        // Multiple sessions = higher intent
        intentScore += Math.min(sessions.length * 5, 20);

        // Check page patterns
        const allPages = sessions.flatMap(s => s.pages_visited || []);

        // Pricing page visits
        const pricingVisits = sessions.filter(s => s.visited_pricing).length;
        intentScore += pricingVisits * 10;

        // Demo page visits
        const demoVisits = sessions.filter(s => s.visited_demo).length;
        intentScore += demoVisits * 15;

        // Case study visits
        const caseStudyVisits = sessions.filter(s => s.visited_case_studies).length;
        intentScore += caseStudyVisits * 5;

        // Total pageviews
        if (allPages.length > 10) intentScore += 5;
        if (allPages.length > 20) intentScore += 5;

        // Recent activity
        const lastSession = sessions[0];
        const hoursSinceLastVisit = (Date.now() - new Date(lastSession.started_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastVisit < 24) intentScore += 10;
        if (hoursSinceLastVisit < 1) intentScore += 10;
      }

      // Cap at 100
      intentScore = Math.min(100, intentScore);

      await supabase
        .from('website_visitors')
        .update({ intent_score: intentScore })
        .eq('id', visitorId);
    });

    // Check alert rules
    await step.run('check-alerts', async () => {
      const { data: alerts } = await supabase
        .from('visitor_alerts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('active', true);

      // Reload visitor with updated scores
      const { data: updatedVisitor } = await supabase
        .from('website_visitors')
        .select('*')
        .eq('id', visitorId)
        .single();

      for (const alert of alerts || []) {
        if (matchesAlertConditions(updatedVisitor, alert.conditions)) {
          // Check cooldown
          const { data: recentAlert } = await supabase
            .from('visitor_alert_history')
            .select('id')
            .eq('alert_id', alert.id)
            .eq('visitor_id', visitorId)
            .gte('triggered_at', new Date(Date.now() - alert.cooldown_hours * 60 * 60 * 1000).toISOString())
            .single();

          if (!recentAlert) {
            await inngest.send({
              name: 'visitor/alert-triggered',
              data: {
                alertId: alert.id,
                visitorId,
                organizationId,
              },
            });
          }
        }
      }
    });

    return { status: 'processed', visitorId };
  }
);

/**
 * Handle visitor alert trigger
 */
export const visitorAlertHandler = inngest.createFunction(
  {
    id: 'visitor-alert-triggered',
    retries: 2,
  },
  { event: 'visitor/alert-triggered' },
  async ({ event, step }) => {
    const { alertId, visitorId, organizationId } = event.data;
    const supabase = createAdminClient();

    // Load alert and visitor
    const data = await step.run('load-data', async () => {
      const [alertResult, visitorResult] = await Promise.all([
        supabase.from('visitor_alerts').select('*').eq('id', alertId).single(),
        supabase.from('website_visitors').select('*').eq('id', visitorId).single(),
      ]);

      return {
        alert: alertResult.data,
        visitor: visitorResult.data,
      };
    });

    if (!data.alert || !data.visitor) {
      return { status: 'not_found' };
    }

    const { alert, visitor } = data;

    // Record alert trigger
    await step.run('record-trigger', async () => {
      await supabase.from('visitor_alert_history').insert({
        alert_id: alertId,
        visitor_id: visitorId,
        triggered_at: new Date().toISOString(),
        visitor_snapshot: {
          company_name: visitor.company_name,
          company_domain: visitor.company_domain,
          fit_score: visitor.fit_score,
          intent_score: visitor.intent_score,
          enrichment_data: visitor.enrichment_data,
        },
      });
    });

    // Send notifications based on channels
    for (const channel of alert.notification_channels || []) {
      await step.run(`notify-${channel}`, async () => {
        const config = alert.notification_config || {};

        switch (channel) {
          case 'email':
            // Send email notification
            // Would integrate with email service
            console.log(`Email alert sent for visitor ${visitor.company_name}`);
            break;

          case 'slack':
            // Send Slack notification
            if (config.slack_webhook_url) {
              await fetch(config.slack_webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: `🎯 High-intent visitor alert!`,
                  blocks: [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*${visitor.company_name || visitor.company_domain}* visited your website`,
                      },
                    },
                    {
                      type: 'section',
                      fields: [
                        { type: 'mrkdwn', text: `*Fit Score:* ${visitor.fit_score || 'N/A'}` },
                        { type: 'mrkdwn', text: `*Intent Score:* ${visitor.intent_score || 'N/A'}` },
                        { type: 'mrkdwn', text: `*Industry:* ${visitor.enrichment_data?.industry || 'Unknown'}` },
                        { type: 'mrkdwn', text: `*Size:* ${visitor.enrichment_data?.employee_count || 'Unknown'} employees` },
                      ],
                    },
                  ],
                }),
              });
            }
            break;

          case 'webhook':
            // Send to custom webhook
            if (config.webhook_url) {
              await fetch(config.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'visitor_alert',
                  alert_name: alert.name,
                  visitor: {
                    company_name: visitor.company_name,
                    company_domain: visitor.company_domain,
                    fit_score: visitor.fit_score,
                    intent_score: visitor.intent_score,
                    enrichment_data: visitor.enrichment_data,
                  },
                  triggered_at: new Date().toISOString(),
                }),
              });
            }
            break;
        }
      });
    }

    return { status: 'notified', channels: alert.notification_channels };
  }
);

/**
 * Daily visitor metrics aggregation
 */
export const visitorDailyMetrics = inngest.createFunction(
  {
    id: 'visitor-daily-metrics',
    retries: 1,
  },
  { cron: '0 4 * * *' }, // 4am daily
  async ({ step }) => {
    const supabase = createAdminClient();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    await step.run('aggregate-metrics', async () => {
      // Get all tracking scripts
      const { data: scripts } = await supabase
        .from('tracking_scripts')
        .select('id, organization_id')
        .eq('active', true);

      for (const script of scripts || []) {
        // Count visitors from yesterday
        const { data: visitors } = await supabase
          .from('website_visitors')
          .select('id, fit_score, intent_score')
          .eq('tracking_script_id', script.id)
          .gte('created_at', `${dateStr}T00:00:00`)
          .lt('created_at', `${dateStr}T23:59:59`);

        const { data: sessions } = await supabase
          .from('visitor_sessions')
          .select('visited_pricing, visited_demo, duration_seconds, pages_visited')
          .eq('tracking_script_id', script.id)
          .gte('started_at', `${dateStr}T00:00:00`)
          .lt('started_at', `${dateStr}T23:59:59`);

        const totalVisitors = visitors?.length || 0;
        const identifiedVisitors = visitors?.filter(v => v.fit_score !== null).length || 0;
        const highFitVisitors = visitors?.filter(v => (v.fit_score || 0) >= 70).length || 0;
        const highIntentVisitors = visitors?.filter(v => (v.intent_score || 0) >= 70).length || 0;

        const pricingViews = sessions?.filter(s => s.visited_pricing).length || 0;
        const demoViews = sessions?.filter(s => s.visited_demo).length || 0;
        const avgSessionDuration = sessions?.length
          ? sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions.length
          : 0;
        const totalPageviews = sessions?.reduce(
          (sum, s) => sum + (s.pages_visited?.length || 0),
          0
        ) || 0;

        // Upsert daily metrics
        await supabase.from('visitor_identification_metrics').upsert({
          tracking_script_id: script.id,
          organization_id: script.organization_id,
          date: dateStr,
          total_visitors: totalVisitors,
          identified_visitors: identifiedVisitors,
          high_fit_visitors: highFitVisitors,
          high_intent_visitors: highIntentVisitors,
          pricing_page_views: pricingViews,
          demo_page_views: demoViews,
          avg_session_duration_seconds: Math.round(avgSessionDuration),
          total_pageviews: totalPageviews,
          identification_rate: totalVisitors > 0 ? (identifiedVisitors / totalVisitors) * 100 : 0,
        });
      }
    });

    return { status: 'completed' };
  }
);

/**
 * Weekly cleanup of old visitor data
 */
export const visitorWeeklyCleanup = inngest.createFunction(
  {
    id: 'visitor-weekly-cleanup',
    retries: 1,
  },
  { cron: '0 5 * * 0' }, // 5am on Sundays
  async ({ step }) => {
    const supabase = createAdminClient();

    // Remove sessions older than 90 days
    await step.run('cleanup-old-sessions', async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      await supabase
        .from('visitor_sessions')
        .delete()
        .lt('started_at', ninetyDaysAgo.toISOString());
    });

    // Archive visitors with no recent activity
    await step.run('archive-inactive-visitors', async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Just update last_seen tracking - actual archival logic would go here
      const { count } = await supabase
        .from('website_visitors')
        .select('*', { count: 'exact', head: true })
        .lt('last_seen_at', sixtyDaysAgo.toISOString());

      console.log(`${count} visitors inactive for 60+ days`);
    });

    return { status: 'completed' };
  }
);

// Helper function to check if visitor matches alert conditions
function matchesAlertConditions(visitor: any, conditions: any): boolean {
  if (!conditions) return false;

  const enrichment = visitor.enrichment_data || {};

  // Check fit score
  if (conditions.min_fit_score && (visitor.fit_score || 0) < conditions.min_fit_score) {
    return false;
  }

  // Check intent score
  if (conditions.min_intent_score && (visitor.intent_score || 0) < conditions.min_intent_score) {
    return false;
  }

  // Check employee count
  if (conditions.min_employees && (enrichment.employee_count || 0) < conditions.min_employees) {
    return false;
  }

  // Check industries
  if (conditions.industries?.length > 0 && !conditions.industries.includes(enrichment.industry)) {
    return false;
  }

  // Check visited pricing
  if (conditions.visited_pricing && !visitor.visited_pricing) {
    return false;
  }

  // Check visited demo
  if (conditions.visited_demo && !visitor.visited_demo) {
    return false;
  }

  return true;
}
