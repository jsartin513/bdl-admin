## Base branch

- **Feature / fix PRs:** target **`preview`** (not `main`).
- **Production promote:** open **`preview` → `main`** only after the preview deploy is up and Preview smoke has passed.

## Summary

-

## Test plan

- [ ] Lint / unit / build CI green
- [ ] If targeting `preview`: confirm [admin-preview](https://admin-preview.bostondodgeballleague.com) deploys and `/players` + `/events` load (sign in)
- [ ] If targeting `main`: head branch is `preview` and Preview smoke is green
- [ ] If changing `workers/video-merge/`: after merge to `main`, confirm Fly deploy workflow succeeds (`bdl-video-merge`); merges stay queued until that worker is healthy
