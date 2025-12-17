'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  weight: number; // Percentage weight (0-100)
  config?: Record<string, any>;
}

export interface ExperimentResults {
  variants: {
    [variantId: string]: {
      impressions: number;
      conversions: number;
      conversionRate: number;
      confidence?: number;
    };
  };
  statisticalSignificance?: boolean;
  recommendedWinner?: string;
  analysisNotes?: string;
}

export interface Experiment {
  id: string;
  campaign_id: string;
  name: string;
  hypothesis: string | null;
  variants: ExperimentVariant[];
  metric_name: string;
  min_sample_size: number;
  confidence_level: number;
  status: ExperimentStatus;
  started_at: string | null;
  ended_at: string | null;
  results: ExperimentResults | null;
  winner_variant: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  campaign?: { id: string; name: string };
}

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function getOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  return membership?.organization_id || null;
}

/**
 * List all experiments for the organization
 */
export async function listExperiments(filters?: {
  campaignId?: string;
  status?: ExperimentStatus;
}): Promise<ActionResult<Experiment[]>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    // Get campaigns for this organization
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId);

    const productIds = products?.map((p) => p.id) || [];

    if (productIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .in('product_id', productIds);

    const campaignIds = campaigns?.map((c) => c.id) || [];

    if (campaignIds.length === 0) {
      return { success: true, data: [] };
    }

    let query = supabase
      .from('experiments')
      .select(
        `
        *,
        campaign:campaigns(id, name)
      `
      )
      .in('campaign_id', campaignIds)
      .order('created_at', { ascending: false });

    if (filters?.campaignId) {
      query = query.eq('campaign_id', filters.campaignId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Experiment[] };
  } catch (error: any) {
    console.error('Error listing experiments:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a single experiment by ID
 */
export async function getExperiment(id: string): Promise<ActionResult<Experiment>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const { data, error } = await supabase
      .from('experiments')
      .select(
        `
        *,
        campaign:campaigns(id, name)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Verify ownership through campaign -> product -> organization chain
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('product:products(organization_id)')
      .eq('id', data.campaign_id)
      .single();

    const orgId = (campaign?.product as any)?.organization_id;
    if (orgId !== organizationId) {
      return { success: false, error: 'Experiment not found' };
    }

    return { success: true, data: data as Experiment };
  } catch (error: any) {
    console.error('Error getting experiment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new experiment
 */
export async function createExperiment(input: {
  campaign_id: string;
  name: string;
  hypothesis?: string;
  variants: ExperimentVariant[];
  metric_name: string;
  min_sample_size?: number;
  confidence_level?: number;
}): Promise<ActionResult<Experiment>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('product:products(organization_id)')
      .eq('id', input.campaign_id)
      .single();

    const orgId = (campaign?.product as any)?.organization_id;
    if (orgId !== organizationId) {
      return { success: false, error: 'Campaign not found' };
    }

    const { data, error } = await supabase
      .from('experiments')
      .insert({
        campaign_id: input.campaign_id,
        name: input.name,
        hypothesis: input.hypothesis || null,
        variants: input.variants,
        metric_name: input.metric_name,
        min_sample_size: input.min_sample_size || 100,
        confidence_level: input.confidence_level || 0.95,
        status: 'draft',
      })
      .select(
        `
        *,
        campaign:campaigns(id, name)
      `
      )
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/experiments');
    return { success: true, data: data as Experiment };
  } catch (error: any) {
    console.error('Error creating experiment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an experiment
 */
export async function updateExperiment(
  id: string,
  input: {
    name?: string;
    hypothesis?: string;
    variants?: ExperimentVariant[];
    metric_name?: string;
    min_sample_size?: number;
    confidence_level?: number;
  }
): Promise<ActionResult<Experiment>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    // Verify ownership
    const current = await getExperiment(id);
    if (!current.success || !current.data) {
      return { success: false, error: 'Experiment not found' };
    }

    // Don't allow editing running experiments
    if (current.data.status === 'running') {
      return { success: false, error: 'Cannot edit a running experiment' };
    }

    const { data, error } = await supabase
      .from('experiments')
      .update({
        name: input.name,
        hypothesis: input.hypothesis,
        variants: input.variants,
        metric_name: input.metric_name,
        min_sample_size: input.min_sample_size,
        confidence_level: input.confidence_level,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        *,
        campaign:campaigns(id, name)
      `
      )
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/experiments');
    revalidatePath(`/dashboard/experiments/${id}`);
    return { success: true, data: data as Experiment };
  } catch (error: any) {
    console.error('Error updating experiment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start an experiment
 */
export async function startExperiment(id: string): Promise<ActionResult<Experiment>> {
  try {
    const supabase = await createClient();

    // Verify ownership
    const current = await getExperiment(id);
    if (!current.success || !current.data) {
      return { success: false, error: 'Experiment not found' };
    }

    if (current.data.status !== 'draft' && current.data.status !== 'paused') {
      return { success: false, error: 'Experiment cannot be started' };
    }

    const { data, error } = await supabase
      .from('experiments')
      .update({
        status: 'running',
        started_at: current.data.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        *,
        campaign:campaigns(id, name)
      `
      )
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/experiments');
    revalidatePath(`/dashboard/experiments/${id}`);
    return { success: true, data: data as Experiment };
  } catch (error: any) {
    console.error('Error starting experiment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Pause an experiment
 */
export async function pauseExperiment(id: string): Promise<ActionResult<Experiment>> {
  try {
    const supabase = await createClient();

    // Verify ownership
    const current = await getExperiment(id);
    if (!current.success || !current.data) {
      return { success: false, error: 'Experiment not found' };
    }

    if (current.data.status !== 'running') {
      return { success: false, error: 'Experiment is not running' };
    }

    const { data, error } = await supabase
      .from('experiments')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        *,
        campaign:campaigns(id, name)
      `
      )
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/experiments');
    revalidatePath(`/dashboard/experiments/${id}`);
    return { success: true, data: data as Experiment };
  } catch (error: any) {
    console.error('Error pausing experiment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete an experiment and declare a winner
 */
export async function completeExperiment(
  id: string,
  winnerVariantId: string
): Promise<ActionResult<Experiment>> {
  try {
    const supabase = await createClient();

    // Verify ownership
    const current = await getExperiment(id);
    if (!current.success || !current.data) {
      return { success: false, error: 'Experiment not found' };
    }

    if (current.data.status !== 'running' && current.data.status !== 'paused') {
      return { success: false, error: 'Experiment cannot be completed' };
    }

    const { data, error } = await supabase
      .from('experiments')
      .update({
        status: 'completed',
        winner_variant: winnerVariantId,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        *,
        campaign:campaigns(id, name)
      `
      )
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/experiments');
    revalidatePath(`/dashboard/experiments/${id}`);
    return { success: true, data: data as Experiment };
  } catch (error: any) {
    console.error('Error completing experiment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an experiment
 */
export async function deleteExperiment(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Verify ownership
    const current = await getExperiment(id);
    if (!current.success || !current.data) {
      return { success: false, error: 'Experiment not found' };
    }

    // Delete assignments first
    await supabase.from('experiment_assignments').delete().eq('experiment_id', id);

    // Delete experiment
    const { error } = await supabase.from('experiments').delete().eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/experiments');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting experiment:', error);
    return { success: false, error: error.message };
  }
}

// Note: getStatusInfo moved to @/lib/utils/experiment-utils.ts
