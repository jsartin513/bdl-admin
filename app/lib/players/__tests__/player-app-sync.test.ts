import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  PLAYER_APP_SYNC_WRITABLE_COLUMNS,
  buildPlayerAppSyncPatch,
  fetchPlayerAppChanges,
  readPlayerAppSyncConfig,
  resolvePlayerForAppProfile,
  selfReportedSkillToOperational,
  type PlayerAppChangeProfile,
} from '@/app/lib/players/player-app-sync'
import type { ImportMatchIndex } from '@/app/lib/players/import-match'

function sampleProfile(
  overrides: Partial<PlayerAppChangeProfile> = {}
): PlayerAppChangeProfile {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    email: 'player@example.com',
    firstName: 'Pat',
    lastName: 'Player',
    selfReportedSkill: 'intermediate',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function emptyIndex(): ImportMatchIndex {
  return {
    emailToPlayerId: new Map(),
    nameToPlayerIds: new Map(),
    accountIdToPlayerId: new Map(),
    playersById: new Map(),
  }
}

describe('player-app-sync', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterEach(() => {
    process.env = env
  })

  it('maps self-reported skill labels to operational linear anchors', () => {
    expect(selfReportedSkillToOperational('beginner')).toBe(20)
    expect(selfReportedSkillToOperational('highly_advanced')).toBe(80)
    expect(selfReportedSkillToOperational(null)).toBeNull()
  })

  it('never lists official skill columns as writable from sync', () => {
    const forbidden = [
      'skillLevel',
      'skill_level',
      'skillLevelFib',
      'skillAreas',
      'hasStrongPersonality',
      'strongPersonalityNotes',
    ]
    for (const key of forbidden) {
      expect(PLAYER_APP_SYNC_WRITABLE_COLUMNS as readonly string[]).not.toContain(key)
    }
  })

  it('buildPlayerAppSyncPatch only includes mirror + self-report fields', () => {
    const patch = buildPlayerAppSyncPatch(sampleProfile(), {
      firstName: 'Pat',
      lastName: 'Old',
      selfReportedSkill: null,
      playerAppAccountId: null,
    })
    expect(patch).toEqual({
      playerAppAccountId: sampleProfile().accountId,
      selfReportedSkill: 40,
      lastName: 'Player',
    })
    expect(patch).not.toHaveProperty('skillLevel')
  })

  it('resolvePlayerForAppProfile prefers sticky player_app_account_id', () => {
    const index = emptyIndex()
    const playerId = '22222222-2222-4222-8222-222222222222'
    index.accountIdToPlayerId.set(sampleProfile().accountId, playerId)
    index.playersById.set(playerId, {
      id: playerId,
      firstName: 'Pat',
      lastName: 'Player',
      rosterName: 'Pat Player',
      jerseyNumber: null,
      skillLevel: 60,
      gender: null,
      isMerged: false,
      playerAppAccountId: sampleProfile().accountId,
      selfReportedSkill: null,
      emails: [],
    })

    const result = resolvePlayerForAppProfile(index, sampleProfile({ email: 'other@x.com' }))
    expect(result).toEqual({ status: 'matched', playerId })
  })

  it('resolvePlayerForAppProfile matches by email like TeamLinkt', () => {
    const index = emptyIndex()
    const playerId = '33333333-3333-4333-8333-333333333333'
    index.emailToPlayerId.set('player@example.com', playerId)
    index.playersById.set(playerId, {
      id: playerId,
      firstName: 'Pat',
      lastName: 'Player',
      rosterName: 'Pat Player',
      jerseyNumber: null,
      skillLevel: null,
      gender: null,
      isMerged: false,
      playerAppAccountId: null,
      selfReportedSkill: null,
      emails: ['player@example.com'],
    })

    const result = resolvePlayerForAppProfile(index, sampleProfile())
    expect(result).toEqual({ status: 'matched', playerId })
  })

  it('fetchPlayerAppChanges calls player internal API with secret header', async () => {
    process.env.PLAYER_APP_BASE_URL = 'https://play.example.com'
    process.env.PLAYER_SYNC_SECRET = 'sync-test-secret'
    const config = readPlayerAppSyncConfig()
    expect(config).not.toBeNull()

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'v1',
        cursor: '2026-01-02T00:00:00.000Z',
        profiles: [],
      }),
    })

    await fetchPlayerAppChanges(config!, '2026-01-01T00:00:00.000Z', fetchMock)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://play.example.com/api/internal/v1/changes')
    expect(parsed.searchParams.get('since')).toBe('2026-01-01T00:00:00.000Z')
    expect(init.headers).toMatchObject({
      'x-bdl-player-sync-secret': 'sync-test-secret',
    })
  })

  it('readPlayerAppSyncConfig returns null when env is incomplete', () => {
    delete process.env.PLAYER_APP_BASE_URL
    delete process.env.PLAYER_SYNC_SECRET
    expect(readPlayerAppSyncConfig()).toBeNull()
  })
})
