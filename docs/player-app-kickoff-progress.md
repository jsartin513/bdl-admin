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
| `bdl-packages` `@bdl/player-public-contract` | **Merged** (`4592757…` on `main`) | https://github.com/jsartin513/bdl-packages/pull/6 |
| `bdl-admin` player app Stage 0 | **PR open** (sensitive scaffold + public leagues) | https://github.com/jsartin513/bdl-admin/pull/166 |

## Vercel

| Project | Status |
|---------|--------|
| `bdl-admin` | Exists (`prj_fM8T2mZYANHuMncSgFOOE4s4Da0s`) — preview: https://admin-preview.bostondodgeballleague.com |
| `bdl-player` | **Not created** |

Player non-secret env (preview examples): see `KICKOFF_MANUAL.md` — `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_LEAGUE_CATALOG_URL` → `https://admin-preview.bostondodgeballleague.com/api/public/leagues` (expect **200** after [#166](https://github.com/jsartin513/bdl-admin/pull/166) merges; **401** on preview today).

Admin follow-up: `PLAYER_APP_BASE_URL` = `https://play-preview.bostondodgeballleague.com` (preview); not set on `bdl-admin` Vercel yet.

## Blocked on human / other PRs

- Neon: player DB + admin `SENSITIVE_DATABASE_URL` split
- Google OAuth Web client (player-only)
- Create + link Vercel `bdl-player`, DNS for `play-preview` / `play`
- Merge [bdl-player #1](https://github.com/jsartin513/bdl-player/pull/1) (contract pin to `4592757…`)
- `BDL_PACKAGES_READ_TOKEN` on `bdl-player` GitHub (and Vercel when linked)
- Merge admin [#166](https://github.com/jsartin513/bdl-admin/pull/166); apply sensitive SQL + set `SENSITIVE_DATABASE_URL` on preview admin
- Admin sync pull client (Stage 1; see `player-app-kickoff.md`)
- Stripe / Resend (later stages)
