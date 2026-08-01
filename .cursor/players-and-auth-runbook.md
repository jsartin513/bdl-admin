# Players DB + Google admin auth

## Environment variables

Add these to `.env.local` (local) and Vercel project env (Production / Preview):

```bash
# Google admin auth (same allowlist pattern as bdl-merch / open-gym / concessions)
ADMIN_GOOGLE_CLIENT_ID=
ADMIN_GOOGLE_CLIENT_SECRET=
ADMIN_SESSION_SECRET=          # must match merch + open-gym for cross-app SSO
ADMIN_ALLOWED_EMAILS=a@x.com,b@y.com   # required when VERCEL_ENV=production
NEXT_PUBLIC_APP_URL=http://localhost:3000   # no trailing slash; must match the host users hit

# Neon Postgres (also auto-provisioned via `vercel integration add neon`)
DATABASE_URL=postgresql://...

# Contact players (email via Resend; SMS/WhatsApp via Twilio)
RESEND_API_KEY=
CONTACT_EMAIL_FROM="BDL Events <events@bostondodgeballleague.com>"
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=          # preferred over a raw from-number
TWILIO_FROM_NUMBER=                    # fallback SMS from (E.164)
TWILIO_WHATSAPP_FROM=whatsapp:+1...    # WhatsApp sender if not using Messaging Service alone
TWILIO_WA_TEMPLATE_EVENT_REMINDER=HX…  # Twilio Content SIDs
TWILIO_WA_TEMPLATE_SCHEDULE_CHANGE=HX…
TWILIO_WA_TEMPLATE_ANNOUNCEMENT=HX…
# CONTACT_DRY_RUN=1                    # log sends without calling providers
# TWILIO_SKIP_SIGNATURE_VALIDATE=1     # local webhook testing only
```

Copy `ADMIN_ALLOWED_EMAILS` from bdl-merch so the same board members can sign in.

On production `*.bostondodgeballleague.com` hosts, `admin_session` is set with `Domain=.bostondodgeballleague.com` so League Admin, Merch, and Open Gym share one login. Preview hosts and localhost stay host-only.

| Environment | Host | Git branch | `NEXT_PUBLIC_APP_URL` |
|-------------|------|------------|------------------------|
| Production | `https://admin.bostondodgeballleague.com` | `main` | same origin |
| Preview (stable) | `https://admin-preview.bostondodgeballleague.com` | `preview` | same origin |
| Local | `http://localhost:3000` | — | same origin |

Auth env for the stable preview host is scoped to the **`preview`** Git branch in Vercel.

## Deploy flow

1. Open feature PRs against **`preview`** (not `main`).
2. Merge to `preview` → Vercel deploys `admin-preview.bostondodgeballleague.com`.
3. CI **Preview smoke** waits for that deploy and checks `/login`, `/players`, and `/events` respond (auth redirect or 200). You can also run `npm run smoke:preview` locally.
4. After preview looks good, open **`preview` → `main`**. The **Main merge gate** requires the head branch to be `preview` and re-checks that stable preview is healthy.
5. Merge to `main` → production at `admin.bostondodgeballleague.com`.

If `preview` has fallen behind `main`, fast-forward or merge `main` into `preview` before landing new work there.

## Google Cloud OAuth

1. Create or reuse a **Web** OAuth client.
2. Add authorized redirect URIs:
   - Local: `http://localhost:3000/api/admin/google/callback`
   - Preview: `https://admin-preview.bostondodgeballleague.com/api/admin/google/callback`
   - Prod: `https://admin.bostondodgeballleague.com/api/admin/google/callback`
3. Set matching JavaScript origins for those hosts if the console requires them.

## Database setup

1. Provision Neon (Vercel Marketplace → Neon) and set `DATABASE_URL` for
   **Production** and **Preview** (available at build time).
2. Schema changes ship as SQL under [`drizzle/`](../drizzle/). Deploys apply
   them automatically: `npm run build` runs `db:migrate:deploy` before
   `next build` whenever `DATABASE_URL` is set.
3. Locally (or if you need to migrate without a full build):

```bash
npm run db:migrate
```

`db:migrate:deploy` skips cleanly when `DATABASE_URL` is unset (CI builds).

SQL migration source: [`drizzle/0000_players.sql`](../drizzle/0000_players.sql).

## App gate

[`middleware.ts`](../middleware.ts) requires a valid `admin_session` cookie for almost all routes. Public exceptions:

- `/login`
- `/api/admin/google/login`
- `/api/admin/google/callback`
- `/api/admin/session`
- `/api/admin/logout`
- `/api/video-tools/upload`
- `/api/video-tools/worker/*`
- `/api/webhooks/twilio/messaging` (Twilio signature-validated)
- Next static assets

Sign in at `/login`. TopNav shows the signed-in email and Log out.

## Contact players

Admins can email / SMS / WhatsApp cohorts from **Players** (Contact filtered… / Contact selected) and **Event detail** (Contact registered players).

- Audience: explicit `playerIds`, or filters (`homeLeague`, `eventId`, search, skill). Local BDL ≈ `homeLeague=boston_dodgeball_league`.
- Email uses Resend + `player_emails`. SMS/WhatsApp need `player_phones` + opt-in prefs; TeamLinkt import maps Phone columns.
- Jobs/recipients are stored in `contact_jobs` / `contact_job_recipients` (migration `0021_contact_players`).
- Configure Twilio status callback / inbound webhook to `NEXT_PUBLIC_APP_URL/api/webhooks/twilio/messaging`.

## Players

- UI: `/players`
- Import TeamLinkt CSV (dry run → commit). Matching: email, then first+last name.
- Skill systems (independent per player):
  - **Linear** (`skill_level`): 1–100 with anchors at 20 Beginner, 40 Intermediate, 60 Advanced, 80 Worlds level (`null` = Unset). Midpoints (e.g. 30, 50) are allowed. Legacy 1–4 values were migrated ×20.
  - **Fibonacci** (`skill_level_fib`): one of `1, 2, 3, 5, 8, 13, 21, 34, 55, 89` (or unset).
  - **Skill areas** (`skill_areas` jsonb): offense, defense, staying alive, court presence/play calling — each on the linear scale; blank fields fall back to the main linear skill. Effective score = average of the four resolved values.
- Players and event pages share a **Skill view** toggle (`localStorage` key `bdl-admin.skillViewMode`) so display, matrix, sorting, and draft balancing follow Linear / Fibonacci / Skill areas.
- Gender: male / female / nonbinary / other (imported from TeamLinkt Gender column). List sorts female/nonbinary/other together for drafting. Birthdate from TeamLinkt is not stored or shown.
- Import fills **linear** skill when the CSV has a Skill / Skill Level column (`2`/`Intermediate` → 40, `3`/`Advanced` → 60, etc.). Creates get the value; updates only set skill when the existing player is unset. Fibonacci and skill areas are not invented by import.
- Import fills **jersey** the same way when a Jersey Number (or Uniform Number / Shirt Number) column is present.
- Association members exports usually omit skill and jersey — dry-run preview warns when those columns are missing. Use a roster/participants export (or additional-info columns) to backfill.
- Committed imports (and **Save for later**) store the full CSV on `import_batches.csv_text` so you can **Load** or **Re-apply** later without re-uploading. Re-apply creates a new batch and still only fills unset jersey/skill.
- Schema note: after pulling this change, run `npm run db:push` (or apply [`drizzle/0022_import_batches_csv_text.sql`](../drizzle/0022_import_batches_csv_text.sql)) so `source` + `csv_text` exist on `import_batches`.
- All writes audit to `player_changes` with `actor` = Google email and `source` = `admin` or `import`.
