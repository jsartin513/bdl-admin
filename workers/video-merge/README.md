# Video Tools merge worker

Long-running Node process that claims queued upload sets from bdl-admin, downloads
clips from Vercel Blob, concatenates with system `ffmpeg` (`-c copy`, GoPro order),
and uploads `{Event}_{date}_{Label}_untrimmed.MP4`.

## Required env

| Variable | Purpose |
|----------|---------|
| `VIDEO_TOOLS_API_BASE` | Admin app origin, e.g. `https://admin.bostondodgeballleague.com` |
| `VIDEO_WORKER_SECRET` | Same value as in the admin app (Bearer auth) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read-write token |

## Local run

```bash
# from bdl-admin repo root (needs ffmpeg + npm deps)
export VIDEO_TOOLS_API_BASE=http://localhost:3000
export VIDEO_WORKER_SECRET=dev-secret
export BLOB_READ_WRITE_TOKEN=vercel_blob_...
node workers/video-merge/index.mjs
```

Also set `VIDEO_WORKER_SECRET` in the Next.js app (`.env.local` / Vercel).

## Docker / Fly.io

Build context is this directory (`workers/video-merge`):

```bash
cd workers/video-merge
# first time:
#   fly apps create bdl-video-merge
#   fly secrets set VIDEO_TOOLS_API_BASE=https://admin.bostondodgeballleague.com \
#     VIDEO_WORKER_SECRET=... BLOB_READ_WRITE_TOKEN=...
fly deploy
```

App: **`bdl-video-merge`** (primary region `ewr`). Monitor with `fly status` / `fly logs`.

Pushes to `main` that touch this directory auto-deploy via GitHub Actions (secret `FLY_API_TOKEN`). Manual: `fly deploy` from this directory.

Disk and memory need room for concurrent multi-GB court sets; bump VM size as needed.
