# Go-live checklist — scheduled comms + Oct 2026 promote

Track production rollout for **scheduled communications** (admin + website) and related work. Update this file as items complete.

**Production promote (merged):**

- [bdl-admin #170](https://github.com/jsartin513/bdl-admin/pull/170) — merged to `main`
- [bdl-website #28](https://github.com/jsartin513/bdl-website/pull/28) — merged to `main`

---

## Done

- [x] Features on `preview` then promoted: scheduled comms (admin), news `publishedAt` (website)
- [x] Preview Neon: admin operational migrations through `0029_publish_schedule_fields` (incl. `0027_scheduled_actions`)
- [x] Preview Neon: website `db:migrate:deploy` (no new SQL in website release)
- [x] `CRON_SECRET` on admin Vercel Preview + Production
- [x] Promotion PRs merged to `main` (Oct 2026)

---

## Still open — scheduled comms dispatcher

Scheduled sends **do not run** until something calls the dispatcher on a schedule.

### Planned: Vercel Cron (preferred)

We are **not** using GitHub Actions for this (private-repo Actions minutes). **Hobby** blocked sub-daily `crons` in `vercel.json` during preview deploys; use **Vercel Cron when the project is on a plan that supports it** (typically Pro).

- [ ] Upgrade **bdl-admin** on Vercel when ready (or confirm current plan allows `*/5 * * * *` crons)
- [ ] Restore `vercel.json` cron (example):

  ```json
  "crons": [
    {
      "path": "/api/cron/dispatch-scheduled",
      "schedule": "*/5 * * * *"
    }
  ]
  ```

- [ ] Keep `CRON_SECRET` set on Production (and Preview); Vercel cron requests should send `Authorization: Bearer <CRON_SECRET>` (see [scheduled-comms-design.md](./scheduled-comms-design.md) / `authorizeCron`)
- [ ] Deploy **production** and confirm cron appears under Vercel → Project → **Cron Jobs**
- [ ] Smoke: row on `/scheduled` moves to completed after `run_at`

Until the above is done, use a **temporary** external ping (manual `curl`, cron-job.org, etc.) only if you need dispatch before Vercel Cron is enabled—not GitHub Actions on a schedule.

### Smoke (after dispatcher runs on prod)

- [ ] Schedule a test publish with future news `publishedAt`; confirm www prod hides until time
- [ ] Schedule contact to self (or `CONTACT_DRY_RUN` on preview first) and confirm `/scheduled` + dispatch

---

## Player app (same admin promote — separate track)

- [ ] `SENSITIVE_DATABASE_URL` on production + apply `drizzle-sensitive/0000_sensitive_player_data.sql` if not done ([player-app-migrations.md](./player-app-migrations.md))
- [ ] `PLAYER_APP_BASE_URL` production value
- [ ] Follow-up engineering: unique index on `players.player_app_account_id`, audit trail for `player-app-sync` ([player-app-kickoff-progress.md](./player-app-kickoff-progress.md))

---

## Standard prod checks

- [ ] Production build log: admin `[db:migrate:deploy]` succeeded
- [ ] `PUBLISH_API_SECRET` / `WEBSITE_PUBLISH_URL` / website publish secret aligned on prod
- [ ] Google OAuth: `https://admin.bostondodgeballleague.com/api/admin/google/callback`
- [ ] Twilio webhook: `https://admin.bostondodgeballleague.com/api/webhooks/twilio/messaging`
- [ ] `NEXT_PUBLIC_APP_URL` matches production host (admin + website)
- [ ] Smoke: admin `/login`, `/players`, `/events`, `/scheduled`; website `/news`

---

## Known limits

- Dispatcher processes up to **5** due actions per run (60s Hobby `maxDuration` on the cron route).
- `social_reminder` is not creatable via `POST /api/scheduled` (only from publish dispatch).
- Social kit reminder email failure does not fail the publish action (logged only).

---

## Related docs

- [integrations-setup.md](./integrations-setup.md)
- [scheduled-comms-design.md](./scheduled-comms-design.md)
- [setup-and-capabilities.md](./setup-and-capabilities.md)
