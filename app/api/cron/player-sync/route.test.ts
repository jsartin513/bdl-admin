import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

const pullMock = vi.fn()

vi.mock('@/app/lib/players/player-app-sync', () => ({
  pullAndApplyPlayerAppChanges: (...args: unknown[]) => pullMock(...args),
}))

function cronRequest(secret?: string) {
  const headers = secret ? { authorization: `Bearer ${secret}` } : {}
  return new NextRequest('http://localhost/api/cron/player-sync', { headers })
}

describe('/api/cron/player-sync', () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-test-secret'
    pullMock.mockReset()
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret
  })

  it('returns 503 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(cronRequest('anything'))
    expect(res.status).toBe(503)
  })

  it('returns 401 without a valid bearer token', async () => {
    const res = await GET(cronRequest())
    expect(res.status).toBe(401)
    expect(pullMock).not.toHaveBeenCalled()
  })

  it('returns 401 with a wrong bearer token', async () => {
    const res = await GET(cronRequest('wrong'))
    expect(res.status).toBe(401)
    expect(pullMock).not.toHaveBeenCalled()
  })

  it('delegates to pullAndApplyPlayerAppChanges when authorized', async () => {
    pullMock.mockResolvedValue({
      configured: true,
      applied: 2,
      skipped: 1,
      ambiguous: 0,
      errors: [],
      cursor: 'cursor-abc',
    })

    const res = await GET(cronRequest('cron-test-secret'))
    expect(res.status).toBe(200)
    expect(pullMock).toHaveBeenCalledWith(null)
    const body = await res.json()
    expect(body).toEqual({
      applied: 2,
      skipped: 1,
      ambiguous: 0,
      errors: [],
      cursor: 'cursor-abc',
    })
  })

  it('returns skipped when player sync env is not configured', async () => {
    pullMock.mockResolvedValue({
      configured: false,
      applied: 0,
      skipped: 0,
      ambiguous: 0,
      errors: [],
      cursor: null,
    })

    const res = await POST(cronRequest('cron-test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skipped).toBe(true)
    expect(body.reason).toMatch(/not configured/i)
  })
})
