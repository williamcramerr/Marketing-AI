import type { Page, Locator } from '@playwright/test';
import type { OAuthProvider } from '@/lib/oauth/config';

/**
 * Page Object for OAuth Connectors/Connections page
 *
 * Handles interactions with the OAuth provider connection management UI.
 */
export class ConnectorsPage {
  readonly page: Page;
  readonly pageHeading: Locator;
  readonly googleConnectButton: Locator;
  readonly linkedinConnectButton: Locator;
  readonly metaConnectButton: Locator;
  readonly twitterConnectButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeading = page.locator('h1, h2').filter({ hasText: /connections?|connectors?/i });
    this.googleConnectButton = page.locator(
      '[data-testid="connect-google"], button:has-text("Connect Google")'
    );
    this.linkedinConnectButton = page.locator(
      '[data-testid="connect-linkedin"], button:has-text("Connect LinkedIn")'
    );
    this.metaConnectButton = page.locator(
      '[data-testid="connect-meta"], button:has-text("Connect Meta"), button:has-text("Connect Facebook")'
    );
    this.twitterConnectButton = page.locator(
      '[data-testid="connect-twitter"], button:has-text("Connect Twitter"), button:has-text("Connect X")'
    );
    this.successMessage = page.locator('[data-testid="success-message"], .text-success');
    this.errorMessage = page.locator('[data-testid="error-message"], .text-destructive');
  }

  /**
   * Navigate to the connections page
   */
  async goto() {
    await this.page.goto('/dashboard/connections');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get connect button for a specific provider
   */
  getConnectButton(provider: OAuthProvider): Locator {
    switch (provider) {
      case 'google':
        return this.googleConnectButton;
      case 'linkedin':
        return this.linkedinConnectButton;
      case 'meta':
        return this.metaConnectButton;
      case 'twitter':
        return this.twitterConnectButton;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Get disconnect button for a specific provider
   */
  getDisconnectButton(provider: OAuthProvider): Locator {
    return this.page.locator(
      `[data-testid="disconnect-${provider}"], button:has-text("Disconnect"):near([data-provider="${provider}"])`
    );
  }

  /**
   * Get connection status element for a specific provider
   */
  getConnectionStatus(provider: OAuthProvider): Locator {
    return this.page.locator(
      `[data-testid="status-${provider}"], [data-provider="${provider}"] [data-testid="connection-status"]`
    );
  }

  /**
   * Get connection details (account name, email) for a specific provider
   */
  getConnectionDetails(provider: OAuthProvider): Locator {
    return this.page.locator(
      `[data-testid="details-${provider}"], [data-provider="${provider}"] [data-testid="connection-details"]`
    );
  }

  /**
   * Click connect button for a provider
   */
  async connectProvider(provider: OAuthProvider) {
    const connectButton = this.getConnectButton(provider);
    await connectButton.click();
  }

  /**
   * Click disconnect button for a provider
   */
  async disconnectProvider(provider: OAuthProvider) {
    const disconnectButton = this.getDisconnectButton(provider);
    await disconnectButton.click();
  }

  /**
   * Confirm disconnection in modal/dialog if present
   */
  async confirmDisconnect() {
    const confirmButton = this.page.locator(
      '[data-testid="confirm-disconnect"], button:has-text("Confirm"), button:has-text("Yes")'
    );

    try {
      await confirmButton.waitFor({ state: 'visible', timeout: 2000 });
      await confirmButton.click();
    } catch {
      // No confirmation dialog present, continue
    }
  }

  /**
   * Check if a provider is connected
   */
  async isProviderConnected(provider: OAuthProvider): Promise<boolean> {
    try {
      const status = this.getConnectionStatus(provider);
      await status.waitFor({ state: 'visible', timeout: 2000 });
      const text = await status.textContent();
      return text?.toLowerCase().includes('connected') || false;
    } catch {
      // If status element not found, check if disconnect button exists
      try {
        const disconnectBtn = this.getDisconnectButton(provider);
        await disconnectBtn.waitFor({ state: 'visible', timeout: 2000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Wait for success message to appear
   */
  async waitForSuccess(): Promise<string | null> {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
      return this.successMessage.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Wait for error message to appear
   */
  async waitForError(): Promise<string | null> {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
      return this.errorMessage.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Get error from URL query parameters
   */
  async getErrorFromUrl(): Promise<string | null> {
    const url = new URL(this.page.url());
    return url.searchParams.get('error');
  }

  /**
   * Get success message from URL query parameters
   */
  async getSuccessFromUrl(): Promise<string | null> {
    const url = new URL(this.page.url());
    return url.searchParams.get('success');
  }

  /**
   * Check if page is loaded
   */
  async isLoaded(): Promise<boolean> {
    try {
      await this.pageHeading.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all connected providers
   */
  async getConnectedProviders(): Promise<OAuthProvider[]> {
    const providers: OAuthProvider[] = ['google', 'linkedin', 'meta', 'twitter'];
    const connected: OAuthProvider[] = [];

    for (const provider of providers) {
      if (await this.isProviderConnected(provider)) {
        connected.push(provider);
      }
    }

    return connected;
  }

  /**
   * Wait for connection to be established
   */
  async waitForConnection(provider: OAuthProvider, timeout = 10000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await this.isProviderConnected(provider)) {
        return true;
      }
      await this.page.waitForTimeout(500);
    }

    return false;
  }

  /**
   * Wait for disconnection to be complete
   */
  async waitForDisconnection(provider: OAuthProvider, timeout = 10000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (!(await this.isProviderConnected(provider))) {
        return true;
      }
      await this.page.waitForTimeout(500);
    }

    return false;
  }
}
