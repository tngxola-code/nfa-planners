import { test, expect } from '@playwright/test';

test.describe('NFA Console authentication', () => {
  test('unauthenticated user cannot access dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/);
  });

  test('invalid credentials remain on login', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('wrong-password');

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('valid administrator can log in and reach dashboard', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;

    test.skip(!email || !password, 'E2E admin credentials not configured');

    await page.goto('/login');

    await page.getByLabel(/email/i).fill(email!);
    await page.getByRole('textbox', { name: 'Password' }).fill(password!);

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();
  });

  test('authenticated dashboard survives refresh', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;

    test.skip(!email || !password, 'E2E admin credentials not configured');

    await page.goto('/login');

    await page.getByLabel(/email/i).fill(email!);
    await page.getByRole('textbox', { name: 'Password' }).fill(password!);

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.reload();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();
  });

  test('logged-in user can sign out and protected route is blocked', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;

    test.skip(!email || !password, 'E2E admin credentials not configured');

    await page.goto('/login');

    await page.getByLabel(/email/i).fill(email!);
    await page.getByRole('textbox', { name: 'Password' }).fill(password!);

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('button', { name: /sign out/i }).click();

    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/);
  });
});
