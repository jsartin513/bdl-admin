import { expect, test } from '@playwright/test';
import { applyAdminSession, requirePreviewAdminCredentials } from './helpers/admin-session';

test.describe('league admin on stable preview', () => {
  test.beforeEach(async ({ context }) => {
    const creds = requirePreviewAdminCredentials();
    const baseUrl = test.info().project.use.baseURL;
    if (!baseUrl) throw new Error('PLAYWRIGHT_BASE_URL / baseURL is required');
    await applyAdminSession(context, baseUrl, creds.email, creds.secret);
  });

  test('session api accepts minted cookie', async ({ context }) => {
    const creds = requirePreviewAdminCredentials();
    const response = await context.request.get('/api/admin/session');
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { authenticated?: boolean; email?: string };
    expect(body.authenticated).toBe(true);
    expect(body.email?.toLowerCase()).toBe(creds.email.toLowerCase());
  });

  test('players page loads without login redirect', async ({ page }) => {
    await page.goto('/players');
    await expect(page).toHaveURL(/\/players/);
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('link', { name: 'Sign in with Google' })).toHaveCount(0);
  });
});
