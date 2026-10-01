# BDL Admin — setup, capabilities, and limits

This doc describes what works out of the box, what needs secrets or external services, and how to set up local and deployed environments. It complements the agent-focused [AGENTS.md](../AGENTS.md) and the deeper runbooks under [`.cursor/`](../.cursor/).

**Related repos:** Cross-post publishing also requires [bdl-website](https://github.com/jsartin513/bdl-website) with matching `PUBLISH_API_SECRET`.

**Integration setup (Twilio, Resend, etc.):** [integrations-setup.md](./integrations-setup.md). **Scheduled send design (future):** [scheduled-comms-design.md](./scheduled-comms-design.md).

---

## Quick start (local)

**Requirements:** Node 20+, `pnpm` (see `packageManager` in `package.json`).

```bash
cd bdl-admin
pnpm install          # or: pnpm run install:deps if GitHub deps need BDL_PACKAGES_READ_TOKEN
# Create .env.local from the template in the next section
pnpm run dev          # http://localhost:3000 — uses Turbopack
```

| Command | Needs DB? | Notes |
|---------|-----------|--------|
| `pnpm run lint` | No | |
| `pnpm run test:run` | No | |
| `pnpm run build` | No* | Runs `db:migrate:deploy` only when `DATABASE_URL` is set |
| `pnpm run dev` | No for auth | Auto **dev admin** session — no Google login locally |

\* Without `DATABASE_URL`, migrations skip and the app still builds.

### Local auth (no Google OAuth required)

In `next dev`, middleware grants a session for `dev@localhost` (override with `ADMIN_DEV_EMAIL`). Every route is reachable without `ADMIN_GOOGLE_*` or `ADMIN_SESSION_SECRET`.

### Dev server: Turbopack vs webpack

`pnpm run dev` uses **Turbopack**. Visiting **`/tournament`** or **`/video-tools`** can break **all routes** (HTTP 500) until you restart the dev server, because Turbopack cannot load `@ffmpeg/ffmpeg` workers.

**Workaround:** `npx next dev` (webpack) for full local coverage.

---

## Environment template (`.env.local`)

Copy into `.env.local` and fill in what you need. Nothing here is required for lint, test, or build unless noted.

```bash
# --- Core app URL (required on Vercel; match the host users open) ---
NEXT_PUBLIC_APP_URL=http://localhost:3000

# --- Google admin auth (required on Production / Preview deploys; optional locally) ---
ADMIN_GOOGLE_CLIENT_ID=
ADMIN_GOOGLE_CLIENT_SECRET=
ADMIN_SESSION_SECRET=          # same value on merch / open-gym / concessions for SSO
ADMIN_ALLOWED_EMAILS=you@example.com   # required when VERCEL_ENV=production

# --- Database (required for DB-backed features) ---
DATABASE_URL=postgresql://...   # Neon HTTPS URL — not plain local TCP at runtime

# --- Contact players: email (Resend) ---
RESEND_API_KEY=
CONTACT_EMAIL_FROM="BDL Events <events@bostondodgeballleague.com>"   # required to actually send email

# --- Contact players: SMS / WhatsApp (Twilio) — often NOT configured ---
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=          # preferred
TWILIO_FROM_NUMBER=                    # E.164 fallback
TWILIO_WHATSAPP_FROM=whatsapp:+1...
TWILIO_WA_TEMPLATE_EVENT_REMINDER=HX…
TWILIO_WA_TEMPLATE_SCHEDULE_CHANGE=HX…
TWILIO_WA_TEMPLATE_ANNOUNCEMENT=HX…
# CONTACT_DRY_RUN=1                    # log sends, no provider calls
# TWILIO_SKIP_SIGNATURE_VALIDATE=1     # local webhook testing only

# --- Google Drive (schedules + create-league) ---
GOOGLE_DRIVE_API_KEY=
GOOGLE_DRIVE_FOLDER_ID=

# --- Vercel Blob (uploads) ---
BLOB_READ_WRITE_TOKEN=

# --- Video merge worker (Fly.io + admin app must share secrets) ---
VIDEO_WORKER_SECRET=

# --- Cross-post composer → bdl-website ---
PUBLISH_API_SECRET=                    # same on admin + website
WEBSITE_PUBLISH_URL=https://bdl-site-preview.bostondodgeballleague.com/api/internal/publish
PUBLIC_WEBSITE_URL=https://bdl-site-preview.bostondodgeballleague.com

# CRON_SECRET=                     # Vercel cron → /api/cron/dispatch-scheduled
# ADMIN_DEV_EMAIL=dev@localhost
# CONTACT_MAX_RECIPIENTS=50
# NOTIFY_FROM_EMAIL=                   # separate from contact; other notify helpers
```

On **Vercel**, set variables per environment (**Preview** vs **Production**). Preview admin should point `WEBSITE_PUBLISH_URL` / `PUBLIC_WEBSITE_URL` at the **site preview** host; production at the live site. See [Deploy flow](#deploy-flow-preview-first).

---

## What works without secrets

These work in local dev (and often in CI) with **no** `.env.local`:

- Lint, unit tests, production **build** (migrations skip if no `DATABASE_URL`)
- **All routes locally** via dev auto-login
- **`/tournament`** schedule + audio-cue generator (bundled CSV; no Blob required for step 1)
- **`/timer`**, **`/timer-standalone`**, static-ish tools
- UI shells for most pages (data loads fail gracefully or show errors when APIs need DB/Drive/Blob)

---

## Feature matrix

| Feature / route | Needs | Works without it? | If missing / not configured |
|-----------------|-------|-------------------|-----------------------------|
| **Login (Preview / Prod)** | `ADMIN_GOOGLE_*`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`, `ADMIN_ALLOWED_EMAILS` (prod) | Local dev: yes (auto session) | Redirect to `/login`; OAuth errors |
| **Players, events, drafts** | `DATABASE_URL` (Neon) | Page loads; APIs **503** | “Database not configured” / empty data |
| **Contact → Email** | `RESEND_API_KEY` + **`CONTACT_EMAIL_FROM`** | Preview step may show email “available” with only `RESEND_API_KEY`; **send fails** without `CONTACT_EMAIL_FROM` | Channel marked not configured after preview, or error on send |
| **Contact → SMS** | Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, + Messaging Service or `TWILIO_FROM_NUMBER`) | **Yes** (email-only) | SMS disabled after preview shows `(not configured)`; send throws “Twilio is not configured” |
| **Contact → WhatsApp** | Twilio + approved Content templates (`TWILIO_WA_TEMPLATE_*`) | **Yes** | Same as SMS; template options show “(not configured)” |
| **Twilio webhooks** | Twilio + `NEXT_PUBLIC_APP_URL` | N/A | Status callbacks / inbound need public URL configured in Twilio |
| **`/schedules`, `/create-league`** | `GOOGLE_DRIVE_API_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | UI loads | Drive fetch errors; see [`.cursor/drive-folder-runbook.md`](../.cursor/drive-folder-runbook.md) |
| **Player / event photos** | `BLOB_READ_WRITE_TOKEN` | UI without upload | Upload failures |
| **`/tournament` clips (steps 2–3)** | `BLOB_READ_WRITE_TOKEN` | Step 1 schedule still works | Clip upload / Blob URLs fail |
| **`/video-tools`** | `BLOB_READ_WRITE_TOKEN`; merge needs **`VIDEO_WORKER_SECRET`** + Fly worker | Create UI; jobs **stay queued** without worker | See [`.cursor/video-tools-runbook.md`](../.cursor/video-tools-runbook.md) |
| **`/publish` (cross-post)** | `DATABASE_URL`, `PUBLISH_API_SECRET`, `WEBSITE_PUBLISH_URL`, website DB + secret | List/create **503** without DB | Approve fails without publish URL/secret; website must accept Bearer token |
| **Instagram / YouTube kit** | After successful website publish | N/A | Manual copy/download only (no auto-post APIs) |

### Twilio (typical board state)

The **Contact players** UI supports email, SMS, and WhatsApp, but **SMS and WhatsApp only work when Twilio env vars are set on Vercel** (and templates approved for WhatsApp). If Twilio is not set up—as is common until the board completes [integrations-setup.md](./integrations-setup.md):

- **Email** can still work with Resend (if `RESEND_API_KEY` and `CONTACT_EMAIL_FROM` are set).
- **SMS / WhatsApp** appear as **(not configured)** after you run **Preview** in the contact dialog; sending those channels errors server-side.
- Use **`CONTACT_DRY_RUN=1`** in dev to exercise the flow without calling Resend or Twilio.

Full Twilio onboarding (Messaging Service, WhatsApp templates, webhooks, troubleshooting): **[integrations-setup.md](./integrations-setup.md)**.

---

## Cross-post composer (admin + website)

**Admin** (`/publish`): draft posts, upload media to Blob, **Approve** pushes to the public site.

**Website:** `POST /api/internal/publish` with `Authorization: Bearer {PUBLISH_API_SECRET}`.

| Variable | Where | Purpose |
|----------|--------|---------|
| `PUBLISH_API_SECRET` | **Both** admin and website (same value) | Auth for internal publish |
| `WEBSITE_PUBLISH_URL` | Admin only | Full URL to website publish endpoint |
| `PUBLIC_WEBSITE_URL` | Admin only | Links in social kit copy |
| `DATABASE_URL` | Both | Admin: `publish_posts`; website: news, alerts, program flyer |
| `BLOB_READ_WRITE_TOKEN` | Admin (uploads); website (builder images) | Flyer/media storage |

Preview example:

- Admin: `WEBSITE_PUBLISH_URL=https://bdl-site-preview.bostondodgeballleague.com/api/internal/publish`
- Website preview host: `bdl-site-preview.bostondodgeballleague.com`

Production example:

- Admin: `WEBSITE_PUBLISH_URL=https://bdl-site.bostondodgeballleague.com/api/internal/publish`
- `PUBLIC_WEBSITE_URL=https://www.bostondodgeballleague.com`

After changing env vars on Vercel, **redeploy** so runtime picks them up.

---

## Database setup

1. **Neon** via Vercel Marketplace (or any Neon project). Use the **serverless** connection string in `DATABASE_URL`.
2. **Runtime:** the app uses Neon’s HTTP driver (`neon()` in `app/lib/db.ts`). A local Postgres on `localhost:5432` does **not** work for the running Next app unless you use a Neon URL (or tunnel)—`drizzle-kit migrate` can target other Postgres for schema only.
3. **Migrations:** SQL under `drizzle/`. Deploy runs `db:migrate:deploy` before `next build` when `DATABASE_URL` is set.
4. **Local migrate:** `pnpm run db:migrate`

Player/contact/import details: [`.cursor/players-and-auth-runbook.md`](../.cursor/players-and-auth-runbook.md).

---

## Google OAuth (Preview / Production)

1. Google Cloud **Web** OAuth client.
2. Redirect URIs:
   - `http://localhost:3000/api/admin/google/callback`
   - `https://admin-preview.bostondodgeballleague.com/api/admin/google/callback`
   - `https://admin.bostondodgeballleague.com/api/admin/google/callback`
3. Set `NEXT_PUBLIC_APP_URL` to the **exact origin** users use (no trailing slash).
4. Copy `ADMIN_ALLOWED_EMAILS` from other board apps (merch, open-gym) for the same allowlist.

Production cookies use `Domain=.bostondodgeballleague.com` for cross-app SSO; localhost and preview hosts stay host-only.

---

## Deploy flow (preview-first)

| Environment | Admin URL | Git branch |
|-------------|-----------|------------|
| Production | `https://admin.bostondodgeballleague.com` | `main` |
| Preview | `https://admin-preview.bostondodgeballleague.com` | `preview` |

1. Feature PRs → **`preview`**, not `main`.
2. Merge to `preview` → preview deploy + CI smoke (`/login`, `/players`, `/events`).
3. Promote with **`preview` → `main`** only after preview is healthy (Main merge gate enforces head = `preview`).

Details: [`.cursor/git-pr-workflow.md`](../.cursor/git-pr-workflow.md).

---

## Vercel checklist (new feature or env)

- [ ] Preview env vars on **Preview** scope (and branch `preview` where auth is branch-scoped)
- [ ] Production env vars on **Production** after promote
- [ ] `NEXT_PUBLIC_APP_URL` matches deployed host per environment
- [ ] `PUBLISH_API_SECRET` identical on admin + website in the same environment
- [ ] `VIDEO_WORKER_SECRET` matches Fly worker if using video merge
- [ ] Redeploy after env changes

---

## Further reading

| Topic | Doc |
|-------|-----|
| **Twilio, Resend, Drive, Blob, publish setup** | [integrations-setup.md](./integrations-setup.md) |
| **Scheduled contact + publish (design)** | [scheduled-comms-design.md](./scheduled-comms-design.md) |
| Players, contact, auth, publish env | [`.cursor/players-and-auth-runbook.md`](../.cursor/players-and-auth-runbook.md) |
| Google Drive folder / schedules | [`.cursor/drive-folder-runbook.md`](../.cursor/drive-folder-runbook.md) |
| Video tools + Fly worker | [`.cursor/video-tools-runbook.md`](../.cursor/video-tools-runbook.md) |
| Website local + publish secret | `bdl-website/.env.example` |
| Agents / CI / Turbopack | [AGENTS.md](../AGENTS.md) |
