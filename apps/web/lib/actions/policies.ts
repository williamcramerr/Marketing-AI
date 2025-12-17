'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { PolicyType, PolicyRule, PolicySeverity } from '@/lib/policies/types';

export type PolicyFormData = {
  name: string;
  description?: string;
  type: PolicyType;
  severity: PolicySeverity;
  rule: PolicyRule;
  productId?: string;
  active?: boolean;
};

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function getOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  return membership?.organization_id || null;
}

export async function getPolicies(): Promise<ActionResult<Array<{
  id: string;
  name: string;
  description: string | null;
  type: string;
  severity: string;
  rule: unknown;
  product_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  product?: { name: string } | null;
}>>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const { data, error } = await supabase
      .from('policies')
      .select('*, product:products(name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching policies:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error in getPolicies:', error);
    return { success: false, error: error.message };
  }
}

export async function getPolicy(policyId: string): Promise<ActionResult<{
  id: string;
  name: string;
  description: string | null;
  type: string;
  severity: string;
  rule: unknown;
  product_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .eq('id', policyId)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      console.error('Error fetching policy:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error in getPolicy:', error);
    return { success: false, error: error.message };
  }
}

export async function createPolicy(formData: PolicyFormData): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const { data, error } = await supabase
      .from('policies')
      .insert({
        organization_id: organizationId,
        name: formData.name,
        description: formData.description || null,
        type: formData.type,
        severity: formData.severity,
        rule: formData.rule as unknown as Record<string, unknown>,
        product_id: formData.productId || null,
        active: formData.active ?? true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating policy:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/policies');
    return { success: true, data: { id: data.id } };
  } catch (error: any) {
    console.error('Error in createPolicy:', error);
    return { success: false, error: error.message };
  }
}

export async function updatePolicy(
  policyId: string,
  formData: Partial<PolicyFormData>
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (formData.name !== undefined) updateData.name = formData.name;
    if (formData.description !== undefined) updateData.description = formData.description;
    if (formData.type !== undefined) updateData.type = formData.type;
    if (formData.severity !== undefined) updateData.severity = formData.severity;
    if (formData.rule !== undefined) updateData.rule = formData.rule;
    if (formData.productId !== undefined) updateData.product_id = formData.productId;
    if (formData.active !== undefined) updateData.active = formData.active;

    const { error } = await supabase
      .from('policies')
      .update(updateData)
      .eq('id', policyId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error updating policy:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/policies');
    revalidatePath(`/dashboard/policies/${policyId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error in updatePolicy:', error);
    return { success: false, error: error.message };
  }
}

export async function deletePolicy(policyId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const { error } = await supabase
      .from('policies')
      .delete()
      .eq('id', policyId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting policy:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/policies');
    return { success: true };
  } catch (error: any) {
    console.error('Error in deletePolicy:', error);
    return { success: false, error: error.message };
  }
}

export async function togglePolicyActive(policyId: string, active: boolean): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const { error } = await supabase
      .from('policies')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', policyId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error toggling policy:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/policies');
    return { success: true };
  } catch (error: any) {
    console.error('Error in togglePolicyActive:', error);
    return { success: false, error: error.message };
  }
}

// Note: getPolicyTypeDisplayName and getSeverityDisplayInfo moved to @/lib/utils/policy-utils.ts
