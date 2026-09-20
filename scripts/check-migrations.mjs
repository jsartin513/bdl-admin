#!/usr/bin/env node
/**
 * Fail if drizzle/*.sql and drizzle/meta/_journal.json are out of sync.
 * Unjournaled SQL is never applied by `drizzle-kit migrate` on deploy.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const drizzleDir = join(root, 'drizzle')
const journalPath = join(drizzleDir, 'meta', '_journal.json')

const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
const tags = journal.entries.map((e) => e.tag)
const tagSet = new Set(tags)

const sqlFiles = readdirSync(drizzleDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.replace(/\.sql$/, ''))

const unjournaled = sqlFiles.filter((t) => !tagSet.has(t))
const missingFiles = tags.filter((t) => !sqlFiles.includes(t))

const prefixes = sqlFiles.map((t) => t.split('_')[0])
const duplicatePrefixes = [
  ...new Set(
    prefixes.filter((p, i) => prefixes.indexOf(p) !== i)
  ),
]

const duplicateTags = tags.filter((t, i) => tags.indexOf(t) !== i)

let failed = false

if (unjournaled.length) {
  failed = true
  console.error(
    '[db:check-migrations] SQL files not in _journal.json (will NEVER run on deploy):',
    unjournaled
  )
}
if (missingFiles.length) {
  failed = true
  console.error(
    '[db:check-migrations] Journal tags with no matching drizzle/*.sql file:',
    missingFiles
  )
}
if (duplicatePrefixes.length) {
  failed = true
  console.error(
    '[db:check-migrations] Duplicate migration number prefixes:',
    duplicatePrefixes
  )
}
if (duplicateTags.length) {
  failed = true
  console.error('[db:check-migrations] Duplicate journal tags:', duplicateTags)
}

if (failed) {
  console.error(
    '[db:check-migrations] See .cursor/drizzle-migrations-runbook.md'
  )
  process.exit(1)
}

console.log(
  `[db:check-migrations] ok — ${tags.length} journal entries, ${sqlFiles.length} SQL files`
)
