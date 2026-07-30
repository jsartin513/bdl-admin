# BDL Admin — agent guide

Next.js 15 (App Router) admin tools for the BDL board: players, events/drafts,
league + tournament scheduling, a game timer, and video tools. Data lives in
Neon Postgres via Drizzle ORM.

## Cursor Cloud specific instructions

The startup update script already runs `npm install`. Node 20+ is required
(`package.json` `engines`); the VM's Node 22 works fine.

Standard commands live in [`package.json`](package.json) `scripts` — use those
(`npm run lint`, `npm run test:run`, `npm run build`). All three pass without any
env vars or database. `npm run build` is safe with no DB: `db:migrate:deploy`
skips cleanly when `DATABASE_URL` is unset.

### Running the dev server (important, non-obvious)

- `npm run dev` uses **`next dev --turbopack`**. Turbopack cannot resolve
  `@ffmpeg/ffmpeg`'s dynamic worker import. The moment any page that imports
  `@ffmpeg` is compiled (**`/tournament`** or **`/video-tools`**), Turbopack
  enters a **global** compilation-error state and returns **HTTP 500 for every
  route** until the dev server is restarted. Non-ffmpeg pages work until then.
- **Workaround for full local coverage: run plain webpack dev — `npx next dev`**
  (no `--turbopack`). It serves every route, including `/tournament` and
  `/video-tools`, with no 500s. `npm run build` uses webpack and is unaffected.

### Local auth is automatic

In `next dev` (`NODE_ENV=development`), middleware auto-grants a `dev@localhost`
admin session (see [`app/lib/admin-session-edge.ts`](app/lib/admin-session-edge.ts)),
so **no Google OAuth or login is needed locally** — every route is reachable.

### Database is Neon-serverless, not plain Postgres

App runtime uses the **Neon serverless HTTP driver** (`neon()` in
[`app/lib/db.ts`](app/lib/db.ts)), which talks to a real Neon HTTPS endpoint. A
plain local Postgres over TCP will **not** work at runtime — DB-backed pages
(`/players`, `/events`, drafts) need a real Neon `DATABASE_URL`. Note
`drizzle-kit` migrations (`npm run db:migrate`) use node-postgres and *can*
target any Postgres, but that only covers schema, not the running app.

### Secrets needed only for specific features (all optional for lint/test/build/dev)

- `DATABASE_URL` — Neon Postgres; enables `/players`, `/events`, draft snapshots.
- `GOOGLE_DRIVE_API_KEY` + `GOOGLE_DRIVE_FOLDER_ID` — enables `/schedules` and
  `/create-league` (they fetch Drive template/schedule files).
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob; enables tournament audio clips
  (`/tournament` steps 2–3) and `/video-tools` uploads.

Without these, the pages still render but their data fetches fail. The fully
self-contained feature that works with zero secrets is the **`/tournament`
schedule + audio-cue generator** (reads the bundled `throwdown_5_schedule.csv`).

### Branch / PR workflow

Open feature PRs against **`preview`** (not `main`); a CI "Main merge gate"
rejects PRs into `main` unless the head branch is `preview`. See
[`.cursor/players-and-auth-runbook.md`](.cursor/players-and-auth-runbook.md).
