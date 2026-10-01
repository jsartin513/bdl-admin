# Go-live checklist — scheduled comms + Oct 2026 preview promote

Track production promotion for **scheduled communications** (admin + website) and related preview work. Update this file as items complete.

**Promotion PRs (preview → main):**

- [bdl-admin #170](https://github.com/jsartin513/bdl-admin/pull/170)
- [bdl-website #28](https://github.com/jsartin513/bdl-website/pull/28)

---

## Done (preview)

- [x] Feature merged to `preview`: scheduled comms (admin #164), news `publishedAt` (website #26)
- [x] Preview Neon: admin operational migrations through `0029_publish_schedule_fields` (incl. `0027_scheduled_actions`)
- [x] Preview Neon: website `db:migrate:deploy` (no new SQL in website release)
- [x] `CRON_SECRET` on admin Vercel Preview + Production (plain/non-sensitive for now)
- [x] Promotion PRs opened; CI green on both

---

## Before / during merge to production

- [ ] Merge **website #28** and **admin #170** (order: website first if you want `publishedAt` live before admin schedules prod publishes)
- [ ] Confirm production Vercel build logs show `[db:migrate:deploy] Applying` on **admin** (operational DB)
- [ ] Copy preview-tested env to **Production** where missing: `PUBLISH_API_SECRET`, `WEBSITE_PUBLISH_URL`, `PUBLIC_WEBSITE_URL`, paired website secret

---

## After production deploy

### Scheduled comms

- [ ] Configure **external cron** (GitHub Action, cron-job.org, etc.) to `POST https://admin.bostondodgeballleague.com/api/cron/dispatch-scheduled` every 5 minutes with `Authorization: Bearer <CRON_SECRET>` (Hobby has no `vercel.json` cron)
- [ ] Smoke: schedule a test publish on admin prod with future news `publishedAt`; confirm www prod hides until time
- [ ] Smoke: schedule contact to self (or `CONTACT_DRY_RUN` first) and confirm `/scheduled` + dispatch

### Player app (shipped in same admin promote — separate track)

- [ ] `SENSITIVE_DATABASE_URL` on production + apply `drizzle-sensitive/0000_sensitive_player_data.sql` if not done ([player-app-migrations.md](./player-app-migrations.md))
- [ ] `PLAYER_APP_BASE_URL` production value
- [ ] Follow-up engineering (not blocking merge): unique index on `players.player_app_account_id`, audit trail for `player-app-sync` patches ([player-app-kickoff-progress.md](./player-app-kickoff-progress.md))

### Standard prod checks

- [ ] Google OAuth callback: `https://admin.bostondodgeballleague.com/api/admin/google/callback`
- [ ] Twilio webhook: `https://admin.bostondodgeballleague.com/api/webhooks/twilio/messaging`
- [ ] `NEXT_PUBLIC_APP_URL` matches production host (admin + website)
- [ ] Post-merge smoke: admin `/login`, `/players`, `/events`, `/scheduled`; website `/news`

---

## Known limits (documented, not launch blockers)

- Cron dispatcher processes up to **5** due actions per run (60s Hobby cap); large contact jobs may need smaller batches or a worker later.
- `social_reminder` rows are only created by the publish dispatcher, not via `POST /api/scheduled`.
- Social kit reminder email failure does not fail the publish action (logged only).

---

## Related docs

- [integrations-setup.md](./integrations-setup.md) — Twilio, Resend, publish secrets
- [scheduled-comms-design.md](./scheduled-comms-design.md) — architecture and test ideas
- [setup-and-capabilities.md](./setup-and-capabilities.md) — env matrix
