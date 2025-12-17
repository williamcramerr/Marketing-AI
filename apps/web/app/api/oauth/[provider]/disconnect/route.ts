import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { oauthService } from '@/lib/oauth/service';
import { isValidProvider } from '@/lib/oauth/config';

export const runtime = 'nodejs';

/**
 * POST /api/oauth/[provider]/disconnect
 *
 * Disconnects an OAuth connection, removing tokens and revoking access.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // Validate provider
    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: 'Invalid OAuth provider' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    // Only admins or owners can disconnect OAuth accounts
    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to disconnect accounts' },
        { status: 403 }
      );
    }

    // Verify the connection belongs to this organization
    const { data: connection } = await supabase
      .from('oauth_connections')
      .select('id, provider, provider_account_name')
      .eq('id', connectionId)
      .eq('organization_id', membership.organization_id)
      .eq('provider', provider)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'OAuth connection not found' },
        { status: 404 }
      );
    }

    // Disconnect the connection
    await oauthService.disconnectConnection(connectionId);

    // Log the disconnection
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      action: 'oauth.disconnected',
      actor_type: 'user',
      actor_id: user.id,
      resource_type: 'oauth_connections',
      resource_id: connectionId,
      metadata: {
        provider,
        provider_account_name: connection.provider_account_name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OAuth disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect OAuth connection' },
      { status: 500 }
    );
  }
}
