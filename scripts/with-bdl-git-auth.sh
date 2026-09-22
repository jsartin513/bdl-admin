#!/usr/bin/env bash
# Install deps with pnpm; authenticate git clones of private bdl-packages when token is set.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -n "${BDL_PACKAGES_READ_TOKEN:-}" ]]; then
  export GIT_CONFIG_COUNT=2
  export GIT_CONFIG_KEY_0='url.https://github.com/.insteadOf'
  export GIT_CONFIG_VALUE_0="https://x-access-token:${BDL_PACKAGES_READ_TOKEN}@github.com/"
  export GIT_CONFIG_KEY_1='url.ssh://git@github.com/.insteadOf'
  export GIT_CONFIG_VALUE_1="https://x-access-token:${BDL_PACKAGES_READ_TOKEN}@github.com/"
fi

corepack enable pnpm 2>/dev/null || true
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi
