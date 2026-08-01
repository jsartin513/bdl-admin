#!/usr/bin/env node
/**
 * Run Drizzle migrations when DATABASE_URL is available (Vercel builds).
 * Skip cleanly otherwise so CI / local builds without a DB still succeed.
 */
import { spawnSync } from 'node:child_process'

const databaseUrl = process.env.DATABASE_URL?.trim()

if (!databaseUrl) {
  console.log(
    '[db:migrate:deploy] Skipping migrations (DATABASE_URL is not set).'
  )
  process.exit(0)
}

console.log('[db:migrate:deploy] Applying pending Drizzle migrations…')
const result = spawnSync('npx', ['drizzle-kit', 'migrate'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

if (result.error) {
  console.error('[db:migrate:deploy] Failed to start drizzle-kit:', result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
