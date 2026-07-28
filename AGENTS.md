# Agent instructions

## Cursor Cloud specific instructions

This repo uses a **preview-first** deploy flow. Production merges go `preview` → `main` only after preview is verified.

### Pull requests (required)

- **Default base branch for new PRs: `preview`** (not `main`).
- When creating or updating pull requests (`ManagePullRequest`, `gh pr create`, etc.), always pass **`base_branch: "preview"`** unless you are explicitly opening a production promotion PR (`preview` → `main`).
- Feature and fix branches should merge into `preview` first. CI **Main merge gate** fails if a PR into `main` has any head branch other than `preview`.

### Branches

- Integration / preview deploy: `preview` → `admin-preview.bostondodgeballleague.com`
- Production: `main` → `admin.bostondodgeballleague.com`
- Cloud agent feature branches: `cursor/<descriptive-name>-4208` (or your topic branch), opened against **`preview`**.

### More detail

- [.cursor/git-pr-workflow.md](.cursor/git-pr-workflow.md)
- [.github/pull_request_template.md](.github/pull_request_template.md)
