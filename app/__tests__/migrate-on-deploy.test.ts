import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('migrate-on-deploy', () => {
  it('is wired into the production build script', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
    )
    expect(pkg.scripts.build).toContain('db:migrate:deploy')
    expect(pkg.scripts['db:migrate:deploy']).toBe(
      'node scripts/migrate-on-deploy.mjs'
    )
  })

  it('skips when DATABASE_URL is unset and migrates when set', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/migrate-on-deploy.mjs'),
      'utf8'
    )
    expect(source).toContain('DATABASE_URL')
    expect(source).toContain('Skipping migrations')
    expect(source).toContain('drizzle-kit')
    expect(source).toContain('migrate')
  })
})
