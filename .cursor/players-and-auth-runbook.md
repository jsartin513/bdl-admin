# Players DB + Google admin auth

## Environment variables

Add these to `.env.local` (local) and Vercel project env (Production / Preview):

```bash
# Google admin auth (same allowlist pattern as bdl-merch / open-gym / concessions)
ADMIN_GOOGLE_CLIENT_ID=
ADMIN_GOOGLE_CLIENT_SECRET=
ADMIN_SESSION_SECRET=          # long random string; unique per app is fine
ADMIN_ALLOWED_EMAILS=a@x.com,b@y.com   # required when VERCEL_ENV=production
NEXT_PUBLIC_APP_URL=http://localhost:3000   # no trailing slash; prod = public site URL

# Neon Postgres
DATABASE_URL=postgresql://...
```

Copy `ADMIN_ALLOWED_EMAILS` from bdl-merch so the same board members can sign in.

## Google Cloud OAuth

1. Create or reuse a **Web** OAuth client.
2. Add authorized redirect URI:
   - Local: `http://localhost:3000/api/admin/google/callback`
   - Prod / preview: `https://<your-host>/api/admin/google/callback`
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
- All writes audit to `player_changes` with `actor` = Google email and `source` = `admin` or `import`.
