# BDL Admin — agent guide

Next.js 15 (App Router) admin for the BDL board: players, events/drafts,
league and tournament scheduling, a game timer, and video tools. Data is
Neon Postgres via Drizzle.

## Branches and checks

- Feature and fix PRs target **`preview`**. Pass `base_branch: "preview"`.
- Release PRs are **`preview` → `main`**, after the preview deploy is healthy.
  **Main merge gate** (`from-preview`) rejects any other head. **Preview smoke**
  (`smoke`) is the one release-PR health check.
- GitHub's default branch is **`main`**. `issues` and `pull_request_target`
  workflows (Add to BDL project) run from `main`, so a change on `preview`
  does not affect them until promotion.
- Install: `npm install` (or `bash scripts/with-bdl-git-auth.sh` when the
  private `@bdl/*` git deps must resolve). Lint: `npm run lint`. Tests:
  `npm run test:run`. Node 20+.
- Private `@bdl/*` packages may not install on agent VMs. A missing packages
  token is an environment limit.
- Vercel's preview build is the real compile check for `preview` and `main`.
  `vercel.json` `ignoreCommand` skips other branches and docs-only diffs.
  CI on a ready feature PR still runs lint, tests, and `npm run build`,
  because that is the pre-merge Next compile.
- Open PRs as drafts. Mark them ready only when the work is done.
- Do not request Copilot or Bugbot reviews on drafts, docs-only PRs, or
  release PRs (`preview` → `main`).
- Keep changes scoped. Avoid broad exploration. Do not use fast mode.

## Local facts

- `npm run dev` is Turbopack and 500s every route after a page imports
  `@ffmpeg` (`/tournament`, `/video-tools`). Use `npx next dev` for those routes.
- Dev middleware grants `dev@localhost`. No Google login locally.
- The app talks to Neon over HTTP (`app/lib/db.ts`). `npm run build` skips
  migrations when `DATABASE_URL` is unset. Lint, test, and build need no secrets.
- Register half-baked UI in `app/lib/feature-maturity.ts` (`devOnly` or
  `incomplete`). User-facing changes get a dated entry in
  `app/changelog/entries.ts`.

## Logging

API routes log structured JSON through `createAppLog('admin')` in [`app/lib/app-log.ts`](app/lib/app-log.ts) (`@bdl/board-apps`). Team-wide Vercel → Axiom setup: [bdl-packages OBSERVABILITY.md](https://github.com/jsartin513/bdl-packages/blob/main/OBSERVABILITY.md).

More: [`.cursor/git-pr-workflow.md`](.cursor/git-pr-workflow.md),
[`.github/pull_request_template.md`](.github/pull_request_template.md),
[`docs/setup-and-capabilities.md`](docs/setup-and-capabilities.md).
Timed-block nights: [`.cursor/timed-block-nights.md`](.cursor/timed-block-nights.md).
