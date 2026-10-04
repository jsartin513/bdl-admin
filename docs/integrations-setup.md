# Integrations setup (Twilio, Resend, Drive, Blob, publish)

Step-by-step setup for external services used by **bdl-admin**. For what works without each integration, see [setup-and-capabilities.md](./setup-and-capabilities.md). For scheduling player messages and cross-posts in the future, see [scheduled-comms-design.md](./scheduled-comms-design.md).

---

## Production readiness (typical)

Use this as a checklist when onboarding a new board member or after promoting to production. **Verify in Vercel** (Project → Settings → Environment Variables)—values change over time.

| Integration | Preview (`admin-preview`) | Production (`admin`) | Notes |
|-------------|---------------------------|----------------------|--------|
| Neon `DATABASE_URL` | Usually set | Usually set | Required for players, events, contact jobs, `/publish` |
| Google OAuth + session | Set (often branch-scoped) | Set | `NEXT_PUBLIC_APP_URL` must match host |
| Resend contact email | May be set | Often set | Needs **`CONTACT_EMAIL_FROM`** + verified domain to send |
| **Twilio SMS / WhatsApp** | Often **not** set | Often **not** set until board completes setup | SMS/WA disabled in UI until configured |
| Google Drive | May be set | Usually set for schedules | See Drive runbook |
| `BLOB_READ_WRITE_TOKEN` | Usually set | Usually set | Photos, tournament clips, video-tools, publish media |
| `VIDEO_WORKER_SECRET` + Fly worker | Preview merges **not** claimed by prod worker | Prod worker → prod admin | See video-tools runbook |
| Cross-post `PUBLISH_*` | Set on admin + website preview | Set on admin + website prod | Same secret per environment pair |
| `CRON_SECRET` (admin only) | Set | Set | Bearer for `POST /api/cron/dispatch-scheduled`; Vercel Cron when on Pro — [go-live-checklist.md](./go-live-checklist.md) |

**Recommendation:** Configure **real Twilio and Resend sends on Production only**. On Preview, use `CONTACT_DRY_RUN=1` to test the contact UI without billing or accidental player messages.

---

## Twilio (Contact players — SMS & WhatsApp)

Used from **Players** and **Event detail** → Contact filtered / Contact selected. Code: [`app/lib/contact/providers/twilio.ts`](../app/lib/contact/providers/twilio.ts), [`app/lib/contact/whatsapp-templates.ts`](../app/lib/contact/whatsapp-templates.ts), webhook [`app/api/webhooks/twilio/messaging/route.ts`](../app/api/webhooks/twilio/messaging/route.ts).

### 1. Account and API credentials

1. Sign in at [Twilio Console](https://console.twilio.com/).
2. Copy **Account SID** and **Auth Token** (or create an API key if your org prefers).
3. In Vercel → **bdl-admin** → Environment Variables, add for **Production** (and Preview only if you intend real test sends):

   | Variable | Example / notes |
   |----------|-----------------|
   | `TWILIO_ACCOUNT_SID` | `AC…` |
   | `TWILIO_AUTH_TOKEN` | Secret; rotate if exposed |

4. Redeploy after saving.

`isTwilioConfigured()` also requires **either** `TWILIO_MESSAGING_SERVICE_SID` **or** `TWILIO_FROM_NUMBER` (see below).

### 2. Outbound SMS (US)

**Preferred:** [Messaging Service](https://www.twilio.com/docs/messaging/services)

1. Console → Messaging → Services → Create.
2. Add sender pool (phone number(s)).
3. Set `TWILIO_MESSAGING_SERVICE_SID=MG…` on Vercel.

**Alternative:** single number as `TWILIO_FROM_NUMBER` in E.164 format (e.g. `+16175551212`).

**US A2P 10DLC (operational):** For application-to-person SMS in the US, Twilio requires brand/campaign registration. Complete Twilio’s **Trust Hub / A2P 10DLC** flow before large sends; unregistered traffic may be filtered or blocked. This is a Twilio/account process, not something configured in the repo.

### 3. WhatsApp

1. Enable WhatsApp on your Twilio account and connect a **WhatsApp sender** (business profile).
2. Set `TWILIO_WHATSAPP_FROM` to the WhatsApp-enabled sender, e.g. `whatsapp:+14155238886`, **or** rely on a Messaging Service that includes WhatsApp senders.
3. Create **Content Templates** in Twilio (WhatsApp requires pre-approved templates for outbound notifications).

Map each template’s **Content SID** (`HX…`) to env vars. Names and variables must match [`WHATSAPP_TEMPLATES`](../app/lib/contact/whatsapp-templates.ts):

| Env var | Template key in app | Variables Twilio must accept |
|---------|---------------------|------------------------------|
| `TWILIO_WA_TEMPLATE_EVENT_REMINDER` | `event_reminder` | `firstName`, `eventName`, `eventDate` |
| `TWILIO_WA_TEMPLATE_SCHEDULE_CHANGE` | `schedule_change` | `firstName`, `eventName`, `eventDate` |
| `TWILIO_WA_TEMPLATE_ANNOUNCEMENT` | `announcement` | `firstName`, `body` |

Until each SID is set, the contact UI shows that template as **(not configured)** after you run **Preview**.

### 4. Webhooks (delivery status + STOP / opt-out)

The app exposes a **public** route (no admin cookie): `/api/webhooks/twilio/messaging`.

**URL to configure in Twilio** (Messaging Service and/or phone number):

```text
https://admin.bostondodgeballleague.com/api/webhooks/twilio/messaging
```

For production, **`NEXT_PUBLIC_APP_URL`** on Vercel must be `https://admin.bostondodgeballleague.com` (no trailing slash) so outbound messages’ status callbacks and signature validation use the same URL.

Configure:

- **Status callback** — delivery updates (`delivered`, `failed`, etc.) update `contact_job_recipients`.
- **Inbound** — handles **STOP**-style opt-outs and updates `player_messaging_prefs`.

Local testing only: `TWILIO_SKIP_SIGNATURE_VALIDATE=1` (never on Production).

### 5. Player data prerequisites

SMS/WhatsApp only reach players who have:

- A phone on `player_phones` (E.164), often from TeamLinkt import **Phone** columns.
- Opt-in on `player_messaging_prefs` (`sms_opt_in_at` / `whatsapp_opt_in_at`) and not opted out.

Email uses `player_emails` and separate email opt-out. See [players-and-auth-runbook](../.cursor/players-and-auth-runbook.md) → Contact players.

### 6. Verify end-to-end

1. Open **Players** → Contact filtered → choose a **small** test cohort with your own phone/email.
2. Click through **Preview** — SMS/WhatsApp radios should **not** say `(not configured)` when Twilio env is complete.
3. Send a test message.
4. Optional local: `CONTACT_DRY_RUN=1` logs sends without Twilio/Resend calls.
5. In Neon, inspect `contact_jobs` and `contact_job_recipients` for status and `provider_message_id`.

### 7. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| SMS/WhatsApp **(not configured)** after Preview | Missing `TWILIO_*` or Messaging Service / from number |
| **403 Invalid signature** on webhook | Webhook URL in Twilio ≠ `NEXT_PUBLIC_APP_URL` + path; or HTTP vs HTTPS |
| WhatsApp send fails | Template not **approved**; wrong Content SID; variable names don’t match |
| **Twilio is not configured** on send | Same as first row; or Preview without vars |
| Recipients **skipped** | Missing phone, opt-out, or no opt-in for SMS/WA |
| Email works, SMS doesn’t | Twilio not set up (expected until this doc is completed) |

---

## Resend (Contact players — email)

| Variable | Required | Notes |
|----------|----------|--------|
| `RESEND_API_KEY` | Yes | From [Resend](https://resend.com) dashboard |
| `CONTACT_EMAIL_FROM` | **Yes to send** | e.g. `BDL Events <events@bostondodgeballleague.com>` |

`isEmailProviderConfigured()` only checks `RESEND_API_KEY`, but **`sendContactEmail` throws without `CONTACT_EMAIL_FROM`**. Verify the **from domain** in Resend (DNS records).

Optional: `CONTACT_DRY_RUN=1`, `CONTACT_MAX_RECIPIENTS` (default 50 per job).

Other Resend uses (separate from contact): `NOTIFY_FROM_EMAIL` for video merge notifications and login alerts — see [video-tools-runbook](../.cursor/video-tools-runbook.md).

More context: [setup-and-capabilities.md](./setup-and-capabilities.md), [players-and-auth-runbook](../.cursor/players-and-auth-runbook.md).

---

## Google Drive (Schedules + Create League)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_DRIVE_API_KEY` | Server-side Sheets/Drive API |
| `GOOGLE_DRIVE_FOLDER_ID` | Folder of league templates and live schedules |

Without these, `/schedules` (live mode) and `/create-league` cannot load sheets.

Full folder layout, sharing, and API key setup: [`.cursor/drive-folder-runbook.md`](../.cursor/drive-folder-runbook.md).

---

## Vercel Blob

| Variable | Purpose |
|----------|---------|
| `BLOB_READ_WRITE_TOKEN` | Client uploads via `@vercel/blob` |

Used for: player/event photos, tournament audio clips, **Publish** media, **Video Tools** clips.

Create store in Vercel → Storage → Blob; attach token to **bdl-admin** (Preview + Production).

---

## Video merge worker (Fly.io)

The admin app **queues** merges; **Fly** runs ffmpeg.

| Where | Variables |
|-------|-----------|
| Vercel **bdl-admin** | `BLOB_READ_WRITE_TOKEN`, `VIDEO_WORKER_SECRET`, optional `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` |
| Fly **`bdl-video-merge`** | `VIDEO_TOOLS_API_BASE=https://admin.bostondodgeballleague.com`, same `VIDEO_WORKER_SECRET`, same `BLOB_READ_WRITE_TOKEN` |

Deploying admin alone leaves jobs **queued** until the worker is healthy.

Full flow: [`.cursor/video-tools-runbook.md`](../.cursor/video-tools-runbook.md), [`workers/video-merge/README.md`](../workers/video-merge/README.md).

---

## Cross-post publish (admin → bdl-website)

| Variable | Project | Purpose |
|----------|---------|---------|
| `PUBLISH_API_SECRET` | **Both** admin + website (identical per env) | Bearer auth on `POST /api/internal/publish` |
| `WEBSITE_PUBLISH_URL` | Admin | Full publish endpoint URL |
| `PUBLIC_WEBSITE_URL` | Admin | Social kit links |
| `DATABASE_URL` | Both | Admin `publish_posts`; website news/alerts/flyer |

Preview admin → preview site URL; production → `https://bdl-site.bostondodgeballleague.com/api/internal/publish`.

Website template: `bdl-website/.env.example`.

Details: [setup-and-capabilities.md](./setup-and-capabilities.md) → Cross-post composer.

---

## Related docs

| Doc | Contents |
|-----|----------|
| [setup-and-capabilities.md](./setup-and-capabilities.md) | Feature matrix, local dev, env template |
| [scheduled-comms-design.md](./scheduled-comms-design.md) | Future: schedule contact + publish at a set time |
| [`.cursor/players-and-auth-runbook.md`](../.cursor/players-and-auth-runbook.md) | Auth, DB, contact behavior |
| [`.cursor/drive-folder-runbook.md`](../.cursor/drive-folder-runbook.md) | Drive folder |
| [`.cursor/video-tools-runbook.md`](../.cursor/video-tools-runbook.md) | Fly worker |
