# Player app kickoff — progress tracker

Cross-repo checklist. Detail lives in the linked manuals.

| Manual | Repo | Path |
|--------|------|------|
| Player manual steps | `bdl-player` | [`docs/KICKOFF_MANUAL.md`](https://github.com/jsartin513/bdl-player/blob/preview/docs/KICKOFF_MANUAL.md) |
| Admin integration plan | `bdl-admin` | [`docs/player-app-kickoff.md`](./player-app-kickoff.md) |

## GitHub

| Item | Status | URL |
|------|--------|-----|
| `jsartin513/bdl-player` | **Live** (`preview` integration) | https://github.com/jsartin513/bdl-player |
| `@bdl/player-public-contract` | **Merged** on `bdl-packages` `main` | https://github.com/jsartin513/bdl-packages/pull/6 |
| Admin Stage 0 | **Merged** | https://github.com/jsartin513/bdl-admin/pull/166 |
| Admin Stage 1 sync | **Merged** | https://github.com/jsartin513/bdl-admin/pull/168 |
| Admin Stage 2 public products | **Merged** | https://github.com/jsartin513/bdl-admin/pull/167 |
| Player Stage 1 prep | **Merged** to `preview` | https://github.com/jsartin513/bdl-player/pull/2 |

## Vercel

| Project | Status |
|---------|--------|
| `bdl-admin` | Preview: https://admin-preview.bostondodgeballleague.com — `PLAYER_APP_BASE_URL` set; **`PLAYER_SYNC_SECRET` on Preview** (copy same value to player when project exists) |
| `bdl-player` | **Not created** — needs import + DNS; set matching **`PLAYER_SYNC_SECRET`** on Preview |

Public catalog: `GET /api/public/leagues` returns **v2** `{ version, leagues, products }` on preview after deploy (migration **0028** required for `products` from DB).

## Secrets still manual

- `PLAYER_SYNC_SECRET` — **Preview set on `bdl-admin`**; still set on **`bdl-player`** (same value) before end-to-end sync. Runbook: [`player-sync-runbook.md`](./player-sync-runbook.md).
- `SENSITIVE_DATABASE_URL` — optional until sensitive Neon cutover
- Player: `PLAYER_DATABASE_URL`, Google OAuth, Stripe/Resend (later)

## Blocked on human

- Neon player DB + run player migrations
- Vercel `bdl-player` project, `BDL_PACKAGES_READ_TOKEN` on Vercel when project exists
- Google OAuth Web client (player)
- DNS `play-preview` / `play`
- Publish UI for event product fields (set `published_to_player_app` in DB until UI ships)

## Captain live draft (player app)

If the cloud agent could not push `bdl-player`, apply the patch on `preview`:

```bash
cd bdl-player && git checkout preview && git pull
git checkout -b cursor/captain-live-draft-c14a
git apply /path/to/bdl-player-captain-live-draft.patch
git add -A && git commit -m "Add captain live draft BFF and UI on play app"
git push -u origin cursor/captain-live-draft-c14a
gh pr create --base preview --head cursor/captain-live-draft-c14a --title "Captain live draft: BFF and /drafts UI on play" --body-file ...
```

Patch file: [bdl-player-captain-live-draft.patch](./bdl-player-captain-live-draft.patch)
