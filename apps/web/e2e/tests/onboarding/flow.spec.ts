import { test, expect } from '@playwright/test';
import { OnboardingPage } from '../../pages/onboarding.page';

test.describe('Onboarding Flow', () => {
  let onboardingPage: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    // Login first (assuming test user exists but hasn't completed onboarding)
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_NEW_USER_EMAIL || 'newuser@example.com');
    await page.fill('input[type="password"]', process.env.TEST_NEW_USER_PASSWORD || 'newuserpassword123');
    await page.click('button[type="submit"]');

    // Wait for redirect to onboarding
    await page.waitForURL(/\/onboarding\//);

    onboardingPage = new OnboardingPage(page);
  });

  test('should start at welcome step', async ({ page }) => {
    expect(await onboardingPage.isOnStep('welcome')).toBe(true);
    await expect(onboardingPage.card).toBeVisible();
  });

  test('should progress from welcome to organization step', async ({ page }) => {
    await onboardingPage.goto('welcome');
    await onboardingPage.clickContinue();
    expect(await onboardingPage.isOnStep('organization')).toBe(true);
  });

  test('should require organization name', async ({ page }) => {
    await onboardingPage.goto('organization');

    // Try to continue without entering name
    await onboardingPage.clickContinue();

    // Should show error or stay on page
    expect(await onboardingPage.isOnStep('organization')).toBe(true);
  });

  test('should progress from organization to product step', async ({ page }) => {
    await onboardingPage.goto('organization');
    await onboardingPage.fillOrganizationName('Test Organization');
    await onboardingPage.clickContinue();

    // Should progress to product step
    expect(await onboardingPage.isOnStep('product')).toBe(true);
  });

  test('should require product name', async ({ page }) => {
    await onboardingPage.goto('product');

    // Try to continue without entering name
    await onboardingPage.clickContinue();

    // Should show error or stay on page
    expect(await onboardingPage.isOnStep('product')).toBe(true);
  });

  test('should allow skipping connector step', async ({ page }) => {
    await onboardingPage.goto('connector');
    await onboardingPage.clickSkip();

    // Should progress to campaign step
    expect(await onboardingPage.isOnStep('campaign')).toBe(true);
  });

  test('should allow skipping campaign step', async ({ page }) => {
    await onboardingPage.goto('campaign');
    await onboardingPage.clickSkip();

    // Should progress to complete step
    expect(await onboardingPage.isOnStep('complete')).toBe(true);
  });

  test('should show completion message at end', async ({ page }) => {
    await onboardingPage.goto('complete');

    // Should show completion content
    await expect(page.locator('text=All Set')).toBeVisible();
    await expect(page.locator('button:has-text("Dashboard")')).toBeVisible();
  });

  test('should redirect to dashboard after completion', async ({ page }) => {
    await onboardingPage.goto('complete');
    await onboardingPage.goToDashboard();

    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Onboarding Flow - Complete Path', () => {
  test('should complete full onboarding flow', async ({ page }) => {
    // This is a full integration test that goes through all steps

    // Login with a fresh user
    await page.goto('/login');
    await page.fill('input[type="email"]', `fresh-${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'freshpassword123');
    await page.click('button[type="submit"]');

    const onboardingPage = new OnboardingPage(page);

    // Wait for onboarding
    await page.waitForURL(/\/onboarding\//, { timeout: 10000 });

    // Step 1: Welcome
    if (await onboardingPage.isOnStep('welcome')) {
      await onboardingPage.clickContinue();
    }

    // Step 2: Organization
    if (await onboardingPage.isOnStep('organization')) {
      await onboardingPage.fillOrganizationName('E2E Test Organization');
      await onboardingPage.clickContinue();
    }

    // Step 3: Product
    if (await onboardingPage.isOnStep('product')) {
      await onboardingPage.fillProductName('E2E Test Product');
      await onboardingPage.clickContinue();
    }

    // Step 4: Connector (skip)
    if (await onboardingPage.isOnStep('connector')) {
      await onboardingPage.clickSkip();
    }

    // Step 5: Campaign (skip)
    if (await onboardingPage.isOnStep('campaign')) {
      await onboardingPage.clickSkip();
    }

    // Step 6: Complete
    expect(await onboardingPage.isComplete()).toBe(true);

    // Go to dashboard
    await onboardingPage.goToDashboard();
    await expect(page).toHaveURL('/dashboard');
  });
});
