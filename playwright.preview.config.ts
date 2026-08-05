import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, '') ||
  'https://admin-preview.bostondodgeballleague.com';

/**
 * Authenticated e2e against the stable preview host.
 * Mint admin_session via e2e/helpers/admin-session.ts — do not automate Google.
 * See bdl-packages/admin-auth/AGENTS.md.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/admin-preview.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
