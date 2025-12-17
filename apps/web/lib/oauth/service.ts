import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { vaultService } from '@/lib/vault/service';
import {
  OAuthProvider,
  getProviderConfig,
  getCallbackUrl,
  isProviderConfigured,
} from './config';

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string;
  scope?: string;
}

export interface UserInfo {
  id: string;
  name?: string;
  email?: string;
}

/**
 * OAuthService handles OAuth 2.0 flows for external provider integrations
 */
export class OAuthService {
  private _supabase: ReturnType<typeof createAdminClient> | null = null;

  private get supabase() {
    if (!this._supabase) {
      this._supabase = createAdminClient();
    }
    return this._supabase;
  }

  /**
   * Generate the authorization URL for a provider
   */
  async getAuthorizationUrl(
    provider: OAuthProvider,
    organizationId: string,
    userId: string
  ): Promise<string> {
    const config = getProviderConfig(provider);

    if (!isProviderConfigured(provider)) {
      throw new Error(`Provider ${provider} is not configured`);
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Generate PKCE code verifier if required
    let codeVerifier: string | null = null;
    let codeChallenge: string | null = null;

    if (config.usePKCE) {
      codeVerifier = crypto.randomBytes(32).toString('base64url');
      codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    }

    const redirectUri = getCallbackUrl(provider);

    // Store state in database
    const { error } = await this.supabase.from('oauth_states').insert({
      state,
      user_id: userId,
      organization_id: organizationId,
      provider,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    if (error) {
      throw new Error(`Failed to store OAuth state: ${error.message}`);
    }

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent to get refresh token
    });

    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    provider: OAuthProvider,
    code: string,
    state: string
  ): Promise<{
    tokens: TokenResponse;
    userId: string;
    organizationId: string;
  }> {
    const config = getProviderConfig(provider);

    // Verify and consume state
    const { data: stateData, error: stateError } = await this.supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', provider)
      .single();

    if (stateError || !stateData) {
      throw new Error('Invalid or expired OAuth state');
    }

    // Check if state is expired
    if (new Date(stateData.expires_at) < new Date()) {
      await this.supabase.from('oauth_states').delete().eq('id', stateData.id);
      throw new Error('OAuth state has expired');
    }

    // Delete state (single use)
    await this.supabase.from('oauth_states').delete().eq('id', stateData.id);

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: stateData.redirect_uri,
    });

    if (stateData.code_verifier) {
      tokenParams.set('code_verifier', stateData.code_verifier);
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokenData = await tokenResponse.json();

    return {
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
      },
      userId: stateData.user_id,
      organizationId: stateData.organization_id,
    };
  }

  /**
   * Refresh an access token using the refresh token
   */
  async refreshAccessToken(connectionId: string): Promise<void> {
    // Get connection with vault IDs
    const { data: connection, error } = await this.supabase
      .from('oauth_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (error || !connection) {
      throw new Error('OAuth connection not found');
    }

    if (!connection.refresh_token_secret_id) {
      throw new Error('No refresh token available');
    }

    const config = getProviderConfig(connection.provider as OAuthProvider);

    if (!config.supportsRefresh) {
      throw new Error(`Provider ${connection.provider} does not support token refresh`);
    }

    // Get refresh token from Vault
    const refreshToken = await vaultService.getSecret(connection.refresh_token_secret_id);

    if (!refreshToken) {
      throw new Error('Failed to retrieve refresh token');
    }

    // Exchange refresh token for new access token
    const tokenParams = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const tokenData = await tokenResponse.json();

    // Update access token in Vault
    await vaultService.updateSecret(
      connection.access_token_secret_id,
      tokenData.access_token
    );

    // Update refresh token if a new one was provided
    if (tokenData.refresh_token && connection.refresh_token_secret_id) {
      await vaultService.updateSecret(
        connection.refresh_token_secret_id,
        tokenData.refresh_token
      );
    }

    // Update expiration in database
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    await this.supabase
      .from('oauth_connections')
      .update({
        token_expires_at: expiresAt?.toISOString(),
        last_error: null,
      })
      .eq('id', connectionId);
  }

  /**
   * Get a valid access token for a connection (refreshes if needed)
   */
  async getAccessToken(connectionId: string): Promise<string> {
    const { data: connection, error } = await this.supabase
      .from('oauth_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (error || !connection) {
      throw new Error('OAuth connection not found');
    }

    if (!connection.access_token_secret_id) {
      throw new Error('No access token available');
    }

    // Check if token needs refresh (5 minute buffer)
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at);
      const now = new Date();
      const bufferMs = 5 * 60 * 1000; // 5 minutes

      if (expiresAt.getTime() - now.getTime() < bufferMs) {
        try {
          await this.refreshAccessToken(connectionId);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Try to use existing token anyway
        }
      }
    }

    // Get access token from Vault
    const accessToken = await vaultService.getSecret(connection.access_token_secret_id);

    if (!accessToken) {
      throw new Error('Failed to retrieve access token');
    }

    // Update last_used_at
    await this.supabase
      .from('oauth_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', connectionId);

    return accessToken;
  }

  /**
   * Fetch user info from provider
   */
  async fetchUserInfo(
    provider: OAuthProvider,
    accessToken: string
  ): Promise<UserInfo> {
    const config = getProviderConfig(provider);

    let url: string = config.userInfoUrl;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    // Provider-specific adjustments
    if (provider === 'meta') {
      url = `${config.userInfoUrl}?fields=id,name,email`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch user info: ${error}`);
    }

    const data = await response.json();

    // Normalize response across providers
    switch (provider) {
      case 'google':
        return { id: data.id, name: data.name, email: data.email };
      case 'linkedin':
        return { id: data.sub, name: data.name, email: data.email };
      case 'meta':
        return { id: data.id, name: data.name, email: data.email };
      case 'twitter':
        return { id: data.data.id, name: data.data.name, email: undefined };
      default:
        return { id: data.id };
    }
  }

  /**
   * Create an OAuth connection with tokens stored in Vault
   */
  async createConnection(
    provider: OAuthProvider,
    organizationId: string,
    userId: string,
    tokens: TokenResponse,
    userInfo: UserInfo
  ): Promise<string> {
    // Store tokens in Vault
    const accessTokenSecretId = await vaultService.storeSecret(
      `oauth_${provider}_${userInfo.id}_access`,
      tokens.accessToken,
      `Access token for ${provider} account ${userInfo.id}`
    );

    let refreshTokenSecretId: string | undefined;
    if (tokens.refreshToken) {
      refreshTokenSecretId = await vaultService.storeSecret(
        `oauth_${provider}_${userInfo.id}_refresh`,
        tokens.refreshToken,
        `Refresh token for ${provider} account ${userInfo.id}`
      );
    }

    // Calculate token expiration
    const tokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    // Create connection record
    const { data: connection, error } = await this.supabase
      .from('oauth_connections')
      .upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          provider,
          provider_account_id: userInfo.id,
          provider_account_name: userInfo.name,
          provider_account_email: userInfo.email,
          access_token_secret_id: accessTokenSecretId,
          refresh_token_secret_id: refreshTokenSecretId,
          token_expires_at: tokenExpiresAt?.toISOString(),
          scopes: tokens.scope?.split(' ') || [],
          active: true,
          last_error: null,
        },
        {
          onConflict: 'organization_id,provider,provider_account_id',
        }
      )
      .select()
      .single();

    if (error) {
      // Cleanup Vault secrets on failure
      await vaultService.deleteSecret(accessTokenSecretId);
      if (refreshTokenSecretId) {
        await vaultService.deleteSecret(refreshTokenSecretId);
      }
      throw new Error(`Failed to create OAuth connection: ${error.message}`);
    }

    return connection.id;
  }

  /**
   * Disconnect an OAuth connection
   */
  async disconnectConnection(connectionId: string): Promise<void> {
    const { data: connection, error } = await this.supabase
      .from('oauth_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (error || !connection) {
      throw new Error('OAuth connection not found');
    }

    // Delete tokens from Vault
    if (connection.access_token_secret_id) {
      try {
        await vaultService.deleteSecret(connection.access_token_secret_id);
      } catch (e) {
        console.error('Failed to delete access token:', e);
      }
    }

    if (connection.refresh_token_secret_id) {
      try {
        await vaultService.deleteSecret(connection.refresh_token_secret_id);
      } catch (e) {
        console.error('Failed to delete refresh token:', e);
      }
    }

    // Attempt to revoke token at provider (best effort)
    const config = getProviderConfig(connection.provider as OAuthProvider);
    if (config.revokeUrl && connection.access_token_secret_id) {
      try {
        const accessToken = await vaultService.getSecret(
          connection.access_token_secret_id
        );
        if (accessToken) {
          await fetch(config.revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              token: accessToken,
              client_id: config.clientId,
              client_secret: config.clientSecret,
            }).toString(),
          });
        }
      } catch (e) {
        console.error('Failed to revoke token at provider:', e);
      }
    }

    // Delete connection record
    await this.supabase.from('oauth_connections').delete().eq('id', connectionId);
  }
}

// Export singleton instance
export const oauthService = new OAuthService();
