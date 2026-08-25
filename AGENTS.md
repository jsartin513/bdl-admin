# BDL League Admin — agent notes

## Preview Playwright auth

Authenticated e2e against **stable preview** must mint the `admin_session` cookie — do **not** automate Google login or rely on local `getDevBypassAdminSession` (that only applies when `NODE_ENV=development`).

- Stable host: `https://admin-preview.bostondodgeballleague.com`
- Run: `npm run test:e2e:preview` (config: `playwright.preview.config.ts`)
- Helper: `e2e/helpers/admin-session.ts`
- CI: `.github/workflows/e2e-preview.yml` on push to `preview` (secrets: `ADMIN_SESSION_SECRET`, `E2E_ADMIN_EMAIL`)
- Auth env / OAuth redirect URIs: [`.cursor/players-and-auth-runbook.md`](.cursor/players-and-auth-runbook.md)
- Full per-repo checklist: [`bdl-packages/admin-auth/AGENTS.md`](https://github.com/jsartin513/bdl-packages/blob/main/admin-auth/AGENTS.md)

HTTP **preview smoke** (`npm run smoke:preview`) still checks unauthenticated redirects; Playwright covers authenticated gated routes.
