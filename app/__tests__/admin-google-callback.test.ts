import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const adminAuth = vi.hoisted(() => ({
  alertWatchedAdminLoginAttempt: vi.fn().mockResolvedValue(undefined),
  clearAdminOAuthStateCookie: vi.fn(),
  isAllowedAdminEmail: vi.fn(() => true),
  readAdminOAuthState: vi.fn(() => 'expected-state'),
  setAdminSessionCookie: vi.fn(() => true),
}))

vi.mock('@/app/lib/admin-auth', () => adminAuth)

import { GET } from '@/app/api/admin/google/callback/route'

describe('admin Google callback', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv('ADMIN_GOOGLE_CLIENT_ID', 'google-client-id')
    vi.stubEnv('ADMIN_GOOGLE_CLIENT_SECRET', 'google-client-secret')
    vi.stubGlobal('fetch', fetchMock)

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id_token: 'google-id-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          aud: 'google-client-id',
          email: 'admin@example.com',
          email_verified: 'true',
        }),
      })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('keeps a decoded return-path cookie on the request origin', async () => {
    const requestUrl =
      'https://admin.example.com/api/admin/google/callback?state=expected-state&code=code'
    const request = {
      url: requestUrl,
      nextUrl: new URL(requestUrl),
      cookies: {
        get: (name: string) =>
          name === 'admin_oauth_next'
            ? { name, value: '/\\example.com' }
            : undefined,
      },
    } as unknown as NextRequest

    const response = await GET(request)

    expect(response.headers.get('location')).toBe(
      'https://admin.example.com/schedules'
    )
  })
})
