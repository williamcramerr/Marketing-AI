import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { oauthService } from '@/lib/oauth/service';
import { isValidProvider, type OAuthProvider } from '@/lib/oauth/config';

export const runtime = 'nodejs';

/**
 * GET /api/oauth/[provider]/callback
 *
 * Handles the OAuth callback from the provider.
 * Exchanges the authorization code for tokens and creates the connection.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Base redirect URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const successRedirect = `${baseUrl}/dashboard/connections?success=${provider}`;
  const errorRedirect = (message: string) =>
    `${baseUrl}/dashboard/connections?error=${encodeURIComponent(message)}`;

  try {
    // Check for OAuth error from provider
    if (error) {
      console.error(`OAuth error from ${provider}:`, error, errorDescription);
      return NextResponse.redirect(
        errorRedirect(errorDescription || `OAuth error: ${error}`)
      );
    }

    // Validate provider
    if (!isValidProvider(provider)) {
      return NextResponse.redirect(errorRedirect('Invalid OAuth provider'));
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        errorRedirect('Missing authorization code or state')
      );
    }

    // Exchange code for tokens
    const { tokens, userId, organizationId } =
      await oauthService.exchangeCodeForTokens(
        provider as OAuthProvider,
        code,
        state
      );

    // Fetch user info from provider
    const userInfo = await oauthService.fetchUserInfo(
      provider as OAuthProvider,
      tokens.accessToken
    );

    // Create the connection
    const connectionId = await oauthService.createConnection(
      provider as OAuthProvider,
      organizationId,
      userId,
      tokens,
      userInfo
    );

    // Log the connection
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      organization_id: organizationId,
      action: 'oauth.connected',
      actor_type: 'user',
      actor_id: userId,
      resource_type: 'oauth_connections',
      resource_id: connectionId,
      metadata: {
        provider,
        provider_account_id: userInfo.id,
        provider_account_name: userInfo.name,
      },
    });

    // Redirect to success page
    return NextResponse.redirect(successRedirect);
  } catch (err) {
    console.error(`OAuth callback error for ${provider}:`, err);
    const message =
      err instanceof Error ? err.message : 'Failed to complete OAuth connection';
    return NextResponse.redirect(errorRedirect(message));
  }
}
