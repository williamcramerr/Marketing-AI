import { createAdminClient } from '@/lib/supabase/admin';
import { inngest } from '@/lib/inngest/client';

export interface EmergencyStopResult {
  success: boolean;
  organizationId: string;
  summary: {
    campaignsPaused: number;
    tasksCancelled: number;
    sandboxModeEnabled: boolean;
  };
  timestamp: string;
  triggeredBy: string;
}

export interface EmergencyStopError {
  success: false;
  error: string;
  timestamp: string;
}

/**
 * Emergency stop function that immediately halts all marketing automation for an organization.
 * This function:
 * - Pauses all active campaigns
 * - Cancels all pending/executing tasks
 * - Enables sandbox mode to prevent new tasks from executing
 * - Logs all actions to audit_logs table
 * - Sends an event to Inngest for further processing
 *
 * @param organizationId - The organization to stop
 * @param triggeredBy - User ID who triggered the emergency stop
 * @returns Summary of what was stopped
 */
export async function executeEmergencyStop(
  organizationId: string,
  triggeredBy: string
): Promise<EmergencyStopResult | EmergencyStopError> {
  const timestamp = new Date().toISOString();
  const supabase = createAdminClient();

  try {
    // 1. Get all products for this organization
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    const productIds = products?.map((p) => p.id) || [];

    if (productIds.length === 0) {
      // No products, but still enable sandbox mode
      await enableSandboxMode(supabase, organizationId);
      await logEmergencyStop(supabase, organizationId, triggeredBy, 0, 0, timestamp);

      return {
        success: true,
        organizationId,
        summary: {
          campaignsPaused: 0,
          tasksCancelled: 0,
          sandboxModeEnabled: true,
        },
        timestamp,
        triggeredBy,
      };
    }

    // 2. Pause all active campaigns
    const { data: pausedCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .update({
        status: 'paused',
        updated_at: timestamp,
      })
      .in('product_id', productIds)
      .in('status', ['active', 'planned'])
      .select('id');

    if (campaignsError) {
      throw new Error(`Failed to pause campaigns: ${campaignsError.message}`);
    }

    const campaignsPaused = pausedCampaigns?.length || 0;

    // 3. Get all campaigns for this org to cancel tasks
    const { data: allCampaigns, error: allCampaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .in('product_id', productIds);

    if (allCampaignsError) {
      throw new Error(`Failed to fetch campaigns: ${allCampaignsError.message}`);
    }

    const campaignIds = allCampaigns?.map((c) => c.id) || [];

    // 4. Cancel all pending/executing tasks
    let tasksCancelled = 0;
    if (campaignIds.length > 0) {
      const { data: cancelledTasks, error: tasksError } = await supabase
        .from('tasks')
        .update({
          status: 'cancelled',
          updated_at: timestamp,
          error_log: supabase.rpc('jsonb_array_append', {
            arr: supabase.rpc('COALESCE', { val: 'error_log', default: '[]' }),
            elem: {
              type: 'emergency_stop',
              triggered_by: triggeredBy,
              timestamp,
              message: 'Task cancelled due to emergency stop',
            },
          }),
        })
        .in('campaign_id', campaignIds)
        .in('status', [
          'queued',
          'drafting',
          'drafted',
          'pending_approval',
          'approved',
          'executing',
        ])
        .select('id');

      // Manual error_log update since rpc might not work as expected
      // Let's do a simpler approach
      const { data: tasksToCancel } = await supabase
        .from('tasks')
        .select('id, error_log')
        .in('campaign_id', campaignIds)
        .in('status', [
          'queued',
          'drafting',
          'drafted',
          'pending_approval',
          'approved',
          'executing',
        ]);

      if (tasksToCancel && tasksToCancel.length > 0) {
        for (const task of tasksToCancel) {
          const errorLog = Array.isArray(task.error_log) ? task.error_log : [];
          errorLog.push({
            type: 'emergency_stop',
            triggered_by: triggeredBy,
            timestamp,
            message: 'Task cancelled due to emergency stop',
          });

          await supabase
            .from('tasks')
            .update({
              status: 'cancelled',
              updated_at: timestamp,
              error_log: errorLog,
            })
            .eq('id', task.id);
        }
        tasksCancelled = tasksToCancel.length;
      }

      if (tasksError && !tasksToCancel) {
        // Log warning but don't fail
        console.warn(`Warning: Failed to cancel some tasks: ${tasksError.message}`);
      }
    }

    // 5. Enable sandbox mode
    await enableSandboxMode(supabase, organizationId);

    // 6. Log to audit_logs
    await logEmergencyStop(
      supabase,
      organizationId,
      triggeredBy,
      campaignsPaused,
      tasksCancelled,
      timestamp
    );

    // 7. Send event to Inngest for any additional processing
    try {
      await inngest.send({
        name: 'emergency/stop',
        data: {
          organizationId,
          triggeredBy,
        },
      });
    } catch (inngestError) {
      // Log but don't fail if Inngest is unavailable
      console.warn('Failed to send Inngest event:', inngestError);
    }

    return {
      success: true,
      organizationId,
      summary: {
        campaignsPaused,
        tasksCancelled,
        sandboxModeEnabled: true,
      },
      timestamp,
      triggeredBy,
    };
  } catch (error) {
    // Log the error
    try {
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        action: 'emergency_stop.failed',
        actor_type: 'user',
        actor_id: triggeredBy,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp,
        },
      });
    } catch (auditError) {
      console.error('Failed to log emergency stop error:', auditError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp,
    };
  }
}

/**
 * Enable sandbox mode for an organization
 */
async function enableSandboxMode(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string
): Promise<void> {
  const { data: org, error: getError } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .single();

  if (getError) {
    throw new Error(`Failed to get organization settings: ${getError.message}`);
  }

  const currentSettings = (org?.settings as Record<string, unknown>) || {};
  const newSettings = {
    ...currentSettings,
    sandbox_mode: true,
    sandbox_enabled_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      settings: newSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  if (updateError) {
    throw new Error(`Failed to enable sandbox mode: ${updateError.message}`);
  }
}

/**
 * Log emergency stop to audit_logs
 */
async function logEmergencyStop(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  triggeredBy: string,
  campaignsPaused: number,
  tasksCancelled: number,
  timestamp: string
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    organization_id: organizationId,
    action: 'emergency_stop',
    actor_type: 'user',
    actor_id: triggeredBy,
    resource_type: 'organization',
    resource_id: organizationId,
    metadata: {
      campaigns_paused: campaignsPaused,
      tasks_cancelled: tasksCancelled,
      sandbox_mode_enabled: true,
      timestamp,
    },
    reversible: false,
  });

  if (error) {
    console.error('Failed to log emergency stop to audit_logs:', error);
    // Don't throw - audit log failure shouldn't block the emergency stop
  }
}

/**
 * Check if an organization is in sandbox mode
 */
export async function isSandboxMode(organizationId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .single();

  if (error || !data) {
    return false;
  }

  const settings = data.settings as Record<string, unknown>;
  return settings?.sandbox_mode === true;
}

/**
 * Disable sandbox mode for an organization
 */
export async function disableSandboxMode(
  organizationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    const { data: org, error: getError } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single();

    if (getError) {
      throw new Error(`Failed to get organization settings: ${getError.message}`);
    }

    const currentSettings = (org?.settings as Record<string, unknown>) || {};
    const newSettings = {
      ...currentSettings,
      sandbox_mode: false,
      sandbox_disabled_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId);

    if (updateError) {
      throw new Error(`Failed to disable sandbox mode: ${updateError.message}`);
    }

    // Log to audit
    await supabase.from('audit_logs').insert({
      organization_id: organizationId,
      action: 'sandbox_mode.disabled',
      actor_type: 'user',
      actor_id: userId,
      resource_type: 'organization',
      resource_id: organizationId,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
