'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { vaultService } from '@/lib/vault/service';

export interface ConnectorInput {
  name: string;
  type: string;
  description?: string;
  config?: Record<string, any>;
  credentials?: Record<string, string>; // Sensitive credentials to store in Vault
  approval_required?: boolean;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  active?: boolean;
}

/**
 * List all connectors for the organization
 */
export async function listConnectors() {
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

    const { data: connectors, error } = await supabase
      .from('connectors')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing connectors:', error);
      return { success: false, error: 'Failed to list connectors' };
    }

    return { success: true, data: connectors };
  } catch (error) {
    console.error('Error listing connectors:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get a single connector
 */
export async function getConnector(connectorId: string) {
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

    const { data: connector, error } = await supabase
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .eq('organization_id', membership.organization_id)
      .single();

    if (error) {
      console.error('Error getting connector:', error);
      return { success: false, error: 'Connector not found' };
    }

    return { success: true, data: connector };
  } catch (error) {
    console.error('Error getting connector:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Create a new connector
 */
export async function createConnector(input: ConnectorInput) {
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

    // Only admins or owners can create connectors
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // First create the connector to get its ID
    const { data: connector, error } = await supabase
      .from('connectors')
      .insert({
        organization_id: membership.organization_id,
        name: input.name,
        type: input.type,
        description: input.description || null,
        config: input.config || {},
        credentials: {}, // Don't store plain-text credentials
        credentials_vault_ids: {}, // Will be updated after storing in Vault
        approval_required: input.approval_required ?? false,
        rate_limit_per_hour: input.rate_limit_per_hour || null,
        rate_limit_per_day: input.rate_limit_per_day || null,
        active: input.active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating connector:', error);
      return { success: false, error: 'Failed to create connector' };
    }

    // Store credentials in Vault if provided
    let vaultIds: Record<string, string> = {};
    if (input.credentials && Object.keys(input.credentials).length > 0) {
      try {
        vaultIds = await vaultService.storeConnectorCredentials(
          connector.id,
          input.credentials
        );

        // Update connector with vault IDs
        const adminClient = createAdminClient();
        await adminClient
          .from('connectors')
          .update({ credentials_vault_ids: vaultIds })
          .eq('id', connector.id);
      } catch (vaultError) {
        console.error('Error storing credentials in Vault:', vaultError);
        // Delete the connector if we couldn't store credentials
        await supabase.from('connectors').delete().eq('id', connector.id);
        return { success: false, error: 'Failed to securely store credentials' };
      }
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      action: 'connector.create',
      resource_type: 'connectors',
      resource_id: connector.id,
      details: { name: input.name, type: input.type },
    });

    revalidatePath('/dashboard/connectors');
    revalidatePath('/dashboard/settings');
    return { success: true, data: { ...connector, credentials_vault_ids: vaultIds } };
  } catch (error) {
    console.error('Error creating connector:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update a connector
 */
export async function updateConnector(connectorId: string, input: Partial<ConnectorInput>) {
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

    // Only admins or owners can update connectors
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Verify connector belongs to organization
    const { data: existing } = await supabase
      .from('connectors')
      .select('id')
      .eq('id', connectorId)
      .eq('organization_id', membership.organization_id)
      .single();

    if (!existing) {
      return { success: false, error: 'Connector not found' };
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.config !== undefined) updates.config = input.config;
    if (input.approval_required !== undefined) updates.approval_required = input.approval_required;
    if (input.rate_limit_per_hour !== undefined)
      updates.rate_limit_per_hour = input.rate_limit_per_hour;
    if (input.rate_limit_per_day !== undefined)
      updates.rate_limit_per_day = input.rate_limit_per_day;
    if (input.active !== undefined) updates.active = input.active;

    const { data: connector, error } = await supabase
      .from('connectors')
      .update(updates)
      .eq('id', connectorId)
      .select()
      .single();

    if (error) {
      console.error('Error updating connector:', error);
      return { success: false, error: 'Failed to update connector' };
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      action: 'connector.update',
      resource_type: 'connectors',
      resource_id: connectorId,
      details: updates,
    });

    revalidatePath('/dashboard/connectors');
    revalidatePath(`/dashboard/connectors/${connectorId}`);
    revalidatePath('/dashboard/settings');
    return { success: true, data: connector };
  } catch (error) {
    console.error('Error updating connector:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Toggle connector active status
 */
export async function toggleConnector(connectorId: string, active: boolean) {
  return updateConnector(connectorId, { active });
}

/**
 * Delete a connector
 */
export async function deleteConnector(connectorId: string) {
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

    // Only admins or owners can delete connectors
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Verify connector belongs to organization and get vault IDs
    const { data: existing } = await supabase
      .from('connectors')
      .select('id, name, credentials_vault_ids')
      .eq('id', connectorId)
      .eq('organization_id', membership.organization_id)
      .single();

    if (!existing) {
      return { success: false, error: 'Connector not found' };
    }

    // Delete secrets from Vault first
    const vaultIds = (existing.credentials_vault_ids || {}) as Record<string, string>;
    if (Object.keys(vaultIds).length > 0) {
      try {
        await vaultService.deleteConnectorCredentials(vaultIds);
      } catch (vaultError) {
        console.error('Error deleting credentials from Vault:', vaultError);
        // Continue with connector deletion even if Vault cleanup fails
      }
    }

    const { error } = await supabase.from('connectors').delete().eq('id', connectorId);

    if (error) {
      console.error('Error deleting connector:', error);
      return { success: false, error: 'Failed to delete connector' };
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      action: 'connector.delete',
      resource_type: 'connectors',
      resource_id: connectorId,
      details: { name: existing.name },
    });

    revalidatePath('/dashboard/connectors');
    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error) {
    console.error('Error deleting connector:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Test a connector's configuration
 */
export async function testConnector(connectorId: string) {
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

    const { data: connector, error } = await supabase
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .eq('organization_id', membership.organization_id)
      .single();

    if (error || !connector) {
      return { success: false, error: 'Connector not found' };
    }

    // Perform type-specific validation
    const config = connector.config as Record<string, any>;

    switch (connector.type) {
      case 'email_resend':
        if (!config.api_key) {
          return { success: false, error: 'API key is required for Resend' };
        }
        break;
      case 'social_twitter':
        if (!config.api_key || !config.api_secret) {
          return { success: false, error: 'API credentials are required for Twitter' };
        }
        break;
      case 'social_linkedin':
        if (!config.access_token) {
          return { success: false, error: 'Access token is required for LinkedIn' };
        }
        break;
      case 'cms_ghost':
        if (!config.url || !config.admin_api_key) {
          return { success: false, error: 'URL and Admin API key are required for Ghost' };
        }
        break;
      case 'cms_wordpress':
        if (!config.url || !config.username || !config.password) {
          return { success: false, error: 'URL and credentials are required for WordPress' };
        }
        break;
      case 'ads_google':
        if (!config.customer_id || !config.developer_token) {
          return {
            success: false,
            error: 'Customer ID and developer token are required for Google Ads',
          };
        }
        break;
      case 'ads_facebook':
        if (!config.access_token || !config.ad_account_id) {
          return {
            success: false,
            error: 'Access token and Ad Account ID are required for Meta Ads',
          };
        }
        break;
      default:
        // Allow custom connector types
        break;
    }

    // Update last_used_at to indicate test
    await supabase
      .from('connectors')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', connectorId);

    return { success: true, message: 'Configuration appears valid' };
  } catch (error) {
    console.error('Error testing connector:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get connector with decrypted credentials
 * Use this when you need to make API calls with the connector
 * Only call from server-side code
 */
export async function getConnectorWithCredentials(connectorId: string) {
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

    const { data: connector, error } = await supabase
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .eq('organization_id', membership.organization_id)
      .single();

    if (error || !connector) {
      return { success: false, error: 'Connector not found' };
    }

    // Decrypt credentials from Vault
    const vaultIds = (connector.credentials_vault_ids || {}) as Record<string, string>;
    let decryptedCredentials: Record<string, string> = {};

    if (Object.keys(vaultIds).length > 0) {
      try {
        decryptedCredentials = await vaultService.getConnectorCredentials(vaultIds);
      } catch (vaultError) {
        console.error('Error retrieving credentials from Vault:', vaultError);
        return { success: false, error: 'Failed to retrieve credentials' };
      }
    } else {
      // Fallback to legacy credentials if vault IDs not set
      // This handles connectors that haven't been migrated yet
      decryptedCredentials = (connector.credentials || {}) as Record<string, string>;
    }

    // Return connector with decrypted credentials
    // Note: Do NOT return this to the client - server-side only
    return {
      success: true,
      data: {
        ...connector,
        decryptedCredentials,
      },
    };
  } catch (error) {
    console.error('Error getting connector with credentials:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update connector credentials
 * Handles both adding new credentials and updating existing ones
 */
export async function updateConnectorCredentials(
  connectorId: string,
  credentials: Record<string, string>
) {
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

    // Only admins or owners can update credentials
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get existing connector
    const { data: connector, error: fetchError } = await supabase
      .from('connectors')
      .select('id, credentials_vault_ids')
      .eq('id', connectorId)
      .eq('organization_id', membership.organization_id)
      .single();

    if (fetchError || !connector) {
      return { success: false, error: 'Connector not found' };
    }

    // Update credentials in Vault
    const existingVaultIds = (connector.credentials_vault_ids || {}) as Record<string, string>;

    try {
      const updatedVaultIds = await vaultService.updateConnectorCredentials(
        connectorId,
        credentials,
        existingVaultIds
      );

      // Update connector with new vault IDs
      const adminClient = createAdminClient();
      await adminClient
        .from('connectors')
        .update({
          credentials_vault_ids: updatedVaultIds,
          credentials: {}, // Ensure legacy credentials are cleared
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectorId);

      // Log the action
      await supabase.from('audit_logs').insert({
        organization_id: membership.organization_id,
        user_id: user.id,
        action: 'connector.credentials_updated',
        resource_type: 'connectors',
        resource_id: connectorId,
        details: { fields_updated: Object.keys(credentials) },
      });

      revalidatePath('/dashboard/connectors');
      revalidatePath(`/dashboard/connectors/${connectorId}`);
      return { success: true };
    } catch (vaultError) {
      console.error('Error updating credentials in Vault:', vaultError);
      return { success: false, error: 'Failed to update credentials' };
    }
  } catch (error) {
    console.error('Error updating connector credentials:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
