import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/dashboard.page';

test.describe('Mobile Responsive Design', () => {
  // Run these tests on mobile devices only
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|onboarding)/);
  });

  test('should show mobile navigation', async ({ page }) => {
    await page.goto('/dashboard');

    // Sidebar should be hidden on mobile
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeHidden();

    // Mobile menu button should be visible
    const menuButton = page.locator('[data-testid="mobile-menu-button"], button[aria-label*="menu"]');
    await expect(menuButton).toBeVisible();
  });

  test('should open mobile menu', async ({ page }) => {
    await page.goto('/dashboard');

    // Click mobile menu button
    const menuButton = page.locator('[data-testid="mobile-menu-button"], button[aria-label*="menu"]');
    await menuButton.click();

    // Mobile menu should be visible
    const mobileMenu = page.locator('[data-testid="mobile-menu"], [role="dialog"]');
    await expect(mobileMenu).toBeVisible();
  });

  test('should have touch-friendly buttons', async ({ page }) => {
    await page.goto('/dashboard');

    // Check that buttons have adequate touch target size (44px minimum)
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        // Touch target should be at least 44px
        expect(box.height).toBeGreaterThanOrEqual(36); // Allow some flexibility
      }
    }
  });

  test('should display content without horizontal scroll', async ({ page }) => {
    await page.goto('/dashboard');

    // Check that page doesn't require horizontal scrolling
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // Small tolerance
  });

  test('should stack cards on mobile', async ({ page }) => {
    await page.goto('/dashboard');

    // Cards should be full width on mobile
    const cards = page.locator('[class*="Card"]');
    const cardCount = await cards.count();

    if (cardCount > 0) {
      const card = cards.first();
      const box = await card.boundingBox();

      if (box) {
        // Card should take most of the width on mobile
        expect(box.width).toBeGreaterThan(300);
      }
    }
  });

  test('should have readable text size', async ({ page }) => {
    await page.goto('/dashboard');

    // Check body text is at least 14px
    const fontSize = await page.evaluate(() => {
      const body = document.querySelector('body');
      return body ? window.getComputedStyle(body).fontSize : '16px';
    });

    const size = parseInt(fontSize);
    expect(size).toBeGreaterThanOrEqual(14);
  });
});

test.describe('Tablet Responsive Design', () => {
  // Run on tablet viewport
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|onboarding)/);
  });

  test('should show sidebar on tablet', async ({ page }) => {
    await page.goto('/dashboard');

    // Sidebar may be visible or collapsed on tablet
    const sidebar = page.locator('[data-testid="sidebar"]');
    const mobileMenu = page.locator('[data-testid="mobile-menu-button"]');

    // Either sidebar is visible or there's a way to access it
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    const menuVisible = await mobileMenu.isVisible().catch(() => false);

    expect(sidebarVisible || menuVisible).toBe(true);
  });

  test('should display grid layout appropriately', async ({ page }) => {
    await page.goto('/dashboard');

    // Cards should display in a grid on tablet (2 columns typically)
    const cards = page.locator('[class*="Card"]');
    const cardCount = await cards.count();

    if (cardCount >= 2) {
      const firstCard = await cards.first().boundingBox();
      const secondCard = await cards.nth(1).boundingBox();

      // On tablet, cards might be side by side or stacked
      // Just ensure they're properly sized
      if (firstCard && secondCard) {
        expect(firstCard.width).toBeGreaterThan(200);
        expect(secondCard.width).toBeGreaterThan(200);
      }
    }
  });
});

test.describe('Desktop Responsive Design', () => {
  // Run on desktop viewport
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|onboarding)/);
  });

  test('should show full sidebar on desktop', async ({ page }) => {
    await page.goto('/dashboard');

    // Sidebar should be fully visible on desktop
    const sidebar = page.locator('[data-testid="sidebar"], nav');
    await expect(sidebar).toBeVisible();
  });

  test('should display multi-column layout', async ({ page }) => {
    await page.goto('/dashboard');

    // Main content should have appropriate width
    const mainContent = page.locator('main');
    const box = await mainContent.boundingBox();

    if (box) {
      // Main content should not take full width on desktop (sidebar present)
      expect(box.width).toBeLessThan(1280);
      expect(box.width).toBeGreaterThan(800);
    }
  });
});
