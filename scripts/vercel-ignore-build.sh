#!/usr/bin/env bash
# Vercel Ignored Build Step: exit 0 to skip deploy, exit 1 to build.
# See README.md "Deploy on Vercel" and vercel.json ignoreCommand.
set -euo pipefail

if ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  cd "$ROOT"
else
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  cd "$ROOT"
fi

prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -z "$prev" ]] || ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  exit 1
fi

ref="${VERCEL_GIT_COMMIT_REF:-}"
if [[ "$ref" != "preview" && "$ref" != "main" ]]; then
  exit 0
fi

mapfile -t changed < <(git diff --name-only "$prev" HEAD)
if ((${#changed[@]} == 0)); then
  exit 0
fi

for file in "${changed[@]}"; do
  [[ -z "$file" ]] && continue
  if [[ "$file" == docs/* ]] || [[ "$file" == *.md ]]; then
    continue
  fi
  exit 1
done

exit 0
