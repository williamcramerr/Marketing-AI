import type { Page } from '@playwright/test';

/**
 * Mobile Testing Utilities
 */

/**
 * Device presets for mobile testing
 */
export const DEVICES = {
  // iOS devices
  iPhoneSE: { width: 375, height: 667, deviceScaleFactor: 2 },
  iPhone12: { width: 390, height: 844, deviceScaleFactor: 3 },
  iPhone13ProMax: { width: 428, height: 926, deviceScaleFactor: 3 },

  // Android devices
  pixel5: { width: 393, height: 851, deviceScaleFactor: 2.75 },
  samsungS21: { width: 360, height: 800, deviceScaleFactor: 3 },

  // Tablets
  iPadMini: { width: 768, height: 1024, deviceScaleFactor: 2 },
  iPadPro11: { width: 834, height: 1194, deviceScaleFactor: 2 },
  iPadPro12: { width: 1024, height: 1366, deviceScaleFactor: 2 },
};

/**
 * Minimum touch target size (Apple HIG recommends 44px)
 */
export const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * Check if an element has adequate touch target size
 */
export async function checkTouchTargetSize(
  page: Page,
  selector: string
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  const elements = page.locator(selector);
  const count = await elements.count();

  for (let i = 0; i < count; i++) {
    const element = elements.nth(i);
    const box = await element.boundingBox();

    if (box) {
      if (box.width < MIN_TOUCH_TARGET_SIZE) {
        issues.push(
          `Element ${i} has width ${box.width}px (minimum: ${MIN_TOUCH_TARGET_SIZE}px)`
        );
      }
      if (box.height < MIN_TOUCH_TARGET_SIZE) {
        issues.push(
          `Element ${i} has height ${box.height}px (minimum: ${MIN_TOUCH_TARGET_SIZE}px)`
        );
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Check if page has horizontal scroll (indicates responsive issues)
 */
export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const clientWidth = await page.evaluate(() => document.body.clientWidth);
  return scrollWidth > clientWidth + 5; // 5px tolerance
}

/**
 * Get computed font size for an element
 */
export async function getFontSize(page: Page, selector: string): Promise<number> {
  const fontSize = await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return 16;
    return parseFloat(window.getComputedStyle(element).fontSize);
  }, selector);

  return fontSize;
}

/**
 * Check if minimum font size requirement is met
 */
export async function checkMinimumFontSize(
  page: Page,
  minSize: number = 14
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Check body text
  const bodySize = await getFontSize(page, 'body');
  if (bodySize < minSize) {
    issues.push(`Body text size ${bodySize}px is below minimum ${minSize}px`);
  }

  // Check paragraphs
  const pSize = await getFontSize(page, 'p');
  if (pSize < minSize) {
    issues.push(`Paragraph text size ${pSize}px is below minimum ${minSize}px`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Simulate touch gestures
 */
export async function swipeLeft(page: Page, startX: number, y: number): Promise<void> {
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 200, y, { steps: 10 });
  await page.mouse.up();
}

export async function swipeRight(page: Page, startX: number, y: number): Promise<void> {
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 200, y, { steps: 10 });
  await page.mouse.up();
}

export async function swipeUp(page: Page, x: number, startY: number): Promise<void> {
  await page.mouse.move(x, startY);
  await page.mouse.down();
  await page.mouse.move(x, startY - 200, { steps: 10 });
  await page.mouse.up();
}

export async function swipeDown(page: Page, x: number, startY: number): Promise<void> {
  await page.mouse.move(x, startY);
  await page.mouse.down();
  await page.mouse.move(x, startY + 200, { steps: 10 });
  await page.mouse.up();
}

/**
 * Check viewport meta tag for mobile optimization
 */
export async function checkViewportMeta(page: Page): Promise<{
  valid: boolean;
  content: string | null;
}> {
  const viewportContent = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    return meta?.getAttribute('content') || null;
  });

  // Should include width=device-width and initial-scale
  const valid =
    viewportContent !== null &&
    viewportContent.includes('width=device-width') &&
    viewportContent.includes('initial-scale');

  return { valid, content: viewportContent };
}

/**
 * Check for common mobile accessibility issues
 */
export async function checkMobileAccessibility(page: Page): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check viewport
  const viewport = await checkViewportMeta(page);
  if (!viewport.valid) {
    issues.push('Missing or invalid viewport meta tag');
  }

  // Check horizontal scroll
  if (await hasHorizontalScroll(page)) {
    issues.push('Page has horizontal scroll on mobile');
  }

  // Check font sizes
  const fontCheck = await checkMinimumFontSize(page);
  issues.push(...fontCheck.issues);

  // Check touch targets for buttons
  const touchCheck = await checkTouchTargetSize(page, 'button, a[href], input[type="submit"]');
  issues.push(...touchCheck.issues);

  return { valid: issues.length === 0, issues };
}
