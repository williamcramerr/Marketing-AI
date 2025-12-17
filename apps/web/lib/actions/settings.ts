'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Get organization settings
 */
export async function getOrganizationSettings() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations(id, name, slug, settings)')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership?.organizations) {
      return { success: false, error: 'No organization found' };
    }

    return {
      success: true,
      data: {
        organization: membership.organizations,
        role: membership.role,
      },
    };
  } catch (error) {
    console.error('Error getting organization settings:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update organization settings
 */
export async function updateOrganizationSettings(settings: Record<string, any>) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only allow admins or owners to update settings
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get current settings
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', membership.organization_id)
      .single();

    const currentSettings = (org?.settings as Record<string, any>) || {};
    const newSettings = { ...currentSettings, ...settings };

    const { error } = await supabase
      .from('organizations')
      .update({
        settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.organization_id);

    if (error) {
      console.error('Error updating organization settings:', error);
      return { success: false, error: 'Failed to update settings' };
    }

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error) {
    console.error('Error updating organization settings:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Toggle sandbox mode
 */
export async function toggleSandboxMode(enabled: boolean) {
  return updateOrganizationSettings({ sandbox_mode: enabled });
}

/**
 * Pause all campaigns for the organization
 */
export async function pauseAllCampaigns() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only allow admins or owners
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get all products for the organization
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', membership.organization_id);

    const productIds = products?.map((p) => p.id) || [];

    if (productIds.length === 0) {
      return { success: true, message: 'No campaigns to pause' };
    }

    // Update all active campaigns to paused
    const { error, count } = await supabase
      .from('campaigns')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .in('product_id', productIds)
      .eq('status', 'active');

    if (error) {
      console.error('Error pausing campaigns:', error);
      return { success: false, error: 'Failed to pause campaigns' };
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      action: 'emergency.pause_all_campaigns',
      resource_type: 'campaigns',
      details: { paused_count: count || 0 },
    });

    revalidatePath('/dashboard/campaigns');
    revalidatePath('/dashboard/settings');
    return { success: true, message: `Paused ${count || 0} campaigns` };
  } catch (error) {
    console.error('Error pausing all campaigns:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Cancel all pending tasks for the organization
 */
export async function cancelAllPendingTasks() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only allow admins or owners
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get all products for the organization
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', membership.organization_id);

    const productIds = products?.map((p) => p.id) || [];

    if (productIds.length === 0) {
      return { success: true, message: 'No tasks to cancel' };
    }

    // Get campaigns for these products
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .in('product_id', productIds);

    const campaignIds = campaigns?.map((c) => c.id) || [];

    if (campaignIds.length === 0) {
      return { success: true, message: 'No tasks to cancel' };
    }

    // Cancel all queued, executing, or pending_approval tasks
    const { error, count } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .in('campaign_id', campaignIds)
      .in('status', ['queued', 'executing', 'pending_approval', 'drafted']);

    if (error) {
      console.error('Error cancelling tasks:', error);
      return { success: false, error: 'Failed to cancel tasks' };
    }

    // Also expire any pending approvals
    await supabase
      .from('approvals')
      .update({
        status: 'expired',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: 'Cancelled via emergency controls',
      })
      .eq('status', 'pending');

    // Log the action
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      action: 'emergency.cancel_all_tasks',
      resource_type: 'tasks',
      details: { cancelled_count: count || 0 },
    });

    revalidatePath('/dashboard/tasks');
    revalidatePath('/dashboard/approvals');
    revalidatePath('/dashboard/settings');
    return { success: true, message: `Cancelled ${count || 0} tasks` };
  } catch (error) {
    console.error('Error cancelling all tasks:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Enable global sandbox mode
 */
export async function enableGlobalSandbox() {
  try {
    const result = await updateOrganizationSettings({ sandbox_mode: true });

    if (!result.success) {
      return result;
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user!.id)
      .limit(1)
      .single();

    // Log the action
    await supabase.from('audit_logs').insert({
      organization_id: membership!.organization_id,
      user_id: user!.id,
      action: 'emergency.enable_sandbox',
      resource_type: 'organizations',
      details: { sandbox_mode: true },
    });

    return { success: true, message: 'Sandbox mode enabled' };
  } catch (error) {
    console.error('Error enabling global sandbox:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Require approval for all actions
 */
export async function requireAllApprovals() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only allow admins or owners
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Update all connectors to require approval
    const { error: connectorError, count } = await supabase
      .from('connectors')
      .update({
        approval_required: true,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', membership.organization_id)
      .eq('approval_required', false);

    if (connectorError) {
      console.error('Error updating connectors:', connectorError);
      return { success: false, error: 'Failed to update connectors' };
    }

    // Also update organization settings
    await updateOrganizationSettings({ require_all_approvals: true });

    // Log the action
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      action: 'emergency.require_all_approvals',
      resource_type: 'connectors',
      details: { updated_count: count || 0 },
    });

    revalidatePath('/dashboard/connectors');
    revalidatePath('/dashboard/settings');
    return { success: true, message: `Updated ${count || 0} connectors to require approval` };
  } catch (error) {
    console.error('Error requiring all approvals:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get organization members
 */
export async function getOrganizationMembers() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
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

    const { data: members, error } = await supabase
      .from('organization_members')
      .select('id, role, user_id, created_at')
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error getting members:', error);
      return { success: false, error: 'Failed to get members' };
    }

    return { success: true, data: members };
  } catch (error) {
    console.error('Error getting organization members:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Invite a member to the organization
 */
export async function inviteMember(email: string, role: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only allow admins or owners to invite
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Check if role is valid
    const validRoles = ['member', 'admin', 'owner'];
    if (!validRoles.includes(role)) {
      return { success: false, error: 'Invalid role' };
    }

    // For now, we'll create an invitation record
    // In a real app, you'd send an email invitation
    const { error } = await supabase.from('organization_invitations').insert({
      organization_id: membership.organization_id,
      email,
      role,
      invited_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Invitation already sent to this email' };
      }
      console.error('Error creating invitation:', error);
      return { success: false, error: 'Failed to create invitation' };
    }

    revalidatePath('/dashboard/settings');
    return { success: true, message: 'Invitation sent' };
  } catch (error) {
    console.error('Error inviting member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Remove a member from the organization
 */
export async function removeMember(memberId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only allow admins or owners to remove members
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get the member to be removed
    const { data: memberToRemove } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('organization_id', membership.organization_id)
      .single();

    if (!memberToRemove) {
      return { success: false, error: 'Member not found' };
    }

    // Can't remove yourself
    if (memberToRemove.user_id === user.id) {
      return { success: false, error: "Can't remove yourself" };
    }

    // Can't remove an owner unless you're an owner
    if (memberToRemove.role === 'owner' && membership.role !== 'owner') {
      return { success: false, error: 'Only owners can remove other owners' };
    }

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', membership.organization_id);

    if (error) {
      console.error('Error removing member:', error);
      return { success: false, error: 'Failed to remove member' };
    }

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error) {
    console.error('Error removing member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
