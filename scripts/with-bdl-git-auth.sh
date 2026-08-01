#!/usr/bin/env bash
# Configure git so pnpm can clone private jsartin513/bdl-packages.
# Uses BDL_PACKAGES_READ_TOKEN. Prefer http.extraHeader (same pattern as
# actions/checkout) so the token is not embedded in a git config key —
# embedding breaks URL insteadOf matching for some tokens/git versions.
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

# Rewrite SSH / scp-like GitHub URLs to HTTPS (lockfile resolves repo as git@github.com:...)
git config --global url."https://github.com/".insteadOf "git@github.com:"
git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "git+ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "https://git@github.com/"
git config --global url."https://github.com/".insteadOf "git+https://git@github.com/"
git config --global url."https://github.com/".insteadOf "git+https://github.com/"

# Authenticate HTTPS GitHub requests (basic auth with x-access-token)
BASIC="$(printf "x-access-token:%s" "${TOKEN}" | base64 | tr -d "\n")"
git config --global http.https://github.com/.extraheader "AUTHORIZATION: basic ${BASIC}"

# Sanity check that rewrite + auth can see the private repo
if ! git ls-remote "https://github.com/jsartin513/bdl-packages.git" HEAD >/dev/null 2>&1; then
  echo "error: BDL_PACKAGES_READ_TOKEN cannot read jsartin513/bdl-packages over HTTPS." >&2
  echo "Recreate a fine-grained PAT with Contents: Read on bdl-packages and re-run grant-consumer-access.sh." >&2
  exit 1
fi

exec "$@"

