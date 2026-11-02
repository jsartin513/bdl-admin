# Player sync — `PLAYER_SYNC_SECRET` runbook

Admin pulls profile changes from the player app over an internal HTTP API. Both apps must share the same secret; the player app validates inbound requests; admin sends the secret on every pull.

## Wire the secret (Vercel)

1. **Generate** a random value (do not commit):

   ```bash
   openssl rand -base64 32
   ```

2. **Set the same value** on both Vercel projects (Preview first; Production when play + admin prod are live):

   | Project | Variable | Target |
   |---------|----------|--------|
   | `bdl-admin` | `PLAYER_SYNC_SECRET` | Preview (and Production later) |
   | `bdl-player` | `PLAYER_SYNC_SECRET` | Preview (and Production later) |

   Use **Sensitive** / encrypted storage in the Vercel dashboard (or `vercel env add … --sensitive`).

3. **Redeploy** preview (and production) after adding or rotating the secret so runtime picks it up.

4. On **admin**, ensure non-secret **`PLAYER_APP_BASE_URL`** points at the deployed player host for that environment (Preview → `https://play-preview.bostondodgeballleague.com`, Production → `https://play.bostondodgeballleague.com`).

5. On **player**, the change feed returns `401` until `PLAYER_SYNC_SECRET` is set (even with no DB).

## Change feed (player app)

- **URL:** `GET {PLAYER_APP_BASE_URL}/api/internal/v1/changes`
- **Auth header:** `X-BDL-Player-Sync-Secret: <PLAYER_SYNC_SECRET>` (same env var name on both apps)
- **Optional query:** `since` — ISO-8601 timestamp for incremental poll; omit on first request.

### curl — smoke test (player)

Replace placeholders; use the preview player URL once DNS + deploy exist.

```bash
export PLAYER_APP_BASE_URL='https://play-preview.bostondodgeballleague.com'
export PLAYER_SYNC_SECRET='<from Vercel dashboard>'

curl -sS -D - -o /tmp/changes.json \
  -H "X-BDL-Player-Sync-Secret: ${PLAYER_SYNC_SECRET}" \
  -H 'Accept: application/json' \
  "${PLAYER_APP_BASE_URL}/api/internal/v1/changes"

# Expect: HTTP 200 and JSON { "version": "v1", "cursor", "profiles" }
# Wrong/missing secret → 401 { "error": "Unauthorized" }
```

With a cursor:

```bash
curl -sS \
  -H "X-BDL-Player-Sync-Secret: ${PLAYER_SYNC_SECRET}" \
  "${PLAYER_APP_BASE_URL}/api/internal/v1/changes?since=2026-01-01T00:00:00.000Z"
```

## Admin pull — `POST /api/admin/player-sync`

- **Auth:** Google admin session cookie `admin_session` (same as other `/api/admin/*` routes). Local `next dev` auto-grants a dev session without OAuth.
- **Config:** Requires **`PLAYER_APP_BASE_URL`** and **`PLAYER_SYNC_SECRET`** on admin. If either is missing → **503** with `"Player sync is not configured …"`.
- **Body (optional JSON):** `{ "since": "<ISO cursor or omit>" }` — same semantics as the player feed `since` param.
- **Success (200):** `{ "applied", "skipped", "ambiguous", "errors", "cursor" }`
- **Upstream failure:** **500** with `{ "error": "Player app changes fetch failed (…)" }` when the player URL is wrong, secret mismatches, or player is down.

### curl — smoke test (admin preview)

Log in to [admin preview](https://admin-preview.bostondodgeballleague.com) in a browser, copy the `admin_session` cookie value, then:

```bash
export ADMIN_ORIGIN='https://admin-preview.bostondodgeballleague.com'
export ADMIN_SESSION='<admin_session cookie value>'

curl -sS -D - -o /tmp/sync.json \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "Cookie: admin_session=${ADMIN_SESSION}" \
  -d '{}' \
  "${ADMIN_ORIGIN}/api/admin/player-sync"
```

First-time full poll:

```bash
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H "Cookie: admin_session=${ADMIN_SESSION}" \
  -d '{}' \
  "${ADMIN_ORIGIN}/api/admin/player-sync"
```

Incremental (pass cursor from prior response):

```bash
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H "Cookie: admin_session=${ADMIN_SESSION}" \
  -d '{"since":"2026-01-01T00:00:00.000Z"}' \
  "${ADMIN_ORIGIN}/api/admin/player-sync"
```

## Related code

- Admin pull: [`app/lib/players/player-app-sync.ts`](../app/lib/players/player-app-sync.ts), [`app/api/admin/player-sync/route.ts`](../app/api/admin/player-sync/route.ts)
- Player feed: `bdl-player` `app/api/internal/v1/changes/route.ts`

Kickoff checklists: [`player-app-kickoff.md`](./player-app-kickoff.md), `bdl-player/docs/KICKOFF_MANUAL.md`.
