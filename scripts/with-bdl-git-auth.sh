#!/usr/bin/env bash
# Configure git HTTPS auth so pnpm can clone private jsartin513/bdl-packages.
# Uses BDL_PACKAGES_READ_TOKEN (preferred). In GitHub Actions, GITHUB_TOKEN cannot
# read sibling private repos, so a dedicated PAT/secret is required.
set -euo pipefail

TOKEN="${BDL_PACKAGES_READ_TOKEN:-}"
if [[ -z "${TOKEN}" ]]; then
  if [[ -n "${CI:-}${GITHUB_ACTIONS:-}${VERCEL:-}" ]]; then
    echo "error: BDL_PACKAGES_READ_TOKEN is required to install private @bdl/* packages." >&2
    echo "Run bdl-packages/scripts/grant-consumer-access.sh on your machine to set it." >&2
    exit 1
  fi
  echo "warning: BDL_PACKAGES_READ_TOKEN unset; private bdl-packages clone may fail" >&2
  exec "$@"
fi

git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://git@github.com/"
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git@github.com:"
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git+ssh://git@github.com/"
# pnpm sometimes emits git+https://git@github.com/...
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git+https://git@github.com/"
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git+https://github.com/"

exec "$@"

