#!/usr/bin/env bash
# Install deps with pnpm; authenticate git clones of private bdl-packages when token is set.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -n "${BDL_PACKAGES_READ_TOKEN:-}" ]]; then
  git config --global url."https://x-access-token:${BDL_PACKAGES_READ_TOKEN}@github.com/".insteadOf "https://github.com/"
  git config --global url."https://x-access-token:${BDL_PACKAGES_READ_TOKEN}@github.com/".insteadOf "ssh://git@github.com/"
  git config --global url."https://x-access-token:${BDL_PACKAGES_READ_TOKEN}@github.com/".insteadOf "git@github.com:"
fi

corepack enable pnpm 2>/dev/null || true
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi
