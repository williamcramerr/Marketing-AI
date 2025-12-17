import { test, expect } from '@playwright/test';
import { test as authTest, TEST_ADMIN, login } from '../../fixtures/auth.fixture';
import {
  createTestOAuthState,
  cleanupTestOAuthState,
  createTestOAuthConnection,
  deleteTestOAuthConnection,
  getOAuthConnections,
  MOCK_OAUTH_RESPONSES,
  MOCK_TOKEN_URLS,
  MOCK_USER_INFO_URLS,
  generateMockAuthCode,
  generateMockProviderError,
  generateMockState,
} from '../../fixtures/oauth.fixture';
import { createTestUser, createTestOrganization, cleanupTestData } from '../../fixtures/database.fixture';
import { ConnectorsPage } from '../../pages/connectors.page';
import type { OAuthProvider } from '@/lib/oauth/config';

test.describe('OAuth Flows', () => {
  test.describe('Authorization Flow - Happy Path', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let testUserId: string;
    let testOrgId: string;
    let connectorsPage: ConnectorsPage;

    test.beforeEach(async ({ page }) => {
      // Create test user with admin role
      const user = await createTestUser('oauth-test@example.com', 'password123');
      if (!user) throw new Error('Failed to create test user');
      testUserId = user.id;

      const orgId = await createTestOrganization('OAuth Test Org', testUserId);
      if (!orgId) throw new Error('Failed to create test organization');
      testOrgId = orgId;

      // Login as the test user
      await login(page, 'oauth-test@example.com', 'password123');

      connectorsPage = new ConnectorsPage(page);
      await connectorsPage.goto();
    });

    test.afterEach(async () => {
      await cleanupTestData(testUserId, testOrgId);
    });

    test('should complete Google OAuth flow successfully', async ({ page, context }) => {
      const provider: OAuthProvider = 'google';

      // Set up route interception for OAuth flow
      await page.route('**/api/oauth/google/authorize', async (route) => {
        const url = new URL(route.request().url());
        const redirectUrl = 'https://accounts.google.com/o/oauth2/v2/auth';

        // Generate state for the flow
        const state = generateMockState();
        await createTestOAuthState(provider, testUserId, testOrgId, state);

        // Simulate redirect to OAuth provider
        await route.fulfill({
          status: 302,
          headers: {
            Location: `${redirectUrl}?state=${state}&client_id=test`,
          },
        });
      });

      // Mock the OAuth provider's authorization page
      await page.route('**/accounts.google.com/o/oauth2/v2/auth*', async (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const code = generateMockAuthCode();

        // Simulate user granting permissions and redirect back to callback
        const callbackUrl = `${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/api/oauth/google/callback?code=${code}&state=${state}`;

        await route.fulfill({
          status: 302,
          headers: {
            Location: callbackUrl,
          },
        });
      });

      // Mock token exchange
      await page.route(MOCK_TOKEN_URLS.google, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_OAUTH_RESPONSES.google.tokenResponse),
        });
      });

      // Mock user info endpoint
      await page.route(MOCK_USER_INFO_URLS.google, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_OAUTH_RESPONSES.google.userInfo),
        });
      });

      // Click connect button
      await connectorsPage.connectProvider(provider);

      // Wait for redirect back to connections page
      await page.waitForURL(/\/dashboard\/connections/);

      // Verify success
      const successParam = await connectorsPage.getSuccessFromUrl();
      expect(successParam).toBe('google');

      // Verify connection was created
      const connections = await getOAuthConnections(testOrgId, provider);
      expect(connections.length).toBe(1);
      expect(connections[0].provider).toBe('google');
      expect(connections[0].provider_account_id).toBe(MOCK_OAUTH_RESPONSES.google.userInfo.id);
      expect(connections[0].active).toBe(true);

      // Cleanup
      await deleteTestOAuthConnection(connections[0].id);
    });

    test('should complete LinkedIn OAuth flow successfully', async ({ page }) => {
      const provider: OAuthProvider = 'linkedin';

      // Mock authorization endpoint
      await page.route('**/api/oauth/linkedin/authorize', async (route) => {
        const state = generateMockState();
        await createTestOAuthState(provider, testUserId, testOrgId, state);

        await route.fulfill({
          status: 302,
          headers: {
            Location: `https://www.linkedin.com/oauth/v2/authorization?state=${state}`,
          },
        });
      });

      // Mock LinkedIn authorization
      await page.route('**/www.linkedin.com/oauth/v2/authorization*', async (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const code = generateMockAuthCode();
        const callbackUrl = `${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/api/oauth/linkedin/callback?code=${code}&state=${state}`;

        await route.fulfill({
          status: 302,
          headers: { Location: callbackUrl },
        });
      });

      // Mock token exchange
      await page.route(MOCK_TOKEN_URLS.linkedin, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_OAUTH_RESPONSES.linkedin.tokenResponse),
        });
      });

      // Mock user info
      await page.route(MOCK_USER_INFO_URLS.linkedin, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_OAUTH_RESPONSES.linkedin.userInfo),
        });
      });

      await connectorsPage.connectProvider(provider);
      await page.waitForURL(/\/dashboard\/connections/);

      const successParam = await connectorsPage.getSuccessFromUrl();
      expect(successParam).toBe('linkedin');

      const connections = await getOAuthConnections(testOrgId, provider);
      expect(connections.length).toBe(1);
      expect(connections[0].provider).toBe('linkedin');

      await deleteTestOAuthConnection(connections[0].id);
    });

    test('should complete Meta OAuth flow successfully', async ({ page }) => {
      const provider: OAuthProvider = 'meta';

      await page.route('**/api/oauth/meta/authorize', async (route) => {
        const state = generateMockState();
        await createTestOAuthState(provider, testUserId, testOrgId, state);

        await route.fulfill({
          status: 302,
          headers: {
            Location: `https://www.facebook.com/v19.0/dialog/oauth?state=${state}`,
          },
        });
      });

      await page.route('**/www.facebook.com/v19.0/dialog/oauth*', async (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const code = generateMockAuthCode();
        const callbackUrl = `${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/api/oauth/meta/callback?code=${code}&state=${state}`;

        await route.fulfill({
          status: 302,
          headers: { Location: callbackUrl },
        });
      });

      await page.route(MOCK_TOKEN_URLS.meta, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_OAUTH_RESPONSES.meta.tokenResponse),
        });
      });

      await page.route('**/graph.facebook.com/me*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_OAUTH_RESPONSES.meta.userInfo),
        });
      });

      await connectorsPage.connectProvider(provider);
      await page.waitForURL(/\/dashboard\/connections/);

      const successParam = await connectorsPage.getSuccessFromUrl();
      expect(successParam).toBe('meta');

      const connections = await getOAuthConnections(testOrgId, provider);
      expect(connections.length).toBe(1);

      await deleteTestOAuthConnection(connections[0].id);
    });

    test('should complete Twitter OAuth flow with PKCE', async ({ page }) => {
      const provider: OAuthProvider = 'twitter';

      await page.route('**/api/oauth/twitter/authorize', async (route) => {
        const state = generateMockState();
        await createTestOAuthState(provider, testUserId, testOrgId, state);

        await route.fulfill({
          status: 302,
          headers: {
            Location: `https://twitter.com/i/oauth2/authorize?state=${state}`,
          },
        });
      });

      await page.route('**/twitter.com/i/oauth2/authorize*', async (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const code = generateMockAuthCode();
        const callbackUrl = `${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/api/oauth/twitter/callback?code=${code}&state=${state}`;

        await route.fulfill({
          status: 302,
          headers: { Location: callbackUrl },
        });
      });

      await page.route(MOCK_TOKEN_URLS.twitter, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_OAUTH_RESPONSES.twitter.tokenResponse),
        });
      });

      await page.route(MOCK_USER_INFO_URLS.twitter, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_OAUTH_RESPONSES.twitter.userInfo),
        });
      });

      await connectorsPage.connectProvider(provider);
      await page.waitForURL(/\/dashboard\/connections/);

      const successParam = await connectorsPage.getSuccessFromUrl();
      expect(successParam).toBe('twitter');

      const connections = await getOAuthConnections(testOrgId, provider);
      expect(connections.length).toBe(1);

      await deleteTestOAuthConnection(connections[0].id);
    });
  });

  test.describe('Permission Enforcement', () => {
    test('should deny unauthenticated users', async ({ page }) => {
      // Try to access authorize endpoint without authentication
      const response = await page.goto('/api/oauth/google/authorize');

      expect(response?.status()).toBe(401);
    });

    test('should deny non-admin users', async ({ page }) => {
      // Create a regular user (not admin/owner)
      const user = await createTestUser('regular-user@example.com', 'password123');
      if (!user) throw new Error('Failed to create test user');

      const orgId = await createTestOrganization('Test Org', user.id);
      if (!orgId) throw new Error('Failed to create organization');

      // Update user role to member (non-admin)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from('organization_members')
        .update({ role: 'member' })
        .eq('user_id', user.id)
        .eq('organization_id', orgId);

      // Login as regular user
      await login(page, 'regular-user@example.com', 'password123');

      // Try to connect OAuth (should be denied)
      const response = await page.goto('/api/oauth/google/authorize');
      expect(response?.status()).toBe(403);

      await cleanupTestData(user.id, orgId);
    });
  });

  test.describe('Error Handling', () => {
    let testUserId: string;
    let testOrgId: string;

    test.beforeEach(async ({ page }) => {
      const user = await createTestUser('oauth-error-test@example.com', 'password123');
      if (!user) throw new Error('Failed to create test user');
      testUserId = user.id;

      const orgId = await createTestOrganization('OAuth Error Test Org', testUserId);
      if (!orgId) throw new Error('Failed to create test organization');
      testOrgId = orgId;

      await login(page, 'oauth-error-test@example.com', 'password123');
    });

    test.afterEach(async () => {
      await cleanupTestData(testUserId, testOrgId);
    });

    test('should handle invalid state parameter', async ({ page }) => {
      const provider: OAuthProvider = 'google';
      const invalidState = 'invalid_state_token';
      const code = generateMockAuthCode();

      // Go directly to callback with invalid state
      await page.goto(`/api/oauth/${provider}/callback?code=${code}&state=${invalidState}`);

      // Should redirect to connections page with error
      await page.waitForURL(/\/dashboard\/connections/);
      const errorParam = await new ConnectorsPage(page).getErrorFromUrl();
      expect(errorParam).toBeTruthy();
      expect(errorParam).toContain('state');
    });

    test('should handle provider error responses', async ({ page }) => {
      const provider: OAuthProvider = 'google';
      const connectorsPage = new ConnectorsPage(page);
      await connectorsPage.goto();

      // Mock authorization to return error
      await page.route('**/api/oauth/google/authorize', async (route) => {
        const state = generateMockState();
        await route.fulfill({
          status: 302,
          headers: {
            Location: `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
          },
        });
      });

      await page.route('**/accounts.google.com/o/oauth2/v2/auth*', async (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const error = generateMockProviderError('access_denied', 'User denied access');

        const callbackUrl = `${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/api/oauth/google/callback?error=${error.error}&error_description=${encodeURIComponent(error.error_description)}&state=${state}`;

        await route.fulfill({
          status: 302,
          headers: { Location: callbackUrl },
        });
      });

      await connectorsPage.connectProvider(provider);
      await page.waitForURL(/\/dashboard\/connections/);

      const errorParam = await connectorsPage.getErrorFromUrl();
      expect(errorParam).toBeTruthy();
      expect(errorParam).toContain('denied');
    });

    test('should handle missing authorization code', async ({ page }) => {
      const provider: OAuthProvider = 'google';
      const state = generateMockState();
      await createTestOAuthState(provider, testUserId, testOrgId, state);

      // Go to callback without code parameter
      await page.goto(`/api/oauth/${provider}/callback?state=${state}`);

      await page.waitForURL(/\/dashboard\/connections/);
      const errorParam = await new ConnectorsPage(page).getErrorFromUrl();
      expect(errorParam).toBeTruthy();

      await cleanupTestOAuthState(state);
    });

    test('should handle token exchange failure', async ({ page }) => {
      const provider: OAuthProvider = 'google';
      const connectorsPage = new ConnectorsPage(page);
      await connectorsPage.goto();

      await page.route('**/api/oauth/google/authorize', async (route) => {
        const state = generateMockState();
        await createTestOAuthState(provider, testUserId, testOrgId, state);

        await route.fulfill({
          status: 302,
          headers: {
            Location: `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
          },
        });
      });

      await page.route('**/accounts.google.com/o/oauth2/v2/auth*', async (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const code = generateMockAuthCode();
        const callbackUrl = `${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/api/oauth/google/callback?code=${code}&state=${state}`;

        await route.fulfill({
          status: 302,
          headers: { Location: callbackUrl },
        });
      });

      // Mock token exchange to fail
      await page.route(MOCK_TOKEN_URLS.google, async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          }),
        });
      });

      await connectorsPage.connectProvider(provider);
      await page.waitForURL(/\/dashboard\/connections/);

      const errorParam = await connectorsPage.getErrorFromUrl();
      expect(errorParam).toBeTruthy();
    });
  });

  test.describe('Disconnection Flow', () => {
    let testUserId: string;
    let testOrgId: string;
    let connectionId: string;

    test.beforeEach(async ({ page }) => {
      const user = await createTestUser('oauth-disconnect-test@example.com', 'password123');
      if (!user) throw new Error('Failed to create test user');
      testUserId = user.id;

      const orgId = await createTestOrganization('OAuth Disconnect Test Org', testUserId);
      if (!orgId) throw new Error('Failed to create test organization');
      testOrgId = orgId;

      // Create a test connection
      connectionId = await createTestOAuthConnection('google', testOrgId, testUserId);

      await login(page, 'oauth-disconnect-test@example.com', 'password123');
    });

    test.afterEach(async () => {
      await cleanupTestData(testUserId, testOrgId);
    });

    test('should disconnect OAuth provider successfully', async ({ page }) => {
      const connectorsPage = new ConnectorsPage(page);
      await connectorsPage.goto();

      // Verify connection exists
      const isConnected = await connectorsPage.isProviderConnected('google');
      expect(isConnected).toBe(true);

      // Mock disconnect API
      await page.route('**/api/oauth/google/disconnect', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      });

      // Disconnect
      await connectorsPage.disconnectProvider('google');
      await connectorsPage.confirmDisconnect();

      // Wait for disconnection
      await connectorsPage.waitForDisconnection('google');

      // Verify connection was removed
      const connections = await getOAuthConnections(testOrgId, 'google');
      expect(connections.length).toBe(0);
    });

    test('should handle disconnection errors', async ({ page }) => {
      const connectorsPage = new ConnectorsPage(page);
      await connectorsPage.goto();

      // Mock disconnect API to fail
      await page.route('**/api/oauth/google/disconnect', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to disconnect' }),
        });
      });

      await connectorsPage.disconnectProvider('google');
      await connectorsPage.confirmDisconnect();

      // Should show error message
      const error = await connectorsPage.waitForError();
      expect(error).toBeTruthy();

      // Connection should still exist
      const connections = await getOAuthConnections(testOrgId, 'google');
      expect(connections.length).toBe(1);
    });
  });
});
