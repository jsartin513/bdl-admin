---
name: bdl-admin-preview-to-main
description: >-
  Promotes the BDL Admin stable preview branch to production by opening and
  shipping a preview → main pull request. Use when the user asks to ship live,
  promote to production, promote preview to main, release production, or open a
  preview-to-main PR.
---

# BDL Admin — preview → main (production promotion)

## When to use

Ship **`preview`** (stable admin preview) to **`main`** (production). Only after features were merged to `preview`, exercised on `admin-preview.bostondodgeballleague.com`, and CI (including Preview smoke) is green.

Do **not** use this for day-to-day feature work — open feature PRs against **`preview`** first (see [`.github/pull_request_template.md`](../../../.github/pull_request_template.md) and deploy flow in [`.cursor/players-and-auth-runbook.md`](../../players-and-auth-runbook.md)).

## Related docs

- Deploy + auth env: [`.cursor/players-and-auth-runbook.md`](../../players-and-auth-runbook.md)
- Video Tools + Fly worker: [`.cursor/video-tools-runbook.md`](../../video-tools-runbook.md)
- Vercel Git integration: [`README.md`](../../../README.md)
- PR template: [`.github/pull_request_template.md`](../../../.github/pull_request_template.md)

| Environment | URL | Git branch |
|-------------|-----|------------|
| Preview (stable) | https://admin-preview.bostondodgeballleague.com | `preview` |
| Production | https://admin.bostondodgeballleague.com | `main` |

Host: **Vercel** (Next.js admin app). Video merge worker: **Fly.io** app `bdl-video-merge` (separate deploy).

## Pre-flight (before opening the PR)

1. **Sync branches**
   ```bash
   git fetch origin preview main
   git log origin/main..origin/preview --oneline
   git diff --stat origin/main...origin/preview
   ```
2. **Confirm preview is ready**: stable preview deploy exercised; sign in on admin-preview; `/players` and `/events` load. CI **Preview smoke** should be green (or run `npm run smoke:preview` locally).
3. **Scan the diff** for production-only follow-ups:
   - New files under `drizzle/` → migrations run automatically on Vercel **Production** build (`npm run build` → `db:migrate:deploy` when `DATABASE_URL` is set). Confirm `DATABASE_URL` is set for Production in Vercel; no separate manual migrate step unless build-time migrate failed.
   - New env vars → set on Vercel **Production** (and Preview if needed). Common keys: `DATABASE_URL`, `ADMIN_*`, `RESEND_API_KEY`, `TWILIO_*`, `BLOB_READ_WRITE_TOKEN`, `VIDEO_WORKER_SECRET`, `NEXT_PUBLIC_APP_URL`.
   - Google OAuth → prod redirect URI `https://admin.bostondodgeballleague.com/api/admin/google/callback` in Google Cloud console.
   - Twilio contact players → status callback / inbound webhook points at `https://admin.bostondodgeballleague.com/api/webhooks/twilio/messaging` (`NEXT_PUBLIC_APP_URL` must match prod host).
   - Changes under `workers/video-merge/` → after merge to `main`, confirm GitHub Action **Deploy video-merge worker** succeeds; merges stay **queued** until Fly worker is healthy.
   - `VIDEO_WORKER_SECRET` rotation → update **both** Vercel Production and Fly (`fly secrets set … -a bdl-video-merge`).
4. **Check for an existing promotion PR**
   ```bash
   gh pr list --base main --head preview --state open
   ```

## Open the promotion PR

Use **`gh`**. Base **`main`**, head **`preview`**. Follow [`.github/pull_request_template.md`](../../../.github/pull_request_template.md).

```bash
git fetch origin preview main

gh pr create --base main --head preview \
  --title "Promote preview to production" \
  --body "$(cat <<'EOF'
## Base branch

- [x] Production promote: head branch is `preview` and Preview smoke is green

## Summary

Promote tested changes from `preview` (stable admin preview) to `main` (production).

### Included changes
- [Summarize commits: `git log origin/main..origin/preview --oneline`]

## Test plan

- [x] Lint / unit / build CI green on preview
- [x] Preview deployment tested on [admin-preview](https://admin-preview.bostondodgeballleague.com); `/players` + `/events` load (signed in)
- [x] Preview smoke green (`scripts/smoke-preview.mjs` / CI Preview smoke workflow)
- [ ] If changing `workers/video-merge/`: after merge to `main`, confirm Fly deploy workflow succeeds (`bdl-video-merge`)

## Database changes (if applicable)

- [ ] New `drizzle/*.sql` migrations included; Production `DATABASE_URL` set so build-time `db:migrate:deploy` applies them
- [ ] Schema verified on production after deploy

## Third-party / env (if applicable)

- [ ] New Vercel Production env vars set (not Preview-only)
- [ ] Google OAuth prod callback URI configured
- [ ] Twilio webhook URL updated for production host (contact players)
- [ ] `ADMIN_SESSION_SECRET` still matches merch + open-gym if auth shared secrets changed
- [ ] `VIDEO_WORKER_SECRET` matches Fly worker if video-tools worker auth changed

## Additional notes

Post-merge: watch Vercel production deploy, then smoke production (`/login`, `/players`, `/events`). Video Tools: `fly status -a bdl-video-merge` and `fly logs -a bdl-video-merge` if merges were part of this release.
EOF
)"
```

Replace the placeholder bullet list with an accurate summary from `git log` / diff.

## Merge and post-ship

1. Wait for CI on the PR: **Tests** (`npm run lint`, `npm run test:run`, `npm run build`) and **Main merge gate** (head must be `preview` + preview smoke).
2. Merge when approved (user decides timing for live).
3. **After production deploy (Vercel)**
   - Sign in at https://admin.bostondodgeballleague.com; confirm `/players` and `/events`.
   - If migrations shipped, confirm build logs show `[db:migrate:deploy] Applying pending Drizzle migrations` (or run `npm run db:migrate` locally against prod `DATABASE_URL` only if build migrate failed).
   - If `workers/video-merge/` changed: confirm **Deploy video-merge worker** workflow succeeded; `fly status -a bdl-video-merge`; test a merge job if Video Tools was in scope.
4. **Do not** force-push `main` or `preview`.

## PR title convention

Use **`Promote preview to production`** or **`Promote preview to production: <short theme>`** when the release has one obvious headline.
