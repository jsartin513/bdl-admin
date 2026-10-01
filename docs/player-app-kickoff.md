# Player app integration (kickoff)

Full staged plan: Cursor plan **Player league app** (three databases, REST sync, BYOT/Remix).

## This repo — admin PRs

**Shipped on `preview`:** [#166](https://github.com/jsartin513/bdl-admin/pull/166) Stage 0, [#168](https://github.com/jsartin513/bdl-admin/pull/168) sync pull, [#167](https://github.com/jsartin513/bdl-admin/pull/167) public products API (v2).

1. Sensitive Neon scaffold — dual-write when `SENSITIVE_DATABASE_URL` is set.
2. `GET /api/public/leagues` — static `leagues` + published `products` (no auth).
3. `POST /api/admin/player-sync` — pull player changes when `PLAYER_APP_BASE_URL` + `PLAYER_SYNC_SECRET` are set.

**Next:** Cron sync, publish UI for events, player app deploy + OAuth, Stage 3 Stripe.

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
