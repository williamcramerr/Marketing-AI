'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Lead Magnets & Nurture Server Actions
 */

// ============================================
// LEAD MAGNETS
// ============================================

export async function getLeadMagnets(organizationId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('lead_magnets')
    .select(`
      *,
      products (id, name),
      nurture_sequences (id, name)
    `)
    .order('created_at', { ascending: false });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: magnets, error } = await query;

  if (error) throw error;
  return magnets;
}

export async function getLeadMagnet(id: string) {
  const supabase = await createClient();

  const { data: magnet, error } = await supabase
    .from('lead_magnets')
    .select(`
      *,
      products (id, name),
      nurture_sequences (id, name, nurture_emails(*))
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return magnet;
}

export async function getLeadMagnetBySlug(organizationId: string, slug: string) {
  const supabase = await createClient();

  const { data: magnet, error } = await supabase
    .from('lead_magnets')
    .select(`
      *,
      products (id, name)
    `)
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error) throw error;
  return magnet;
}

interface CreateLeadMagnetInput {
  title: string;
  slug: string;
  description?: string;
  magnetType: string;
  fileUrl?: string;
  externalUrl?: string;
  landingPageTemplate?: string;
  landingPageConfig?: Record<string, unknown>;
  organizationId?: string;
  productId?: string;
}

export async function createLeadMagnet(input: FormData | CreateLeadMagnetInput): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const supabase = await createClient();

  let organizationId: string | null = null;
  let productId: string | null = null;
  let title: string;
  let slug: string;
  let description: string | null = null;
  let magnetType: string;
  let filePath: string | null = null;
  let externalUrl: string | null = null;
  let landingPageTemplate: string = 'standard';
  let landingPageConfig: Record<string, unknown> = {};

  if (input instanceof FormData) {
    organizationId = input.get('organization_id') as string;
    productId = input.get('product_id') as string | null;
    title = input.get('title') as string;
    slug = input.get('slug') as string;
    description = input.get('description') as string;
    magnetType = input.get('magnet_type') as string;
    filePath = input.get('file_path') as string | null;
    externalUrl = input.get('external_url') as string | null;
    landingPageTemplate = (input.get('landing_page_template') as string) || 'standard';
    const configStr = input.get('landing_page_config') as string;
    landingPageConfig = configStr ? JSON.parse(configStr) : {};
  } else {
    title = input.title;
    slug = input.slug;
    description = input.description || null;
    magnetType = input.magnetType;
    filePath = input.fileUrl || null;
    externalUrl = input.externalUrl || null;
    landingPageTemplate = input.landingPageTemplate || 'standard';
    landingPageConfig = input.landingPageConfig || {};
    organizationId = input.organizationId || null;
    productId = input.productId || null;
  }

  // If no organization provided, get from user's membership
  if (!organizationId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }
    organizationId = membership.organization_id;
  }

  const { data: magnet, error } = await supabase
    .from('lead_magnets')
    .insert({
      organization_id: organizationId,
      product_id: productId || null,
      title,
      slug,
      description,
      magnet_type: magnetType,
      file_path: filePath,
      external_url: externalUrl,
      landing_page_template: landingPageTemplate,
      landing_page_config: landingPageConfig,
      active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/growth/leads');
  return { success: true, data: magnet };
}

export async function updateLeadMagnet(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const title = formData.get('title');
  if (title) updates.title = title;

  const description = formData.get('description');
  if (description !== null) updates.description = description;

  const active = formData.get('active');
  if (active !== null) updates.active = active === 'true';

  const landingPageConfig = formData.get('landing_page_config');
  if (landingPageConfig) updates.landing_page_config = JSON.parse(landingPageConfig as string);

  const { data: magnet, error } = await supabase
    .from('lead_magnets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/leads');
  revalidatePath(`/dashboard/growth/leads/magnets/${id}`);
  return magnet;
}

export async function deleteLeadMagnet(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('lead_magnets')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/leads');
}

export async function publishLeadMagnet(id: string) {
  const supabase = await createClient();

  const { data: magnet, error } = await supabase
    .from('lead_magnets')
    .update({
      active: true,
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/leads');
  return magnet;
}

// ============================================
// LEADS
// ============================================

export async function getLeads(filters?: {
  organizationId?: string;
  magnetId?: string;
  nurtureStatus?: string;
  subscribed?: boolean;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();

  let query = supabase
    .from('leads')
    .select(`
      *,
      lead_magnets (id, title),
      nurture_sequences (id, name)
    `)
    .order('created_at', { ascending: false });

  if (filters?.organizationId) {
    query = query.eq('organization_id', filters.organizationId);
  }
  if (filters?.magnetId) {
    query = query.eq('lead_magnet_id', filters.magnetId);
  }
  if (filters?.nurtureStatus) {
    query = query.eq('nurture_status', filters.nurtureStatus);
  }
  if (filters?.subscribed !== undefined) {
    query = query.eq('subscribed', filters.subscribed);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data: leads, error } = await query;

  if (error) throw error;
  return leads;
}

export async function getLead(id: string) {
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      *,
      lead_magnets (id, title),
      nurture_sequences (id, name),
      lead_events (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return lead;
}

export async function captureLead(formData: FormData) {
  const supabase = await createClient();

  const organizationId = formData.get('organization_id') as string;
  const magnetId = formData.get('lead_magnet_id') as string | null;
  const email = formData.get('email') as string;
  const firstName = formData.get('first_name') as string | null;
  const lastName = formData.get('last_name') as string | null;
  const company = formData.get('company') as string | null;
  const customFields = formData.get('custom_fields') as string | null;
  const source = formData.get('source') as string || 'lead_magnet';
  const utmSource = formData.get('utm_source') as string | null;
  const utmMedium = formData.get('utm_medium') as string | null;
  const utmCampaign = formData.get('utm_campaign') as string | null;

  // Check if lead already exists
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('email', email)
    .single();

  if (existingLead) {
    // Update existing lead
    const { data: lead, error } = await supabase
      .from('leads')
      .update({
        lead_magnet_id: magnetId,
        first_name: firstName,
        last_name: lastName,
        company,
        custom_fields: customFields ? JSON.parse(customFields) : undefined,
      })
      .eq('id', existingLead.id)
      .select()
      .single();

    if (error) throw error;
    return { lead, isNew: false };
  }

  // Create new lead
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      organization_id: organizationId,
      lead_magnet_id: magnetId,
      email,
      first_name: firstName,
      last_name: lastName,
      company,
      custom_fields: customFields ? JSON.parse(customFields) : {},
      source,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      subscribed: true,
    })
    .select()
    .single();

  if (error) throw error;

  // Increment lead magnet download count
  if (magnetId) {
    await supabase
      .from('lead_magnets')
      .update({ download_count: supabase.rpc('increment', { value: 1 }) } as any)
      .eq('id', magnetId);
  }

  return { lead, isNew: true };
}

export async function updateLeadNurtureStatus(
  id: string,
  status: 'pending' | 'active' | 'paused' | 'completed' | 'unsubscribed' | 'converted' | 'bounced'
) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    nurture_status: status,
  };

  if (status === 'unsubscribed') {
    updates.subscribed = false;
    updates.unsubscribed_at = new Date().toISOString();
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/leads');
  return lead;
}

export async function exportLeads(organizationId: string, format: 'csv' | 'json' = 'csv') {
  const supabase = await createClient();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  if (format === 'json') {
    return JSON.stringify(leads, null, 2);
  }

  // CSV export
  const headers = ['email', 'first_name', 'last_name', 'company', 'source', 'nurture_status', 'created_at'];
  const rows = leads?.map(lead =>
    headers.map(h => (lead as any)[h] || '').join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// ============================================
// NURTURE SEQUENCES
// ============================================

export async function getNurtureSequences(organizationId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('nurture_sequences')
    .select(`
      *,
      products (id, name),
      lead_magnets (id, title),
      nurture_emails (count)
    `)
    .order('created_at', { ascending: false });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: sequences, error } = await query;

  if (error) throw error;
  return sequences;
}

export async function getNurtureSequence(id: string) {
  const supabase = await createClient();

  const { data: sequence, error } = await supabase
    .from('nurture_sequences')
    .select(`
      *,
      products (id, name),
      lead_magnets (id, title),
      nurture_emails (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return sequence;
}

export async function createNurtureSequence(formData: FormData) {
  const supabase = await createClient();

  const organizationId = formData.get('organization_id') as string;
  const productId = formData.get('product_id') as string | null;
  const magnetId = formData.get('lead_magnet_id') as string | null;
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const goal = formData.get('goal') as string;
  const goalAction = formData.get('goal_action') as string;

  const { data: sequence, error } = await supabase
    .from('nurture_sequences')
    .insert({
      organization_id: organizationId,
      product_id: productId || null,
      lead_magnet_id: magnetId || null,
      name,
      description,
      goal,
      goal_action: goalAction,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/leads');
  return sequence;
}

export async function addEmailToSequence(sequenceId: string, formData: FormData) {
  const supabase = await createClient();

  const sequenceOrder = parseInt(formData.get('sequence_order') as string);
  const delayDays = parseInt(formData.get('delay_days') as string);
  const subject = formData.get('subject') as string;
  const previewText = formData.get('preview_text') as string;
  const bodyHtml = formData.get('body_html') as string;
  const bodyText = formData.get('body_text') as string;
  const emailType = formData.get('email_type') as string;
  const aiGenerated = formData.get('ai_generated') === 'true';

  const { data: email, error } = await supabase
    .from('nurture_emails')
    .insert({
      sequence_id: sequenceId,
      sequence_order: sequenceOrder,
      delay_days: delayDays,
      subject,
      preview_text: previewText,
      body_html: bodyHtml,
      body_text: bodyText,
      email_type: emailType || 'value',
      ai_generated: aiGenerated,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath(`/dashboard/growth/leads/sequences/${sequenceId}`);
  return email;
}

export async function updateNurtureEmail(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const subject = formData.get('subject');
  if (subject) updates.subject = subject;

  const previewText = formData.get('preview_text');
  if (previewText !== null) updates.preview_text = previewText;

  const bodyHtml = formData.get('body_html');
  if (bodyHtml) updates.body_html = bodyHtml;

  const bodyText = formData.get('body_text');
  if (bodyText !== null) updates.body_text = bodyText;

  const delayDays = formData.get('delay_days');
  if (delayDays) updates.delay_days = parseInt(delayDays as string);

  const active = formData.get('active');
  if (active !== null) updates.active = active === 'true';

  const { data: email, error } = await supabase
    .from('nurture_emails')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/leads');
  return email;
}

export async function deleteNurtureEmail(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('nurture_emails')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/leads');
}

export async function reorderNurtureEmails(sequenceId: string, orderedIds: string[]) {
  const supabase = await createClient();

  // Update each email's sequence_order
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('nurture_emails')
      .update({ sequence_order: i + 1 })
      .eq('id', orderedIds[i]);
  }

  revalidatePath(`/dashboard/growth/leads/sequences/${sequenceId}`);
}

// ============================================
// ANALYTICS
// ============================================

export async function getLeadMagnetAnalytics(magnetId?: string, dateRange?: { start: Date; end: Date }) {
  const supabase = await createClient();

  let query = supabase
    .from('lead_magnet_metrics')
    .select('*')
    .order('date', { ascending: false });

  if (magnetId) {
    query = query.eq('lead_magnet_id', magnetId);
  }

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

export async function getLeadsSummary(organizationId: string) {
  const supabase = await createClient();

  // Get total leads
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  // Get leads this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count: leadsThisWeek } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('created_at', weekAgo.toISOString());

  // Get active nurtures
  const { count: activeNurtures } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('nurture_status', 'active');

  // Get conversions this month
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const { count: conversionsThisMonth } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .not('converted_at', 'is', null)
    .gte('converted_at', monthAgo.toISOString());

  return {
    totalLeads: totalLeads || 0,
    leadsThisWeek: leadsThisWeek || 0,
    activeNurtures: activeNurtures || 0,
    conversionsThisMonth: conversionsThisMonth || 0,
  };
}
