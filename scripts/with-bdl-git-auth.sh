#!/usr/bin/env bash
# Make private jsartin513/bdl-packages available to pnpm (CI + Vercel).
set -euo pipefail

ROOT="$(pwd)"

point_deps_at_vendor() {
  local vendor="$1"
  BDL_VENDOR="$vendor" BDL_ROOT="$ROOT" node --input-type=module <<'EOF'
import fs from "fs";
import path from "path";

const vendor = process.env.BDL_VENDOR;
const root = process.env.BDL_ROOT;
const re = /^github:jsartin513\/bdl-packages#path:(.+)$/;

function rewriteFile(file) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  let changed = false;
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const deps = pkg[section];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      const m = typeof spec === "string" ? spec.match(re) : null;
      if (!m) continue;
      const abs = path.join(vendor, m[1]);
      const rel = path.relative(path.dirname(file), abs);
      deps[name] = "file:" + (rel.startsWith(".") ? rel : "./" + rel);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
    console.log("rewrote", path.relative(root, file));
  }
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git" || ent.name === ".vendor") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name === "package.json") rewriteFile(p);
  }
}

walk(root);
EOF
}

run_pnpm() {
  local args=()
  for a in "$@"; do
    if [[ "$a" == "--frozen-lockfile" ]]; then
      args+=(--no-frozen-lockfile)
    else
      args+=("$a")
    fi
  done
  exec "${args[@]}"
}

fetch_bdl_packages() {
  local dest="$1"
  local token="$2"
  rm -rf "${dest}"
  mkdir -p "${dest}"
  echo "downloading bdl-packages tarball via GitHub API..."
  # API tarball avoids git/SSH auth issues on Vercel.
  if ! curl -fsSL \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/jsartin513/bdl-packages/tarball/main" \
    | tar -xz --strip-components=1 -C "${dest}"; then
    echo "error: failed to download jsartin513/bdl-packages with BDL_PACKAGES_READ_TOKEN." >&2
    echo "Ensure the token has Contents: Read and is set in Vercel Project Env." >&2
    exit 1
  fi
  if [[ ! -f "${dest}/package.json" ]]; then
    echo "error: bdl-packages tarball did not unpack as expected into ${dest}" >&2
    ls -la "${dest}" >&2 || true
    exit 1
  fi
}

if [[ -z "${BDL_PACKAGES_LOCAL_PATH:-}" && -f "${ROOT}/.vendor/bdl-packages/package.json" ]]; then
  # Auto-detect CI/submodule checkout
  BDL_PACKAGES_LOCAL_PATH="${ROOT}/.vendor/bdl-packages"
fi

if [[ -n "${BDL_PACKAGES_LOCAL_PATH:-}" && -d "${BDL_PACKAGES_LOCAL_PATH}" ]]; then
  ABS="$(cd "${BDL_PACKAGES_LOCAL_PATH}" && pwd)"
  echo "using local bdl-packages at ${ABS} (file: deps)"
  point_deps_at_vendor "$ABS"
  run_pnpm "$@"
fi

TOKEN="${BDL_PACKAGES_READ_TOKEN:-}"
if [[ -z "${TOKEN}" ]]; then
  if [[ -n "${CI:-}${GITHUB_ACTIONS:-}${VERCEL:-}" ]]; then
    echo "error: need BDL_PACKAGES_LOCAL_PATH or BDL_PACKAGES_READ_TOKEN for private @bdl/* installs." >&2
    exit 1
  fi
  echo "warning: no bdl-packages auth configured; private clone may fail" >&2
  exec "$@"
fi

TOKEN="$(printf "%s" "${TOKEN}" | tr -d "\r\n")"
CLONE_DIR="${VERCEL_TMPDIR:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}}/bdl-packages-src"
fetch_bdl_packages "${CLONE_DIR}" "${TOKEN}"
echo "using downloaded bdl-packages at ${CLONE_DIR} (file: deps)"
point_deps_at_vendor "${CLONE_DIR}"
run_pnpm "$@"

