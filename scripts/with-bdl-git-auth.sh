#!/usr/bin/env bash
# Make private jsartin513/bdl-packages clonable for pnpm.
#
# Preferred in GitHub Actions: checkout the repo to BDL_PACKAGES_LOCAL_PATH
# (actions/checkout + token), then rewrite git URLs to that local path.
# Fallback: HTTPS auth via BDL_PACKAGES_READ_TOKEN for Vercel/local CI.
set -euo pipefail

rewrite_repo_urls() {
  local target="$1" # file:///... or https://x-access-token:TOKEN@github.com/
  git config --global url."${target}".insteadOf "git@github.com:jsartin513/bdl-packages.git"
  git config --global url."${target}".insteadOf "https://github.com/jsartin513/bdl-packages.git"
  git config --global url."${target}".insteadOf "ssh://git@github.com/jsartin513/bdl-packages.git"
  git config --global url."${target}".insteadOf "https://git@github.com/jsartin513/bdl-packages.git"
  git config --global url."${target}".insteadOf "git+ssh://git@github.com/jsartin513/bdl-packages.git"
  git config --global url."${target}".insteadOf "git+https://git@github.com/jsartin513/bdl-packages.git"
  git config --global url."${target}".insteadOf "git+https://github.com/jsartin513/bdl-packages.git"
}

if [[ -n "${BDL_PACKAGES_LOCAL_PATH:-}" && -d "${BDL_PACKAGES_LOCAL_PATH}" ]]; then
  ABS="$(cd "${BDL_PACKAGES_LOCAL_PATH}" && pwd)"
  echo "using local bdl-packages at ${ABS}"
  rewrite_repo_urls "file://${ABS}"
  exec "$@"
fi

TOKEN="${BDL_PACKAGES_READ_TOKEN:-}"
if [[ -z "${TOKEN}" ]]; then
  if [[ -n "${CI:-}${GITHUB_ACTIONS:-}${VERCEL:-}" ]]; then
    echo "error: need BDL_PACKAGES_LOCAL_PATH or BDL_PACKAGES_READ_TOKEN for private @bdl/* installs." >&2
    echo "Run bdl-packages/scripts/grant-consumer-access.sh and ensure CI checks out bdl-packages." >&2
    exit 1
  fi
  echo "warning: no bdl-packages auth configured; private clone may fail" >&2
  exec "$@"
fi

# Strip CR/LF that sometimes sneak into secrets
TOKEN="$(printf "%s" "${TOKEN}" | tr -d "\r\n")"

AUTHED="https://x-access-token:${TOKEN}@github.com/jsartin513/bdl-packages.git"
if ! git ls-remote "${AUTHED}" HEAD >/dev/null 2>&1; then
  code="$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" https://api.github.com/repos/jsartin513/bdl-packages || true)"
  echo "error: BDL_PACKAGES_READ_TOKEN cannot read jsartin513/bdl-packages (git ls-remote failed; api HTTP ${code})." >&2
  echo "Use a fine-grained PAT with Contents: Read on bdl-packages; re-run grant-consumer-access.sh." >&2
  exit 1
fi

rewrite_repo_urls "https://x-access-token:${TOKEN}@github.com/jsartin513/bdl-packages.git"
# Also map the org root so path-suffixed clones resolve
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git@github.com:"
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"

exec "$@"

