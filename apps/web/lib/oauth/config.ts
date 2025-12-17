/**
 * OAuth Provider Configuration
 *
 * Contains authorization URLs, token endpoints, and scopes for each provider.
 * Client IDs and secrets are stored in environment variables.
 */

export const OAUTH_PROVIDERS = {
  google: {
    name: 'Google',
    icon: 'google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/adwords', // Google Ads
    ],
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    usePKCE: false,
    supportsRefresh: true,
  },
  linkedin: {
    name: 'LinkedIn',
    icon: 'linkedin',
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    revokeUrl: null, // LinkedIn doesn't have a programmatic revoke endpoint
    scopes: [
      'openid',
      'profile',
      'email',
      'w_member_social', // Post on behalf of user
    ],
    clientId: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    usePKCE: false,
    supportsRefresh: true,
  },
  meta: {
    name: 'Meta',
    icon: 'facebook',
    authorizationUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me',
    revokeUrl: null, // Use DELETE /{user-id}/permissions
    scopes: [
      'email',
      'public_profile',
      'ads_management', // Meta Ads
      'ads_read',
      'pages_manage_posts', // Facebook Pages
      'pages_read_engagement',
      'instagram_basic', // Instagram
      'instagram_content_publish',
    ],
    clientId: process.env.META_CLIENT_ID || '',
    clientSecret: process.env.META_CLIENT_SECRET || '',
    usePKCE: false,
    supportsRefresh: false, // Meta uses long-lived tokens
  },
  twitter: {
    name: 'Twitter/X',
    icon: 'twitter',
    authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    revokeUrl: 'https://api.twitter.com/2/oauth2/revoke',
    scopes: [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access', // Required for refresh tokens
    ],
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    usePKCE: true, // Twitter requires PKCE
    supportsRefresh: true,
  },
} as const;

export type OAuthProvider = keyof typeof OAUTH_PROVIDERS;

export function isValidProvider(provider: string): provider is OAuthProvider {
  return provider in OAUTH_PROVIDERS;
}

export function getProviderConfig(provider: OAuthProvider) {
  return OAUTH_PROVIDERS[provider];
}

/**
 * Get the callback URL for a provider
 */
export function getCallbackUrl(provider: OAuthProvider): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/oauth/${provider}/callback`;
}

/**
 * Check if all required environment variables are set for a provider
 */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  const config = OAUTH_PROVIDERS[provider];
  return Boolean(config.clientId && config.clientSecret);
}

/**
 * Get list of configured providers
 */
export function getConfiguredProviders(): OAuthProvider[] {
  return (Object.keys(OAUTH_PROVIDERS) as OAuthProvider[]).filter(isProviderConfigured);
}
