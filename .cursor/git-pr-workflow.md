# Git branches and pull requests

Use this when opening PRs, choosing a base branch, or promoting to production.

## Default: target `preview`

| PR type | Head branch | Base branch |
|---------|-------------|-------------|
| Feature / fix | `cursor/<name>-4208` or your topic branch | **`preview`** |
| Production promote | `preview` | `main` |

**Do not** open feature PRs against `main`. CI **Main merge gate** rejects any PR into `main` whose head is not `preview`.

## Deploy flow

1. Branch from `preview` (or merge latest `preview` into your branch).
2. Open PR **into `preview`**.
3. Merge → Vercel deploys [admin-preview](https://admin-preview.bostondodgeballleague.com).
4. CI **Preview smoke** checks `/login`, `/players`, `/events` (or run `npm run smoke:preview` locally).
5. When preview is good, open **`preview` → `main`**.
6. Merge to `main` → production at [admin](https://admin.bostondodgeballleague.com).

If `preview` is behind `main`, fast-forward or merge `main` into `preview` before new feature work.

## Agent / Cloud instructions

When using `ManagePullRequest`:

```text
create_pr: base_branch = "preview"   # default for feature/fix work
update_pr: base_branch = "preview"  # when retargeting a mis-aimed PR
```

Only set `base_branch: "main"` when opening the production promotion PR (`preview` → `main`).

## Cloud Agents dashboard

Set **Base branch** to `preview` in [Cloud Agents → Default settings](https://cursor.com/dashboard/cloud-agents) for this repo. When blank, Cursor uses the GitHub repository default branch.

## Related files

- [.github/pull_request_template.md](../.github/pull_request_template.md) — PR checklist
- [.github/workflows/main-merge-gate.yml](../.github/workflows/main-merge-gate.yml) — enforces preview-only merges to main
- [.github/workflows/preview-smoke.yml](../.github/workflows/preview-smoke.yml) — post-merge preview health check
- [.cursor/players-and-auth-runbook.md](./players-and-auth-runbook.md) — environment hosts and auth
