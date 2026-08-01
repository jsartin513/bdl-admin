#!/usr/bin/env bash
# Make private jsartin513/bdl-packages available to pnpm.
set -euo pipefail

ROOT="$(pwd)"

point_deps_at_vendor() {
  local vendor="$1"
  node --input-type=module <<EOF
import fs from "fs";
import path from "path";

const vendor = process.env.BDL_VENDOR;
const root = process.env.BDL_ROOT;
const re = /^github:jsartin513\\/bdl-packages#path:(.+)$/;

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
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\\n");
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

if [[ -n "${BDL_PACKAGES_LOCAL_PATH:-}" && -d "${BDL_PACKAGES_LOCAL_PATH}" ]]; then
  ABS="$(cd "${BDL_PACKAGES_LOCAL_PATH}" && pwd)"
  echo "using local bdl-packages at ${ABS} (file: deps)"
  export BDL_VENDOR="$ABS" BDL_ROOT="$ROOT"
  point_deps_at_vendor "$ABS"
  # Lockfile still points at git; allow resolution against file: deps.
  args=()
  for a in "$@"; do
    if [[ "$a" == "--frozen-lockfile" ]]; then
      args+=(--no-frozen-lockfile)
    else
      args+=("$a")
    fi
  done
  exec "${args[@]}"
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
AUTHED="https://x-access-token:${TOKEN}@github.com/jsartin513/bdl-packages.git"
if ! git ls-remote "${AUTHED}" HEAD >/dev/null 2>&1; then
  code="$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" https://api.github.com/repos/jsartin513/bdl-packages || true)"
  echo "error: BDL_PACKAGES_READ_TOKEN cannot read jsartin513/bdl-packages (api HTTP ${code})." >&2
  exit 1
fi

# Vercel/local: clone once and point file: deps at it
CLONE_DIR="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/bdl-packages-src"
rm -rf "${CLONE_DIR}"
git clone --depth 1 "${AUTHED}" "${CLONE_DIR}"
export BDL_VENDOR="${CLONE_DIR}" BDL_ROOT="$ROOT"
point_deps_at_vendor "${CLONE_DIR}"
args=()
for a in "$@"; do
  if [[ "$a" == "--frozen-lockfile" ]]; then
    args+=(--no-frozen-lockfile)
  else
    args+=("$a")
  fi
done
exec "${args[@]}"

