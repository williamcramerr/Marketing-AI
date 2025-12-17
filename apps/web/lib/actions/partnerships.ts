'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Partnership Finder Server Actions
 */

// ============================================
// PARTNERSHIP OPPORTUNITIES
// ============================================

export async function getPartnershipOpportunities(filters?: {
  status?: string;
  minScore?: number;
  source?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  let query = supabase
    .from('partnership_opportunities')
    .select(`
      *,
      partnership_outreach (
        id,
        sequence_number,
        channel,
        status,
        sent_at,
        replied_at
      )
    `)
    .order('opportunity_score', { ascending: false, nullsFirst: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.minScore) {
    query = query.gte('opportunity_score', filters.minScore);
  }
  if (filters?.source) {
    query = query.eq('discovery_source', filters.source);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data: opportunities, error } = await query;

  if (error) throw error;
  return opportunities;
}

export async function getPartnershipOpportunity(id: string) {
  const supabase = await createClient();

  const { data: opportunity, error } = await supabase
    .from('partnership_opportunities')
    .select(`
      *,
      partnership_outreach (
        id,
        sequence_number,
        channel,
        subject,
        body,
        ai_generated,
        status,
        sent_at,
        replied_at,
        created_at
      ),
      partnerships (id, partnership_type, active)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return opportunity;
}

export async function createPartnershipOpportunity(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const organizationId = formData.get('organization_id') as string;
  const companyName = formData.get('company_name') as string;
  const companyWebsite = formData.get('company_website') as string | null;
  const companyDescription = formData.get('company_description') as string | null;
  const companyIndustry = formData.get('company_industry') as string | null;
  const companySize = formData.get('company_size') as string | null;
  const contactName = formData.get('contact_name') as string | null;
  const contactEmail = formData.get('contact_email') as string | null;
  const contactLinkedin = formData.get('contact_linkedin') as string | null;
  const discoverySource = (formData.get('discovery_source') as string) || 'manual';

  const { data: opportunity, error } = await supabase
    .from('partnership_opportunities')
    .insert({
      organization_id: organizationId,
      company_name: companyName,
      company_website: companyWebsite,
      company_description: companyDescription,
      company_industry: companyIndustry,
      company_size: companySize,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_linkedin: contactLinkedin,
      discovery_source: discoverySource,
      status: 'discovered',
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/partnerships');
  return opportunity;
}

export async function updatePartnershipOpportunity(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const companyName = formData.get('company_name');
  if (companyName) updates.company_name = companyName;

  const companyWebsite = formData.get('company_website');
  if (companyWebsite !== null) updates.company_website = companyWebsite;

  const companyDescription = formData.get('company_description');
  if (companyDescription !== null) updates.company_description = companyDescription;

  const companyIndustry = formData.get('company_industry');
  if (companyIndustry !== null) updates.company_industry = companyIndustry;

  const companySize = formData.get('company_size');
  if (companySize !== null) updates.company_size = companySize;

  const contactName = formData.get('contact_name');
  if (contactName !== null) updates.contact_name = contactName;

  const contactEmail = formData.get('contact_email');
  if (contactEmail !== null) updates.contact_email = contactEmail;

  const contactLinkedin = formData.get('contact_linkedin');
  if (contactLinkedin !== null) updates.contact_linkedin = contactLinkedin;

  const status = formData.get('status');
  if (status) updates.status = status;

  const opportunityScore = formData.get('opportunity_score');
  if (opportunityScore) updates.opportunity_score = parseInt(opportunityScore as string);

  const aiAnalysis = formData.get('ai_analysis');
  if (aiAnalysis) updates.ai_analysis = JSON.parse(aiAnalysis as string);

  const { data: opportunity, error } = await supabase
    .from('partnership_opportunities')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/partnerships');
  revalidatePath(`/dashboard/growth/partnerships/${id}`);
  return opportunity;
}

export async function updateOpportunityStatus(
  id: string,
  status: 'discovered' | 'researching' | 'qualified' | 'outreach_draft' | 'outreach_sent' | 'in_conversation' | 'negotiating' | 'active' | 'declined' | 'rejected'
) {
  const supabase = await createClient();

  const { data: opportunity, error } = await supabase
    .from('partnership_opportunities')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/partnerships');
  return opportunity;
}

export async function saveAIAnalysis(id: string, analysis: {
  partnershipPotential: number;
  customerOverlapScore: number;
  complementaryScore: number;
  reachScore: number;
  reasoning: string;
  suggestedPartnershipTypes: string[];
  valueExchangeIdeas: Array<{ weProvide: string; theyProvide: string; mutualBenefit: string }>;
  potentialRisks: string[];
  recommendedApproach: string;
  priorityLevel: string;
}) {
  const supabase = await createClient();

  // Calculate overall opportunity score
  const opportunityScore = Math.round(
    analysis.partnershipPotential * 0.3 +
    analysis.customerOverlapScore * 0.25 +
    analysis.complementaryScore * 0.25 +
    analysis.reachScore * 0.2
  );

  const { data: opportunity, error } = await supabase
    .from('partnership_opportunities')
    .update({
      ai_analysis: analysis,
      opportunity_score: opportunityScore,
      status: 'researching',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/partnerships');
  revalidatePath(`/dashboard/growth/partnerships/${id}`);
  return opportunity;
}

export async function deletePartnershipOpportunity(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('partnership_opportunities')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/partnerships');
}

// ============================================
// PARTNERSHIP OUTREACH
// ============================================

export async function getOutreachMessages(opportunityId: string) {
  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from('partnership_outreach')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('sequence_number', { ascending: true });

  if (error) throw error;
  return messages;
}

export async function createOutreachMessage(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const opportunityId = formData.get('opportunity_id') as string;
  const channel = formData.get('channel') as string;
  const subject = formData.get('subject') as string | null;
  const body = formData.get('body') as string;
  const aiGenerated = formData.get('ai_generated') === 'true';

  // Get the next sequence number
  const { data: existingMessages } = await supabase
    .from('partnership_outreach')
    .select('sequence_number')
    .eq('opportunity_id', opportunityId)
    .order('sequence_number', { ascending: false })
    .limit(1);

  const sequenceNumber = existingMessages && existingMessages.length > 0
    ? existingMessages[0].sequence_number + 1
    : 1;

  const { data: message, error } = await supabase
    .from('partnership_outreach')
    .insert({
      opportunity_id: opportunityId,
      sequence_number: sequenceNumber,
      channel,
      subject,
      body,
      ai_generated: aiGenerated,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;

  // Update opportunity status if first outreach
  if (sequenceNumber === 1) {
    await supabase
      .from('partnership_opportunities')
      .update({ status: 'outreach_draft' })
      .eq('id', opportunityId);
  }

  revalidatePath(`/dashboard/growth/partnerships/${opportunityId}`);
  return message;
}

export async function updateOutreachMessage(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const subject = formData.get('subject');
  if (subject !== null) updates.subject = subject;

  const body = formData.get('body');
  if (body) updates.body = body;

  const { data: message, error } = await supabase
    .from('partnership_outreach')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/partnerships');
  return message;
}

export async function markOutreachSent(id: string) {
  const supabase = await createClient();

  const { data: message, error } = await supabase
    .from('partnership_outreach')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, opportunity_id')
    .single();

  if (error) throw error;

  // Update opportunity status
  await supabase
    .from('partnership_opportunities')
    .update({ status: 'outreach_sent' })
    .eq('id', message.opportunity_id);

  revalidatePath('/dashboard/growth/partnerships');
  return message;
}

export async function markOutreachOpened(id: string) {
  const supabase = await createClient();

  const { data: message, error } = await supabase
    .from('partnership_outreach')
    .update({ status: 'opened' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return message;
}

export async function markOutreachReplied(id: string) {
  const supabase = await createClient();

  const { data: message, error } = await supabase
    .from('partnership_outreach')
    .update({
      status: 'replied',
      replied_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, opportunity_id')
    .single();

  if (error) throw error;

  // Update opportunity status
  await supabase
    .from('partnership_opportunities')
    .update({ status: 'in_conversation' })
    .eq('id', message.opportunity_id);

  revalidatePath('/dashboard/growth/partnerships');
  return message;
}

// ============================================
// ACTIVE PARTNERSHIPS
// ============================================

export async function getPartnerships(filters?: {
  partnershipType?: string;
  active?: boolean;
  limit?: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  let query = supabase
    .from('partnerships')
    .select(`
      *,
      partnership_opportunities (id, company_name, company_website),
      partnership_activities (
        id,
        activity_type,
        description,
        created_at
      ),
      partnership_referrals (
        id,
        lead_email,
        status,
        revenue_cents,
        created_at
      )
    `)
    .order('created_at', { ascending: false });

  if (filters?.partnershipType) {
    query = query.eq('partnership_type', filters.partnershipType);
  }
  if (filters?.active !== undefined) {
    query = query.eq('active', filters.active);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data: partnerships, error } = await query;

  if (error) throw error;
  return partnerships;
}

export async function getPartnership(id: string) {
  const supabase = await createClient();

  const { data: partnership, error } = await supabase
    .from('partnerships')
    .select(`
      *,
      partnership_opportunities (
        id,
        company_name,
        company_website,
        company_description,
        contact_name,
        contact_email,
        ai_analysis
      ),
      partnership_activities (
        id,
        activity_type,
        description,
        metadata,
        created_at
      ),
      partnership_referrals (
        id,
        lead_email,
        lead_name,
        status,
        revenue_cents,
        commission_cents,
        created_at
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return partnership;
}

export async function createPartnership(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const organizationId = formData.get('organization_id') as string;
  const opportunityId = formData.get('opportunity_id') as string | null;
  const partnerName = formData.get('partner_name') as string;
  const partnerWebsite = formData.get('partner_website') as string | null;
  const partnerContactEmail = formData.get('partner_contact_email') as string | null;
  const partnershipType = formData.get('partnership_type') as string;
  const commissionType = formData.get('commission_type') as string | null;
  const commissionRate = formData.get('commission_rate') ? parseInt(formData.get('commission_rate') as string) : null;
  const agreementUrl = formData.get('agreement_url') as string | null;
  const notes = formData.get('notes') as string | null;

  const { data: partnership, error } = await supabase
    .from('partnerships')
    .insert({
      organization_id: organizationId,
      opportunity_id: opportunityId || null,
      partner_name: partnerName,
      partner_website: partnerWebsite,
      partner_contact_email: partnerContactEmail,
      partnership_type: partnershipType,
      commission_type: commissionType,
      commission_rate: commissionRate,
      agreement_url: agreementUrl,
      notes,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  // Update opportunity status if linked
  if (opportunityId) {
    await supabase
      .from('partnership_opportunities')
      .update({ status: 'active' })
      .eq('id', opportunityId);
  }

  revalidatePath('/dashboard/growth/partnerships');
  return partnership;
}

export async function updatePartnership(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const partnerName = formData.get('partner_name');
  if (partnerName) updates.partner_name = partnerName;

  const partnerWebsite = formData.get('partner_website');
  if (partnerWebsite !== null) updates.partner_website = partnerWebsite;

  const partnerContactEmail = formData.get('partner_contact_email');
  if (partnerContactEmail !== null) updates.partner_contact_email = partnerContactEmail;

  const partnershipType = formData.get('partnership_type');
  if (partnershipType) updates.partnership_type = partnershipType;

  const commissionType = formData.get('commission_type');
  if (commissionType !== null) updates.commission_type = commissionType;

  const commissionRate = formData.get('commission_rate');
  if (commissionRate !== null) {
    updates.commission_rate = commissionRate ? parseInt(commissionRate as string) : null;
  }

  const agreementUrl = formData.get('agreement_url');
  if (agreementUrl !== null) updates.agreement_url = agreementUrl;

  const notes = formData.get('notes');
  if (notes !== null) updates.notes = notes;

  const active = formData.get('active');
  if (active !== null) updates.active = active === 'true';

  const { data: partnership, error } = await supabase
    .from('partnerships')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/partnerships');
  revalidatePath(`/dashboard/growth/partnerships/active/${id}`);
  return partnership;
}

// ============================================
// PARTNERSHIP ACTIVITIES
// ============================================

export async function logPartnershipActivity(
  partnershipId: string,
  activityType: 'meeting' | 'email' | 'call' | 'campaign' | 'review' | 'other',
  description: string,
  metadata?: Record<string, unknown>
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: activity, error } = await supabase
    .from('partnership_activities')
    .insert({
      partnership_id: partnershipId,
      activity_type: activityType,
      description,
      metadata: metadata || {},
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath(`/dashboard/growth/partnerships/active/${partnershipId}`);
  return activity;
}

// ============================================
// PARTNERSHIP REFERRALS
// ============================================

export async function recordPartnershipReferral(formData: FormData) {
  const supabase = await createClient();

  const partnershipId = formData.get('partnership_id') as string;
  const leadEmail = formData.get('lead_email') as string;
  const leadName = formData.get('lead_name') as string | null;
  const leadCompany = formData.get('lead_company') as string | null;
  const source = formData.get('source') as string | null;

  const { data: referral, error } = await supabase
    .from('partnership_referrals')
    .insert({
      partnership_id: partnershipId,
      lead_email: leadEmail.toLowerCase(),
      lead_name: leadName,
      lead_company: leadCompany,
      source,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  // Update partnership totals
  await supabase.rpc('increment_partnership_referrals', { partnership_id: partnershipId });

  revalidatePath('/dashboard/growth/partnerships');
  return referral;
}

export async function updatePartnershipReferralStatus(
  id: string,
  status: 'pending' | 'qualified' | 'converted' | 'lost',
  revenueCents?: number
) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = { status };

  if (status === 'qualified') {
    updates.qualified_at = new Date().toISOString();
  } else if (status === 'converted') {
    updates.converted_at = new Date().toISOString();
    if (revenueCents) {
      updates.revenue_cents = revenueCents;
    }
  }

  const { data: referral, error } = await supabase
    .from('partnership_referrals')
    .update(updates)
    .eq('id', id)
    .select('*, partnership_id')
    .single();

  if (error) throw error;

  // Update partnership revenue if converted
  if (status === 'converted' && revenueCents) {
    await supabase.rpc('add_partnership_revenue', {
      partnership_id: referral.partnership_id,
      revenue: revenueCents,
    });
  }

  revalidatePath('/dashboard/growth/partnerships');
  return referral;
}

// ============================================
// DISCOVERY SCANS
// ============================================

export async function createDiscoveryScan(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const organizationId = formData.get('organization_id') as string;
  const productId = formData.get('product_id') as string | null;
  const scanType = (formData.get('scan_type') as string) || 'ai_discovery';
  const parameters = formData.get('parameters')
    ? JSON.parse(formData.get('parameters') as string)
    : {};

  const { data: scan, error } = await supabase
    .from('partnership_discovery_scans')
    .insert({
      organization_id: organizationId,
      product_id: productId || null,
      scan_type: scanType,
      parameters,
      status: 'pending',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/partnerships/discover');
  return scan;
}

export async function completeDiscoveryScan(
  scanId: string,
  results: {
    companiesFound: number;
    opportunitiesCreated: number;
    suggestions?: Array<{
      name: string;
      website: string;
      reason: string;
      partnershipType: string;
      estimatedPotential: number;
    }>;
  }
) {
  const supabase = await createClient();

  const { data: scan, error } = await supabase
    .from('partnership_discovery_scans')
    .update({
      status: 'completed',
      results,
      completed_at: new Date().toISOString(),
    })
    .eq('id', scanId)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/partnerships/discover');
  return scan;
}

// ============================================
// ANALYTICS
// ============================================

export async function getPartnershipAnalytics(dateRange?: { start: Date; end: Date }) {
  const supabase = await createClient();

  let query = supabase
    .from('partnership_metrics')
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

export async function getPartnershipSummary() {
  const supabase = await createClient();

  // Get opportunity counts by status
  const { data: opportunities, error: oppError } = await supabase
    .from('partnership_opportunities')
    .select('status');

  if (oppError) throw oppError;

  const statusCounts: Record<string, number> = {};
  opportunities?.forEach(o => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });

  // Get active partnerships count
  const { count: activePartnerships, error: activeError } = await supabase
    .from('partnerships')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  if (activeError) throw activeError;

  // Get total revenue from partnerships
  const { data: partnerships, error: revenueError } = await supabase
    .from('partnerships')
    .select('total_revenue_cents, total_referrals');

  if (revenueError) throw revenueError;

  const totalRevenue = partnerships?.reduce((sum, p) => sum + (p.total_revenue_cents || 0), 0) || 0;
  const totalReferrals = partnerships?.reduce((sum, p) => sum + (p.total_referrals || 0), 0) || 0;

  // Get recent outreach response rate
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: outreach, error: outreachError } = await supabase
    .from('partnership_outreach')
    .select('status')
    .gte('sent_at', thirtyDaysAgo.toISOString());

  if (outreachError) throw outreachError;

  const sentCount = outreach?.length || 0;
  const repliedCount = outreach?.filter(o => o.status === 'replied').length || 0;
  const responseRate = sentCount > 0 ? (repliedCount / sentCount) * 100 : 0;

  return {
    statusCounts,
    totalOpportunities: opportunities?.length || 0,
    activePartnerships: activePartnerships || 0,
    totalRevenue,
    totalReferrals,
    outreachResponseRate: Math.round(responseRate * 10) / 10,
  };
}
