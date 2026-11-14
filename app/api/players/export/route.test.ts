import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET } from './route'

const getSessionMock = vi.fn()
const listPlayersMock = vi.fn()
const lastLeagueMock = vi.fn()

vi.mock('@/app/lib/admin-auth', () => ({
  getAdminSessionFromRequest: (...args: unknown[]) => getSessionMock(...args),
  adminUnauthorizedResponse: () =>
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
}))

vi.mock('@/app/lib/players/queries', () => ({
  listPlayers: (...args: unknown[]) => listPlayersMock(...args),
  getLastLeagueEventByPlayerIds: (...args: unknown[]) => lastLeagueMock(...args),
}))

function exportRequest(query = '') {
  return new NextRequest(`http://localhost/api/players/export${query}`)
}

describe('GET /api/players/export', () => {
  beforeEach(() => {
    getSessionMock.mockReset()
    listPlayersMock.mockReset()
    lastLeagueMock.mockReset()
    listPlayersMock.mockResolvedValue([])
    lastLeagueMock.mockResolvedValue(new Map())
  })

  it('returns 401 without an admin session', async () => {
    getSessionMock.mockReturnValue(null)
    const res = await GET(exportRequest())
    expect(res.status).toBe(401)
    expect(listPlayersMock).not.toHaveBeenCalled()
  })

  it('returns CSV with attachment headers when authorized', async () => {
    getSessionMock.mockReturnValue({ email: 'admin@example.com', exp: 0 })
    const res = await GET(exportRequest('?homeLeague=boston_dodgeball_league'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="bdl-players-\d{4}-\d{2}-\d{2}\.csv"$/
    )
    const body = await res.text()
    expect(body.startsWith('id,first_name,last_name')).toBe(true)
    expect(listPlayersMock).toHaveBeenCalledWith(
      expect.objectContaining({ homeLeague: 'boston_dodgeball_league' })
    )
  })
})
