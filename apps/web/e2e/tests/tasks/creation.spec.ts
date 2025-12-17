import { test, expect } from '../../fixtures/auth.fixture';
import { DashboardPage } from '../../pages/dashboard.page';

test.describe('Task Creation', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
  });

  test('should display task creation button', async ({ authenticatedPage }) => {
    await dashboardPage.navigateTo('tasks');

    // Should see create task button
    await expect(
      authenticatedPage.locator('button:has-text("Create"), a:has-text("New Task")')
    ).toBeVisible();
  });

  test('should open task creation form', async ({ authenticatedPage }) => {
    await dashboardPage.navigateTo('tasks');

    // Click create button
    await authenticatedPage.click('button:has-text("Create"), a:has-text("New Task")');

    // Should see task form
    await expect(authenticatedPage.locator('input[name="title"], input[id="title"]')).toBeVisible();
  });

  test('should require campaign selection', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/tasks/new');

    // Try to submit without selecting campaign
    await authenticatedPage.click('button[type="submit"]');

    // Should show validation error
    const errorMessage = authenticatedPage.locator('.text-destructive, [data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
  });

  test('should create task successfully', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/tasks/new');

    // Fill in task details (assuming test campaign exists)
    await authenticatedPage.selectOption('select[name="campaign_id"]', { index: 1 });
    await authenticatedPage.fill('input[name="title"]', 'E2E Test Task');
    await authenticatedPage.selectOption('select[name="type"]', 'blog_post');

    // Submit form
    await authenticatedPage.click('button[type="submit"]');

    // Should redirect to task detail page or task list
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/tasks/);
  });

  test('should show task in task list after creation', async ({ authenticatedPage }) => {
    // Create a task first
    await authenticatedPage.goto('/dashboard/tasks/new');
    const taskTitle = `E2E Test Task ${Date.now()}`;

    await authenticatedPage.selectOption('select[name="campaign_id"]', { index: 1 });
    await authenticatedPage.fill('input[name="title"]', taskTitle);
    await authenticatedPage.selectOption('select[name="type"]', 'blog_post');
    await authenticatedPage.click('button[type="submit"]');

    // Navigate to task list
    await authenticatedPage.goto('/dashboard/tasks');

    // Should see the created task
    await expect(authenticatedPage.locator(`text="${taskTitle}"`)).toBeVisible();
  });
});

test.describe('Task Types', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/tasks/new');
  });

  test('should show blog post options', async ({ authenticatedPage }) => {
    await authenticatedPage.selectOption('select[name="type"]', 'blog_post');

    // Should show blog-specific fields
    await expect(
      authenticatedPage.locator('input[name="word_count"], select[name="tone"]')
    ).toBeVisible();
  });

  test('should show email options', async ({ authenticatedPage }) => {
    await authenticatedPage.selectOption('select[name="type"]', 'email');

    // Should show email-specific fields
    await expect(
      authenticatedPage.locator('input[name="subject"], select[name="email_type"]')
    ).toBeVisible();
  });

  test('should show social post options', async ({ authenticatedPage }) => {
    await authenticatedPage.selectOption('select[name="type"]', 'social_post');

    // Should show social-specific fields
    await expect(
      authenticatedPage.locator('select[name="platform"], input[name="hashtags"]')
    ).toBeVisible();
  });
});
