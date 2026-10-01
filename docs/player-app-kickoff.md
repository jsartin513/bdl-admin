# Player app integration (kickoff)

Full staged plan: Cursor plan **Player league app** (three databases, REST sync, BYOT/Remix).

## This repo — admin PRs

**Stage 0 (open):** [PR #166](https://github.com/jsartin513/bdl-admin/pull/166) → `preview`

1. Sensitive Neon scaffold (`SENSITIVE_DATABASE_URL`, dual-write/read in `app/lib/sensitive/`); operational `players` gains `self_reported_skill` + `player_app_account_id`.
2. Public league API `GET /api/public/leagues` (allowlisted fields only; no auth).
3. **Next:** Pull client — `GET` player `/api/internal/v1/changes` with `X-BDL-Player-Sync-Secret`.

## Vercel env (admin)

Non-secret (set per environment):

| Variable | Preview | Production |
|----------|---------|------------|
| `PLAYER_APP_BASE_URL` | `https://play-preview.bostondodgeballleague.com` | `https://play.bostondodgeballleague.com` |

Player app reads the league catalog from admin’s public API (live on preview after **#166** merges):

| Player var | Points at (when live) |
|------------|------------------------|
| `NEXT_PUBLIC_LEAGUE_CATALOG_URL` | Preview: `https://admin-preview.bostondodgeballleague.com/api/public/leagues` · Production: `https://admin.bostondodgeballleague.com/api/public/leagues` |

Progress tracker: [`player-app-kickoff-progress.md`](./player-app-kickoff-progress.md).

Secrets (**TODO** — do not commit):

- `PLAYER_SYNC_SECRET` — must match player app
- `SENSITIVE_DATABASE_URL` — after Neon split

Player app manual steps: see `bdl-player/docs/KICKOFF_MANUAL.md`.

Migration plan (operational vs sensitive): [player-app-migrations.md](./player-app-migrations.md).
