import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for Dashboard
 */
export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly header: Locator;
  readonly userMenu: Locator;
  readonly mainContent: Locator;
  readonly navLinks: {
    dashboard: Locator;
    campaigns: Locator;
    tasks: Locator;
    products: Locator;
    connectors: Locator;
    settings: Locator;
  };

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-testid="sidebar"], nav');
    this.header = page.locator('[data-testid="header"], header');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.mainContent = page.locator('main');
    this.navLinks = {
      dashboard: page.locator('a[href="/dashboard"]'),
      campaigns: page.locator('a[href*="/campaigns"]'),
      tasks: page.locator('a[href*="/tasks"]'),
      products: page.locator('a[href*="/products"]'),
      connectors: page.locator('a[href*="/connectors"]'),
      settings: page.locator('a[href*="/settings"]'),
    };
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async isLoaded(): Promise<boolean> {
    try {
      await this.mainContent.waitFor({ state: 'visible', timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  async navigateTo(section: keyof typeof this.navLinks) {
    await this.navLinks[section].click();
    await this.page.waitForLoadState('networkidle');
  }

  async openUserMenu() {
    await this.userMenu.click();
  }

  async logout() {
    await this.openUserMenu();
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('/login');
  }

  async getPageTitle(): Promise<string | null> {
    const heading = this.mainContent.locator('h1').first();
    return heading.textContent();
  }

  async isSidebarVisible(): Promise<boolean> {
    return this.sidebar.isVisible();
  }

  async isHeaderVisible(): Promise<boolean> {
    return this.header.isVisible();
  }
}
