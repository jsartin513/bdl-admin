# Video Tools (bdl-admin)

Team UI for concurrent GoPro upload sets (e.g. Court 1 + Court 2) and cloud merge.

## App env (Vercel / `.env.local`)

| Variable | Purpose |
|----------|---------|
| `BLOB_READ_WRITE_TOKEN` | Already used for player/event photos; required for client video uploads |
| `VIDEO_WORKER_SECRET` | Shared bearer secret for `/api/video-tools/worker/*` |

## Worker env

See [`workers/video-merge/README.md`](../workers/video-merge/README.md).

## Flow

1. **Video Tools** → New upload set (event name, date, label)
2. Upload MP4s (multipart client → Vercel Blob)
3. **Start merge** → status `queued`
4. Worker claims job → ffmpeg concat → uploads `_untrimmed.MP4` → `complete`
