import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', () => ({
  NextRequest: class NextRequest {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}))

import {
  createAdminSessionToken,
  isAdminAllowlistConfigured,
  isAllowedAdminEmail,
  readAdminSession,
} from '@/app/lib/admin-auth'
import { readAdminSessionEdge } from '@/app/lib/admin-session-edge'

describe('admin auth session', () => {
  const originalSecret = process.env.ADMIN_SESSION_SECRET
  const originalAllowed = process.env.ADMIN_ALLOWED_EMAILS
  const originalVercelEnv = process.env.VERCEL_ENV

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret'
    delete process.env.ADMIN_ALLOWED_EMAILS
    delete process.env.VERCEL_ENV
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = originalSecret

    if (originalAllowed === undefined) delete process.env.ADMIN_ALLOWED_EMAILS
    else process.env.ADMIN_ALLOWED_EMAILS = originalAllowed

    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = originalVercelEnv
  })

  it('creates and verifies a signed admin session token', () => {
    const token = createAdminSessionToken('admin@example.com')
    expect(token).toBeTruthy()

    const session = readAdminSession(token)
    expect(session?.email).toBe('admin@example.com')
    expect(session?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('rejects tampered tokens', () => {
    const token = createAdminSessionToken('admin@example.com')
    expect(token).toBeTruthy()

    const tampered = `${token}tamper`
    expect(readAdminSession(tampered)).toBeNull()
  })

  it('enforces ADMIN_ALLOWED_EMAILS when configured', () => {
    process.env.ADMIN_ALLOWED_EMAILS = 'admin@example.com,owner@example.com'

    expect(isAdminAllowlistConfigured()).toBe(true)
    expect(isAllowedAdminEmail('admin@example.com')).toBe(true)
    expect(isAllowedAdminEmail('owner@example.com')).toBe(true)
    expect(isAllowedAdminEmail('other@example.com')).toBe(false)
  })

  it('denies all sign-ins in production when allowlist is unset', () => {
    process.env.VERCEL_ENV = 'production'

    expect(isAdminAllowlistConfigured()).toBe(false)
    expect(isAllowedAdminEmail('admin@example.com')).toBe(false)
  })

  it('allows any email in non-production when allowlist is unset', () => {
    expect(isAllowedAdminEmail('anyone@example.com')).toBe(true)
  })

  it('edge verifier accepts tokens from node signer', async () => {
    const token = createAdminSessionToken('admin@example.com')
    expect(token).toBeTruthy()
    const session = await readAdminSessionEdge(token)
    expect(session?.email).toBe('admin@example.com')
  })
})
