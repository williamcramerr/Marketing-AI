import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { OAuthProvider } from '@/lib/oauth/config';

/**
 * OAuth Fixtures for E2E Tests
 *
 * Provides mock OAuth responses and helper functions for testing OAuth flows.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Mock OAuth provider responses
 */
export const MOCK_OAUTH_RESPONSES = {
  google: {
    userInfo: {
      id: 'google_123456789',
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/avatar.jpg',
    },
    tokenResponse: {
      access_token: 'mock_google_access_token',
      refresh_token: 'mock_google_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope:
        'openid email profile https://www.googleapis.com/auth/adwords',
    },
  },
  linkedin: {
    userInfo: {
      sub: 'linkedin_abc123',
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/avatar.jpg',
    },
    tokenResponse: {
      access_token: 'mock_linkedin_access_token',
      refresh_token: 'mock_linkedin_refresh_token',
      expires_in: 5184000,
      token_type: 'Bearer',
      scope: 'openid profile email w_member_social',
    },
  },
  meta: {
    userInfo: {
      id: 'meta_987654321',
      name: 'Test User',
      email: 'test@example.com',
    },
    tokenResponse: {
      access_token: 'mock_meta_access_token',
      token_type: 'Bearer',
      expires_in: 5183944,
    },
  },
  twitter: {
    userInfo: {
      data: {
        id: 'twitter_xyz789',
        name: 'Test User',
        username: 'testuser',
      },
    },
    tokenResponse: {
      access_token: 'mock_twitter_access_token',
      refresh_token: 'mock_twitter_refresh_token',
      expires_in: 7200,
      token_type: 'Bearer',
      scope: 'tweet.read tweet.write users.read offline.access',
    },
  },
};

/**
 * Generate mock OAuth state token
 */
export function generateMockState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create OAuth state in database for testing
 */
export async function createTestOAuthState(
  provider: OAuthProvider,
  userId: string,
  organizationId: string,
  state?: string
): Promise<string> {
  const stateToken = state || generateMockState();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/oauth/${provider}/callback`;

  const { error } = await supabase.from('oauth_states').insert({
    state: stateToken,
    user_id: userId,
    organization_id: organizationId,
    provider,
    redirect_uri: redirectUri,
    code_verifier: provider === 'twitter' ? crypto.randomBytes(32).toString('base64url') : null,
  });

  if (error) {
    throw new Error(`Failed to create OAuth state: ${error.message}`);
  }

  return stateToken;
}

/**
 * Clean up OAuth state from database
 */
export async function cleanupTestOAuthState(state: string): Promise<void> {
  await supabase.from('oauth_states').delete().eq('state', state);
}

/**
 * Create test OAuth connection in database
 */
export async function createTestOAuthConnection(
  provider: OAuthProvider,
  organizationId: string,
  userId: string,
  providerAccountId?: string
): Promise<string> {
  const accountId = providerAccountId || `test_${provider}_${Date.now()}`;

  // Mock vault secret IDs (in tests, these won't actually be used)
  const accessTokenSecretId = `test_access_${provider}_${accountId}`;
  const refreshTokenSecretId = `test_refresh_${provider}_${accountId}`;

  const { data: connection, error } = await supabase
    .from('oauth_connections')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      provider,
      provider_account_id: accountId,
      provider_account_name: (MOCK_OAUTH_RESPONSES[provider].userInfo as any).name || (MOCK_OAUTH_RESPONSES[provider].userInfo as any).data?.name || 'Test User',
      provider_account_email: (MOCK_OAUTH_RESPONSES[provider].userInfo as any).email || 'test@example.com',
      access_token_secret_id: accessTokenSecretId,
      refresh_token_secret_id: provider !== 'meta' ? refreshTokenSecretId : null,
      token_expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      scopes: (MOCK_OAUTH_RESPONSES[provider].tokenResponse as any).scope?.split(' ') || [],
      active: true,
      last_error: null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create OAuth connection: ${error.message}`);
  }

  return connection.id;
}

/**
 * Delete test OAuth connection
 */
export async function deleteTestOAuthConnection(connectionId: string): Promise<void> {
  await supabase.from('oauth_connections').delete().eq('id', connectionId);
}

/**
 * Get OAuth connections for organization
 */
export async function getOAuthConnections(
  organizationId: string,
  provider?: OAuthProvider
): Promise<any[]> {
  let query = supabase
    .from('oauth_connections')
    .select('*')
    .eq('organization_id', organizationId);

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get OAuth connections: ${error.message}`);
  }

  return data || [];
}

/**
 * Mock OAuth provider authorization URLs
 */
export const MOCK_AUTH_URLS = {
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
  linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
  meta: 'https://www.facebook.com/v19.0/dialog/oauth',
  twitter: 'https://twitter.com/i/oauth2/authorize',
};

/**
 * Mock OAuth provider token URLs
 */
export const MOCK_TOKEN_URLS = {
  google: 'https://oauth2.googleapis.com/token',
  linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
  meta: 'https://graph.facebook.com/v19.0/oauth/access_token',
  twitter: 'https://api.twitter.com/2/oauth2/token',
};

/**
 * Mock OAuth provider user info URLs
 */
export const MOCK_USER_INFO_URLS = {
  google: 'https://www.googleapis.com/oauth2/v2/userinfo',
  linkedin: 'https://api.linkedin.com/v2/userinfo',
  meta: 'https://graph.facebook.com/me',
  twitter: 'https://api.twitter.com/2/users/me',
};

/**
 * Generate mock authorization code
 */
export function generateMockAuthCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate mock error response from provider
 */
export function generateMockProviderError(errorCode: string, description?: string) {
  return {
    error: errorCode,
    error_description: description || 'Mock OAuth error',
  };
}
