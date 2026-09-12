# Video Tools (bdl-admin)

Team UI for concurrent GoPro upload sets (e.g. Court 1 + Court 2) and cloud merge.

## Architecture (two deployables)

```
Admin (Vercel)                         Worker (Fly.io)
──────────────                         ───────────────
/video-tools UI                        bdl-video-merge (ewr)
Blob multipart uploads                 polls every 15s
POST …/enqueue → status=queued    →    POST /api/video-tools/worker/claim
                                       ffmpeg concat (-c copy)
                                       upload _untrimmed.MP4
                                  ←    POST …/worker/complete
```

| Piece | Host | What it does |
|-------|------|----------------|
| **bdl-admin** | Vercel | UI, APIs, Blob upload tokens, job status in Postgres |
| **bdl-video-merge** | Fly.io | Long-running Node + ffmpeg; claims queued sets and merges |

Deploying the Next.js app alone does **not** start merges. Jobs stay **queued** until the Fly worker is running and can authenticate with the same `VIDEO_WORKER_SECRET`.

## App env (Vercel / `.env.local`)

| Variable | Purpose |
|----------|---------|
| `BLOB_READ_WRITE_TOKEN` | Already used for player/event photos; required for client video uploads |
| `VIDEO_WORKER_SECRET` | Shared bearer secret for `/api/video-tools/worker/*` |
| `RESEND_API_KEY` | Optional. When set with `NOTIFY_FROM_EMAIL`, email on merge complete/fail |
| `NOTIFY_FROM_EMAIL` | Optional Resend “from” address for merge notifications |
| `NEXT_PUBLIC_APP_URL` | Optional absolute site URL used in notification email links |

## Worker env (Fly secrets)

See [`workers/video-merge/README.md`](../workers/video-merge/README.md).

| Variable | Purpose |
|----------|---------|
| `VIDEO_TOOLS_API_BASE` | Prod admin origin: `https://admin.bostondodgeballleague.com` |
| `VIDEO_WORKER_SECRET` | **Same value** as Vercel |
| `BLOB_READ_WRITE_TOKEN` | **Same** Blob read/write token as Vercel |

Production worker: Fly app **`bdl-video-merge`**, region **`ewr`** (Newark; `bos` is deprecated for new machines).

```bash
cd workers/video-merge
fly status
fly logs
fly deploy   # after worker code changes (or rely on GitHub Action on main)
```

### Secret rotation

Update **both** Vercel (`VIDEO_WORKER_SECRET`) and Fly (`fly secrets set VIDEO_WORKER_SECRET=… -a bdl-video-merge`). Mismatch → claim returns 401 and jobs stay queued.

### Preview vs production

The Fly worker is pointed at **production** admin. Merges started on [admin-preview](https://admin-preview.bostondodgeballleague.com) are **not** claimed unless you run a separate worker with `VIDEO_TOOLS_API_BASE` set to the preview URL. Prefer end-to-end merge tests against production (or a local worker + local/preview app).

## Flow

1. **Video Tools** → New upload set (event name, date, label)
2. Upload MP4s (multipart client → Vercel Blob). Details can be edited while uploading.
3. Optional: enable **When uploads finish, start merge automatically** (use one fully successful batch, or turn this on after every clip is uploaded)
4. Or manually **Mark ready** → **Start merge** → status `queued`
5. Fly worker claims job → ffmpeg concat → uploads `_untrimmed.MP4` → `complete`
6. In-app notification (nav **Alerts**) for the set creator; optional email if Resend is configured

Keep the browser tab open until uploads finish. After enqueue, merge is backgrounded.

### Stuck on “queued”

1. `fly status -a bdl-video-merge` — machine should be `started`
2. `fly logs -a bdl-video-merge` — look for `polling https://admin…`
3. Confirm Vercel + Fly share the same `VIDEO_WORKER_SECRET`
4. Use **Retry merge** on the set page after the worker is healthy

## CI / auto-deploy

- Pushing changes under `workers/video-merge/` to **`main`** runs [`.github/workflows/deploy-video-merge-worker.yml`](../.github/workflows/deploy-video-merge-worker.yml) (`fly deploy`).
- Requires GitHub Actions secret **`FLY_API_TOKEN`** (Fly dashboard → Account → Access Tokens, or `fly tokens create deploy -x 999999h`).
- Admin app continues to deploy via the normal Vercel Git integration (preview → main).

## Local testing with short demo clips

### Generate fixtures

Requires `ffmpeg` and `python3` with Pillow. Writes gitignored MP4s under `tmp/gopro-demo-clips/`:

```bash
bash scripts/generate-gopro-demo-clips.sh
```

Creates 2s H.264 clips with large on-screen step numbers (1–6), GoPro chapter names, plus an offline `merged_smoke.MP4` concat in correct order.

| File | Expected step |
|------|---------------|
| `GOPR0010.MP4` | 1 |
| `GX010010.MP4` | 2 |
| `GX020010.MP4` | 3 |
| `GX030010.MP4` | 4 |
| `GX010020.MP4` | 5 (session 0020 after 0010) |
| `zzz_tail.mp4` | 6 (non-GoPro, after all GoPro) |

To reuse after an upload, rename to a new session id (e.g. `0010` → `0030`) or re-run the script.

### Unit tests (ordering / naming only)

```bash
npx vitest run app/lib/video-tools
```

### Local E2E (app + worker)

1. Ensure `.env.local` has `BLOB_READ_WRITE_TOKEN` and `VIDEO_WORKER_SECRET`.
2. Start the Next app (`npm run dev` or equivalent).
3. Start the merge worker in another terminal:

```bash
export VIDEO_TOOLS_API_BASE=http://localhost:3000
export VIDEO_WORKER_SECRET=…   # same as app
export BLOB_READ_WRITE_TOKEN=…
node workers/video-merge/index.mjs
```

4. **Video Tools** → New upload set (e.g. `Demo Event` / `Court 1` / today’s date).
5. Drop the six clips from `tmp/gopro-demo-clips/` **out of order** (skip `merged_smoke.MP4` and `concat_list.txt`).
6. **Mark ready** → **Start merge** (or enable auto-start) → wait for `complete`.
7. Download the `_untrimmed.MP4` and confirm playback shows steps **1 → 2 → 3 → 4 → 5 → 6** (not upload order).

Optional concurrent check: create a second set (`Court 2`) and upload another batch (re-run the script into a second folder, or duplicate/rename with a different session id) so both merges finish independently without mixing clips.
