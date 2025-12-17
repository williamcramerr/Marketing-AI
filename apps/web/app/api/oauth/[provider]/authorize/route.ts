import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { oauthService } from '@/lib/oauth/service';
import { isValidProvider, isProviderConfigured, type OAuthProvider } from '@/lib/oauth/config';

export const runtime = 'nodejs';

/**
 * GET /api/oauth/[provider]/authorize
 *
 * Initiates the OAuth flow by redirecting to the provider's authorization URL.
 * Requires authenticated user.
 */
export async function GET(
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

    // Check if provider is configured
    if (!isProviderConfigured(provider)) {
      return NextResponse.json(
        { error: `OAuth provider ${provider} is not configured` },
        { status: 503 }
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

    // Only admins or owners can connect OAuth accounts
    if (!['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to connect accounts' },
        { status: 403 }
      );
    }

    // Generate authorization URL
    const authorizationUrl = await oauthService.getAuthorizationUrl(
      provider as OAuthProvider,
      membership.organization_id,
      user.id
    );

    // Redirect to provider
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
