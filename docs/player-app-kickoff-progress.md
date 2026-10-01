# Player app kickoff — progress tracker

Cross-repo checklist. Detail lives in the linked manuals.

| Manual | Repo | Path |
|--------|------|------|
| Player manual steps | `bdl-player` | [`docs/KICKOFF_MANUAL.md`](https://github.com/jsartin513/bdl-player/blob/main/docs/KICKOFF_MANUAL.md) |
| Admin integration plan | `bdl-admin` | [`docs/player-app-kickoff.md`](./player-app-kickoff.md) |

## GitHub (2026-09-30)

| Item | Status | URL |
|------|--------|-----|
| `jsartin513/bdl-player` | **Live** (`main` + `preview`) | https://github.com/jsartin513/bdl-player |
| `bdl-packages` `@bdl/player-public-contract` | **PR open** (pinned pre-merge in player app) | https://github.com/jsartin513/bdl-packages/pull/6 |

## Vercel

| Project | Status |
|---------|--------|
| `bdl-admin` | Exists (`prj_fM8T2mZYANHuMncSgFOOE4s4Da0s`) — preview: https://admin-preview.bostondodgeballleague.com |
| `bdl-player` | **Not created** |

Player non-secret env (preview examples): see `KICKOFF_MANUAL.md` — `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_LEAGUE_CATALOG_URL` → admin-preview public leagues path when API ships.

Admin follow-up: `PLAYER_APP_BASE_URL` = `https://play-preview.bostondodgeballleague.com` (preview); not set on `bdl-admin` Vercel yet.

## Blocked on human / other PRs

- Neon: player DB + admin `SENSITIVE_DATABASE_URL` split
- Google OAuth Web client (player-only)
- Create + link Vercel `bdl-player`, DNS for `play-preview` / `play`
- Merge bdl-packages #6; bump contract SHA in player app to post-merge `main`
- `BDL_PACKAGES_READ_TOKEN` on `bdl-player` GitHub (and Vercel when linked)
- Admin: public leagues API + sync client (see `player-app-kickoff.md`)
- Stripe / Resend (later stages)
