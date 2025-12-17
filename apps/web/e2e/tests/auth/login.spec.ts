import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('should display login form', async ({ page }) => {
    expect(await loginPage.isLoaded()).toBe(true);
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await loginPage.login('invalid@example.com', 'wrongpassword');

    // Wait for error message
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
  });

  test('should show error for empty email', async ({ page }) => {
    await loginPage.passwordInput.fill('password123');
    await loginPage.submitButton.click();

    // Email field should show validation error
    await expect(loginPage.emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('should show error for empty password', async ({ page }) => {
    await loginPage.emailInput.fill('test@example.com');
    await loginPage.submitButton.click();

    // Password field should show validation error
    await expect(loginPage.passwordInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('should navigate to signup page', async ({ page }) => {
    await loginPage.signupLink.click();
    await expect(page).toHaveURL('/signup');
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await loginPage.forgotPasswordLink.click();
    await expect(page).toHaveURL('/forgot-password');
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    // This test requires a seeded test user
    const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';

    await loginPage.login(testEmail, testPassword);

    // Should redirect to dashboard or onboarding
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test('should persist session after refresh', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';

    await loginPage.login(testEmail, testPassword);
    await page.waitForURL(/\/(dashboard|onboarding)/);

    // Refresh the page
    await page.reload();

    // Should still be logged in
    await expect(page).not.toHaveURL('/login');
  });
});
