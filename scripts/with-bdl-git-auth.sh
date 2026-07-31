#!/usr/bin/env bash
# Configure git HTTPS auth so pnpm can clone private jsartin513/bdl-packages.
# Uses BDL_PACKAGES_READ_TOKEN (preferred) or GITHUB_TOKEN.
set -euo pipefail

TOKEN="${BDL_PACKAGES_READ_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -n "${TOKEN}" ]]; then
  git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"
  git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://git@github.com/"
  git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "ssh://git@github.com/"
  git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git@github.com:"
  git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git+ssh://git@github.com/"
else
  echo "warning: BDL_PACKAGES_READ_TOKEN/GITHUB_TOKEN unset; private bdl-packages clone may fail" >&2
fi

exec "$@"

