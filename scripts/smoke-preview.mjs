#!/usr/bin/env node
/**
 * Smoke-check that the stable preview host serves key admin routes.
 * Auth-gated pages should redirect to /login (not 5xx). /login should be 200.
 *
 * Usage:
 *   PREVIEW_BASE_URL=https://admin-preview.bostondodgeballleague.com node scripts/smoke-preview.mjs
 *   node scripts/smoke-preview.mjs --wait   # retry until healthy or timeout
 */

const BASE =
  process.env.PREVIEW_BASE_URL?.replace(/\/$/, '') ||
  'https://admin-preview.bostondodgeballleague.com'

const WAIT = process.argv.includes('--wait')
const MAX_ATTEMPTS = WAIT ? 36 : 1
const DELAY_MS = 10_000

const PATHS = [
  { path: '/login', expect: 'ok' },
  { path: '/players', expect: 'auth_redirect' },
  { path: '/events', expect: 'auth_redirect' },
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function checkPath({ path, expect }) {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: { Accept: 'text/html,application/json' },
  })

  const status = res.status
  const location = res.headers.get('location') || ''

  if (expect === 'ok') {
    if (status !== 200) {
      throw new Error(`${path}: expected 200, got ${status}`)
    }
    return
  }

  if (expect === 'auth_redirect') {
    // Middleware redirects unauthenticated HTML routes to /login.
    if (status !== 307 && status !== 302 && status !== 303) {
      throw new Error(
        `${path}: expected auth redirect (302/303/307), got ${status}`
      )
    }
    if (!location.includes('/login')) {
      throw new Error(
        `${path}: redirect Location should include /login, got ${location || '(empty)'}`
      )
    }
    return
  }

  throw new Error(`Unknown expect: ${expect}`)
}

async function runOnce() {
  const results = []
  for (const spec of PATHS) {
    await checkPath(spec)
    results.push(`${spec.path} ok`)
  }
  return results
}

async function main() {
  console.log(`Smoke checking ${BASE}`)
  let lastError = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const results = await runOnce()
      for (const line of results) console.log(`  ✓ ${line}`)
      console.log('Smoke checks passed.')
      process.exit(0)
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  attempt ${attempt}/${MAX_ATTEMPTS}: ${msg}`)
      if (attempt < MAX_ATTEMPTS) await sleep(DELAY_MS)
    }
  }

  console.error(`Smoke checks failed: ${lastError?.message || lastError}`)
  process.exit(1)
}

main()
