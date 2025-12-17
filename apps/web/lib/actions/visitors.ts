'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';

/**
 * Website Visitor Identification Server Actions
 */

// ============================================
// TRACKING SCRIPTS
// ============================================

export async function getTrackingScripts() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: scripts, error } = await supabase
    .from('tracking_scripts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return scripts;
}

export async function getTrackingScript(id: string) {
  const supabase = await createClient();

  const { data: script, error } = await supabase
    .from('tracking_scripts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return script;
}

export async function createTrackingScript(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const name = formData.get('name') as string;
  const organizationId = formData.get('organization_id') as string;
  const domain = formData.get('domain') as string;
  const provider = (formData.get('provider') as string) || 'clearbit';

  // Generate a unique script key
  const scriptKey = `mpai_${nanoid(16)}`;

  const { data: script, error } = await supabase
    .from('tracking_scripts')
    .insert({
      organization_id: organizationId,
      name,
      domain: domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      script_key: scriptKey,
      provider,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/visitors');
  return script;
}

export async function updateTrackingScript(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const name = formData.get('name');
  if (name) updates.name = name;

  const domain = formData.get('domain');
  if (domain) {
    updates.domain = (domain as string).toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  const active = formData.get('active');
  if (active !== null) updates.active = active === 'true';

  const { data: script, error } = await supabase
    .from('tracking_scripts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/visitors');
  return script;
}

export async function deleteTrackingScript(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('tracking_scripts')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/visitors');
}

export async function getTrackingScriptCode(scriptKey: string) {
  // Return the embeddable tracking script code
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.marketingpilot.ai';

  return `<!-- Marketing Pilot AI Visitor Tracking -->
<script>
(function() {
  var s = document.createElement('script');
  s.src = '${baseUrl}/tracker.js';
  s.async = true;
  s.setAttribute('data-key', '${scriptKey}');
  document.head.appendChild(s);
})();
</script>`;
}

// ============================================
// VISITORS
// ============================================

export async function getVisitors(filters?: {
  trackingScriptId?: string;
  minFitScore?: number;
  minIntentScore?: number;
  industry?: string;
  employeeCountMin?: number;
  visitedPricing?: boolean;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();

  let query = supabase
    .from('website_visitors')
    .select(`
      *,
      tracking_scripts (id, name, domain),
      visitor_sessions (
        id,
        session_id,
        pages_visited,
        visited_pricing,
        visited_demo,
        started_at,
        duration_seconds
      )
    `)
    .order('last_seen_at', { ascending: false });

  if (filters?.trackingScriptId) {
    query = query.eq('tracking_script_id', filters.trackingScriptId);
  }
  if (filters?.minFitScore) {
    query = query.gte('fit_score', filters.minFitScore);
  }
  if (filters?.minIntentScore) {
    query = query.gte('intent_score', filters.minIntentScore);
  }
  if (filters?.industry) {
    query = query.eq('enrichment_data->industry', filters.industry);
  }
  if (filters?.employeeCountMin) {
    query = query.gte('enrichment_data->employee_count', filters.employeeCountMin);
  }
  if (filters?.visitedPricing) {
    query = query.eq('visitor_sessions.visited_pricing', true);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data: visitors, error } = await query;

  if (error) throw error;
  return visitors;
}

export async function getVisitor(id: string) {
  const supabase = await createClient();

  const { data: visitor, error } = await supabase
    .from('website_visitors')
    .select(`
      *,
      tracking_scripts (id, name, domain),
      visitor_sessions (
        id,
        session_id,
        pages_visited,
        visited_pricing,
        visited_demo,
        visited_case_studies,
        started_at,
        duration_seconds,
        country,
        city,
        created_at
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return visitor;
}

export async function updateVisitorScores(id: string, fitScore: number, intentScore: number) {
  const supabase = await createClient();

  const { data: visitor, error } = await supabase
    .from('website_visitors')
    .update({
      fit_score: fitScore,
      intent_score: intentScore,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/visitors');
  return visitor;
}

// ============================================
// VISITOR ALERTS
// ============================================

export async function getVisitorAlerts() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: alerts, error } = await supabase
    .from('visitor_alerts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return alerts;
}

export async function createVisitorAlert(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const name = formData.get('name') as string;
  const organizationId = formData.get('organization_id') as string;
  const conditions = JSON.parse(formData.get('conditions') as string);
  const notificationChannels = (formData.get('notification_channels') as string).split(',').filter(Boolean);
  const notificationConfig = formData.get('notification_config')
    ? JSON.parse(formData.get('notification_config') as string)
    : {};
  const cooldownHours = parseInt(formData.get('cooldown_hours') as string) || 24;

  const { data: alert, error } = await supabase
    .from('visitor_alerts')
    .insert({
      organization_id: organizationId,
      name,
      conditions,
      notification_channels: notificationChannels,
      notification_config: notificationConfig,
      cooldown_hours: cooldownHours,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/visitors/alerts');
  return alert;
}

export async function updateVisitorAlert(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const name = formData.get('name');
  if (name) updates.name = name;

  const conditions = formData.get('conditions');
  if (conditions) updates.conditions = JSON.parse(conditions as string);

  const notificationChannels = formData.get('notification_channels');
  if (notificationChannels) {
    updates.notification_channels = (notificationChannels as string).split(',').filter(Boolean);
  }

  const active = formData.get('active');
  if (active !== null) updates.active = active === 'true';

  const { data: alert, error } = await supabase
    .from('visitor_alerts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/visitors/alerts');
  return alert;
}

export async function deleteVisitorAlert(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('visitor_alerts')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/visitors/alerts');
}

// ============================================
// ANALYTICS
// ============================================

export async function getVisitorAnalytics(dateRange?: { start: Date; end: Date }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  let query = supabase
    .from('visitor_identification_metrics')
    .select('*')
    .order('date', { ascending: false });

  if (dateRange) {
    query = query
      .gte('date', dateRange.start.toISOString().split('T')[0])
      .lte('date', dateRange.end.toISOString().split('T')[0]);
  } else {
    // Default to last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
  }

  const { data: metrics, error } = await query;

  if (error) throw error;
  return metrics;
}

export async function getVisitorSummary() {
  const supabase = await createClient();

  // Get visitor counts by fit score
  const { data: visitors, error: visitorsError } = await supabase
    .from('website_visitors')
    .select('fit_score, intent_score');

  if (visitorsError) throw visitorsError;

  const fitScoreBuckets = {
    high: visitors?.filter(v => (v.fit_score || 0) >= 70).length || 0,
    medium: visitors?.filter(v => (v.fit_score || 0) >= 40 && (v.fit_score || 0) < 70).length || 0,
    low: visitors?.filter(v => (v.fit_score || 0) < 40).length || 0,
  };

  // Get visitors from today with high intent
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count: todayHighIntent, error: highIntentError } = await supabase
    .from('website_visitors')
    .select('*', { count: 'exact', head: true })
    .gte('intent_score', 70)
    .gte('last_seen_at', today.toISOString());

  if (highIntentError) throw highIntentError;

  // Get visitors who viewed pricing this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count: viewedPricingWeek, error: pricingError } = await supabase
    .from('visitor_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('visited_pricing', true)
    .gte('started_at', weekAgo.toISOString());

  if (pricingError) throw pricingError;

  return {
    fitScoreBuckets,
    todayHighIntent: todayHighIntent || 0,
    viewedPricingWeek: viewedPricingWeek || 0,
    totalVisitors: visitors?.length || 0,
  };
}

// ============================================
// VISITOR SESSION TRACKING (API ENDPOINT USE)
// ============================================

export async function recordVisitorSession(data: {
  scriptKey: string;
  sessionId: string;
  companyDomain?: string;
  companyName?: string;
  enrichmentData?: Record<string, unknown>;
  pagesVisited: Array<{ url: string; title: string; timestamp: string; duration?: number }>;
  visitedPricing: boolean;
  visitedDemo: boolean;
  visitedCaseStudies: boolean;
  country?: string;
  city?: string;
}) {
  const supabase = await createClient();

  // First, find the tracking script
  const { data: script, error: scriptError } = await supabase
    .from('tracking_scripts')
    .select('id, organization_id')
    .eq('script_key', data.scriptKey)
    .eq('active', true)
    .single();

  if (scriptError || !script) {
    throw new Error('Invalid or inactive tracking script');
  }

  // Upsert the visitor
  let visitor;
  if (data.companyDomain) {
    const { data: existingVisitor } = await supabase
      .from('website_visitors')
      .select('id, total_sessions, total_pageviews')
      .eq('organization_id', script.organization_id)
      .eq('company_domain', data.companyDomain)
      .single();

    if (existingVisitor) {
      // Update existing visitor
      const { data: updatedVisitor, error: updateError } = await supabase
        .from('website_visitors')
        .update({
          company_name: data.companyName || existingVisitor,
          enrichment_data: data.enrichmentData || {},
          last_seen_at: new Date().toISOString(),
          total_sessions: (existingVisitor.total_sessions || 0) + 1,
          total_pageviews: (existingVisitor.total_pageviews || 0) + data.pagesVisited.length,
        })
        .eq('id', existingVisitor.id)
        .select()
        .single();

      if (updateError) throw updateError;
      visitor = updatedVisitor;
    } else {
      // Create new visitor
      const { data: newVisitor, error: createError } = await supabase
        .from('website_visitors')
        .insert({
          organization_id: script.organization_id,
          tracking_script_id: script.id,
          company_domain: data.companyDomain,
          company_name: data.companyName,
          enrichment_data: data.enrichmentData || {},
          total_sessions: 1,
          total_pageviews: data.pagesVisited.length,
        })
        .select()
        .single();

      if (createError) throw createError;
      visitor = newVisitor;
    }
  }

  // Create the session record
  if (visitor) {
    const sessionDuration = data.pagesVisited.reduce((total, page) => total + (page.duration || 0), 0);

    const { error: sessionError } = await supabase
      .from('visitor_sessions')
      .insert({
        visitor_id: visitor.id,
        session_id: data.sessionId,
        pages_visited: data.pagesVisited,
        visited_pricing: data.visitedPricing,
        visited_demo: data.visitedDemo,
        visited_case_studies: data.visitedCaseStudies,
        duration_seconds: sessionDuration,
        country: data.country,
        city: data.city,
      });

    if (sessionError) throw sessionError;
  }

  return { success: true, visitorId: visitor?.id };
}
