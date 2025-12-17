'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export async function getCampaigns() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id);

  const orgIds = memberships?.map((m) => m.organization_id) || [];

  // Get campaigns for user's products
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(
      `
      *,
      products (
        id,
        name,
        organization_id
      ),
      audiences (
        id,
        name
      )
    `
    )
    .in('products.organization_id', orgIds)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return campaigns;
}

export async function getCampaign(id: string) {
  const supabase = await createClient();

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select(
      `
      *,
      products (
        id,
        name,
        organization_id
      ),
      audiences (
        id,
        name
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return campaign;
}

export async function getCampaignTasks(campaignId: string) {
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return tasks;
}

export async function createCampaign(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const productId = formData.get('product_id') as string;
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const goal = formData.get('goal') as string;
  const goalMetric = formData.get('goal_metric') as string;
  const goalTarget = formData.get('goal_target') as string;
  const audienceId = formData.get('audience_id') as string;
  const channelsRaw = formData.get('channels') as string;
  const startDate = formData.get('start_date') as string;
  const endDate = formData.get('end_date') as string;
  const budgetCents = formData.get('budget_cents') as string;

  const channels = channelsRaw ? channelsRaw.split(',').map((c) => c.trim()) : [];

  const campaignData: TablesInsert<'campaigns'> = {
    product_id: productId,
    name,
    description: description || null,
    goal,
    goal_metric: goalMetric || null,
    goal_target: goalTarget ? parseInt(goalTarget) : null,
    status: 'draft',
    audience_id: audienceId || null,
    channels,
    start_date: startDate || null,
    end_date: endDate || null,
    budget_cents: budgetCents ? parseInt(budgetCents) : null,
  };

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert(campaignData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/campaigns');
  redirect(`/dashboard/campaigns/${campaign.id}`);
}

export async function updateCampaign(id: string, formData: FormData) {
  const supabase = await createClient();

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const goal = formData.get('goal') as string;
  const goalMetric = formData.get('goal_metric') as string;
  const goalTarget = formData.get('goal_target') as string;
  const audienceId = formData.get('audience_id') as string;
  const channelsRaw = formData.get('channels') as string;
  const startDate = formData.get('start_date') as string;
  const endDate = formData.get('end_date') as string;
  const budgetCents = formData.get('budget_cents') as string;

  const channels = channelsRaw ? channelsRaw.split(',').map((c) => c.trim()) : [];

  const campaignData: TablesUpdate<'campaigns'> = {
    name,
    description: description || null,
    goal,
    goal_metric: goalMetric || null,
    goal_target: goalTarget ? parseInt(goalTarget) : null,
    audience_id: audienceId || null,
    channels,
    start_date: startDate || null,
    end_date: endDate || null,
    budget_cents: budgetCents ? parseInt(budgetCents) : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('campaigns').update(campaignData).eq('id', id);

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/campaigns');
  revalidatePath(`/dashboard/campaigns/${id}`);
}

export async function updateCampaignStatus(id: string, status: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('campaigns')
    .update({
      status: status as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/campaigns');
  revalidatePath(`/dashboard/campaigns/${id}`);
}

export async function deleteCampaign(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from('campaigns').delete().eq('id', id);

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/campaigns');
  redirect('/dashboard/campaigns');
}

export async function getProducts() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id);

  const orgIds = memberships?.map((m) => m.organization_id) || [];

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, organization_id')
    .in('organization_id', orgIds)
    .eq('active', true)
    .order('name');

  if (error) {
    throw error;
  }

  return products;
}

export async function getAudiences(productId?: string) {
  const supabase = await createClient();

  let query = supabase.from('audiences').select('id, name, product_id').order('name');

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data: audiences, error } = await query;

  if (error) {
    throw error;
  }

  return audiences;
}
