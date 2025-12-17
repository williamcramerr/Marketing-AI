import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Test user credentials for E2E tests
 * These should be seeded in your test database
 */
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
};

export const TEST_ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@example.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'adminpassword123',
};

/**
 * Custom fixture that provides authenticated page
 */
export interface AuthFixtures {
  authenticatedPage: Page;
  adminPage: Page;
}

/**
 * Login helper function
 */
export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');

  // Wait for the login form to be visible
  await page.waitForSelector('input[type="email"]', { state: 'visible' });

  // Fill in credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for navigation to complete (either dashboard or onboarding)
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 });
}

/**
 * Logout helper function
 */
export async function logout(page: Page): Promise<void> {
  // Click on user menu
  await page.click('[data-testid="user-menu"]');

  // Click logout
  await page.click('[data-testid="logout-button"]');

  // Wait for redirect to login
  await page.waitForURL('/login');
}

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await use(page);
  },

  adminPage: async ({ page }, use) => {
    await login(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await use(page);
  },
});

export { expect };
