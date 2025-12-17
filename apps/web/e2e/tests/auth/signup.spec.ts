import { test, expect } from '@playwright/test';

test.describe('Signup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('should display signup form', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('input[type="email"]')).toHaveAttribute('aria-invalid', 'true');
  });

  test('should show error for weak password', async ({ page }) => {
    await page.fill('input[type="email"]', 'newuser@example.com');
    await page.fill('input[type="password"]', '123'); // Too short
    await page.click('button[type="submit"]');

    // Should show password error
    const errorMessage = page.locator('.text-destructive, [data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalidemail');
    await page.fill('input[type="password"]', 'ValidPassword123!');
    await page.click('button[type="submit"]');

    // Should show email error
    await expect(page.locator('input[type="email"]')).toHaveAttribute('aria-invalid', 'true');
  });

  test('should navigate to login page', async ({ page }) => {
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');
  });

  test('should signup successfully with valid credentials', async ({ page }) => {
    // Generate unique email for test
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', 'ValidPassword123!');
    await page.click('button[type="submit"]');

    // Should either go to email verification or onboarding
    await page.waitForURL(/\/(verify-email|onboarding|dashboard)/, { timeout: 10000 });
  });

  test('should show error for existing email', async ({ page }) => {
    // Try to signup with an existing test user email
    const existingEmail = process.env.TEST_USER_EMAIL || 'test@example.com';

    await page.fill('input[type="email"]', existingEmail);
    await page.fill('input[type="password"]', 'ValidPassword123!');
    await page.click('button[type="submit"]');

    // Should show error about existing account
    const errorMessage = page.locator('.text-destructive, [data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});
