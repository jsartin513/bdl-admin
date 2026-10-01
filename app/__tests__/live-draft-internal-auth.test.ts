import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readInternalPlayerIdentity } from '@/app/lib/events/live-draft-internal-auth'

describe('readInternalPlayerIdentity', () => {
  beforeEach(() => {
    process.env.PLAYER_APP_BASE_URL = 'https://play.example.com'
    process.env.PLAYER_SYNC_SECRET = 'test-secret'
  })

  afterEach(() => {
    delete process.env.PLAYER_APP_BASE_URL
    delete process.env.PLAYER_SYNC_SECRET
  })

  it('rejects missing secret', () => {
    const req = new NextRequest('http://localhost/api/internal/v1/live-drafts')
    const result = readInternalPlayerIdentity(req)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns email when headers match', () => {
    const req = new NextRequest('http://localhost/api/internal/v1/live-drafts', {
      headers: {
        'x-bdl-player-sync-secret': 'test-secret',
        'x-bdl-player-email': 'captain@example.com',
      },
    })
    const result = readInternalPlayerIdentity(req)
    expect(result).toEqual({ email: 'captain@example.com', accountId: null })
  })
})
