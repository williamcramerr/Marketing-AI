import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for Onboarding flow
 */
export class OnboardingPage {
  readonly page: Page;
  readonly header: Locator;
  readonly stepIndicator: Locator;
  readonly card: Locator;
  readonly continueButton: Locator;
  readonly skipButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator('header');
    this.stepIndicator = page.locator('[data-testid="step-indicator"]');
    this.card = page.locator('[class*="Card"]');
    this.continueButton = page.locator('button:has-text("Continue"), button:has-text("Get Started")');
    this.skipButton = page.locator('button:has-text("Skip")');
  }

  async goto(step: string = 'welcome') {
    await this.page.goto(`/onboarding/${step}`);
    await this.page.waitForLoadState('networkidle');
  }

  async isOnStep(step: string): Promise<boolean> {
    return this.page.url().includes(`/onboarding/${step}`);
  }

  async clickContinue() {
    await this.continueButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickSkip() {
    await this.skipButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async getCurrentStep(): Promise<string> {
    const url = this.page.url();
    const match = url.match(/\/onboarding\/([^/?]+)/);
    return match ? match[1] : '';
  }

  async fillOrganizationName(name: string) {
    await this.page.fill('input[id="name"]', name);
  }

  async fillProductName(name: string) {
    await this.page.fill('input[id="name"]', name);
  }

  async fillProductDescription(description: string) {
    await this.page.fill('textarea[id="description"]', description);
  }

  async fillCampaignName(name: string) {
    await this.page.fill('input[id="name"]', name);
  }

  async selectCampaignGoal(goal: string) {
    await this.page.click('[data-testid="goal-select"]');
    await this.page.click(`[data-value="${goal}"]`);
  }

  async isComplete(): Promise<boolean> {
    return this.page.url().includes('/onboarding/complete');
  }

  async goToDashboard() {
    await this.page.click('button:has-text("Go to Dashboard")');
    await this.page.waitForURL('/dashboard');
  }
}
