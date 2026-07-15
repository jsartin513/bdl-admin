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
```

Copy `ADMIN_ALLOWED_EMAILS` from bdl-merch so the same board members can sign in.

On production `*.bostondodgeballleague.com` hosts, `admin_session` is set with `Domain=.bostondodgeballleague.com` so League Admin, Merch, and Open Gym share one login. Preview hosts and localhost stay host-only.

| Environment | Host | Git branch | `NEXT_PUBLIC_APP_URL` |
|-------------|------|------------|------------------------|
| Production | `https://admin.bostondodgeballleague.com` | `main` | same origin |
| Preview (stable) | `https://admin-preview.bostondodgeballleague.com` | `preview` | same origin |
| Local | `http://localhost:3000` | — | same origin |

Auth env for the stable preview host is scoped to the **`preview`** Git branch in Vercel.

## Google Cloud OAuth

1. Create or reuse a **Web** OAuth client.
2. Add authorized redirect URIs:
   - Local: `http://localhost:3000/api/admin/google/callback`
   - Preview: `https://admin-preview.bostondodgeballleague.com/api/admin/google/callback`
   - Prod: `https://admin.bostondodgeballleague.com/api/admin/google/callback`
3. Set matching JavaScript origins for those hosts if the console requires them.

## Database setup

1. Provision Neon (Vercel Marketplace → Neon) and set `DATABASE_URL`.
2. Apply schema:

```bash
npm run db:push
# or, with migrations:
npm run db:migrate
```

SQL migration source: [`drizzle/0000_players.sql`](../drizzle/0000_players.sql).

## App gate

[`middleware.ts`](../middleware.ts) requires a valid `admin_session` cookie for almost all routes. Public exceptions:

- `/login`
- `/api/admin/google/login`
- `/api/admin/google/callback`
- `/api/admin/session`
- `/api/admin/logout`
- Next static assets

Sign in at `/login`. TopNav shows the signed-in email and Log out.

## Players

- UI: `/players`
- Import TeamLinkt CSV (dry run → commit). Matching: email, then first+last name.
- Skill levels: 1 Beginner, 2 Intermediate, 3 Advanced, 4 Worlds level (`null` = Unset).
- Import fills skill when the CSV has a Skill / Skill Level column (`2`/`Intermediate`, `3`/`Advanced`, etc.). Creates get the value; updates only set skill when the existing player is unset.
- All writes audit to `player_changes` with `actor` = Google email and `source` = `admin` or `import`.
