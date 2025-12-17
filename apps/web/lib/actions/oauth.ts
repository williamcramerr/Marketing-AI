'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { oauthService } from '@/lib/oauth/service';
import { getConfiguredProviders, OAUTH_PROVIDERS, type OAuthProvider } from '@/lib/oauth/config';

export interface OAuthConnectionSummary {
  id: string;
  provider: OAuthProvider;
  providerName: string;
  providerAccountId: string;
  providerAccountName: string | null;
  providerAccountEmail: string | null;
  active: boolean;
  tokenExpiresAt: string | null;
  lastUsedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/**
 * List all OAuth connections for the organization
 */
export async function listOAuthConnections() {
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

    const { data: connections, error } = await supabase
      .from('oauth_connections')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing OAuth connections:', error);
      return { success: false, error: 'Failed to list connections' };
    }

    // Transform to summary format
    const summaries: OAuthConnectionSummary[] = (connections || []).map((conn) => ({
      id: conn.id,
      provider: conn.provider as OAuthProvider,
      providerName: OAUTH_PROVIDERS[conn.provider as OAuthProvider]?.name || conn.provider,
      providerAccountId: conn.provider_account_id,
      providerAccountName: conn.provider_account_name,
      providerAccountEmail: conn.provider_account_email,
      active: conn.active,
      tokenExpiresAt: conn.token_expires_at,
      lastUsedAt: conn.last_used_at,
      lastError: conn.last_error,
      createdAt: conn.created_at,
    }));

    return { success: true, data: summaries };
  } catch (error) {
    console.error('Error listing OAuth connections:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get available OAuth providers and their configuration status
 */
export async function getAvailableProviders() {
  try {
    const configured = getConfiguredProviders();

    const providers = (Object.keys(OAUTH_PROVIDERS) as OAuthProvider[]).map(
      (provider) => ({
        id: provider,
        name: OAUTH_PROVIDERS[provider].name,
        icon: OAUTH_PROVIDERS[provider].icon,
        configured: configured.includes(provider),
        scopes: OAUTH_PROVIDERS[provider].scopes,
      })
    );

    return { success: true, data: providers };
  } catch (error) {
    console.error('Error getting available providers:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Refresh tokens for an OAuth connection
 */
export async function refreshOAuthConnection(connectionId: string) {
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

    // Verify the connection belongs to this organization
    const { data: connection } = await supabase
      .from('oauth_connections')
      .select('id, provider')
      .eq('id', connectionId)
      .eq('organization_id', membership.organization_id)
      .single();

    if (!connection) {
      return { success: false, error: 'OAuth connection not found' };
    }

    // Attempt to refresh
    await oauthService.refreshAccessToken(connectionId);

    revalidatePath('/dashboard/connections');
    return { success: true };
  } catch (error) {
    console.error('Error refreshing OAuth connection:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh connection',
    };
  }
}

/**
 * Disconnect an OAuth connection
 */
export async function disconnectOAuthConnection(connectionId: string) {
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

    // Only admins or owners can disconnect
    if (!['admin', 'owner'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Verify the connection belongs to this organization
    const { data: connection } = await supabase
      .from('oauth_connections')
      .select('id, provider, provider_account_name')
      .eq('id', connectionId)
      .eq('organization_id', membership.organization_id)
      .single();

    if (!connection) {
      return { success: false, error: 'OAuth connection not found' };
    }

    // Disconnect
    await oauthService.disconnectConnection(connectionId);

    // Log the action
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      action: 'oauth.disconnected',
      resource_type: 'oauth_connections',
      resource_id: connectionId,
      details: {
        provider: connection.provider,
        provider_account_name: connection.provider_account_name,
      },
    });

    revalidatePath('/dashboard/connections');
    return { success: true };
  } catch (error) {
    console.error('Error disconnecting OAuth connection:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get OAuth connection for use with a connector
 * Returns the connection ID that can be used with oauthService.getAccessToken()
 */
export async function getOAuthConnectionForProvider(provider: OAuthProvider) {
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

    // Get active connection for this provider
    const { data: connection, error } = await supabase
      .from('oauth_connections')
      .select('id, provider_account_name')
      .eq('organization_id', membership.organization_id)
      .eq('provider', provider)
      .eq('active', true)
      .limit(1)
      .single();

    if (error || !connection) {
      return {
        success: false,
        error: `No active ${OAUTH_PROVIDERS[provider].name} connection found`,
      };
    }

    return { success: true, data: connection };
  } catch (error) {
    console.error('Error getting OAuth connection:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
