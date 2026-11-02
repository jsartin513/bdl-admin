import { describe, expect, it } from 'vitest'
import {
  CAPTAIN_DRAFT_PLAYER_FIELD_KEYS,
  CAPTAIN_DRAFT_FORBIDDEN_KEYS,
  assertCaptainDraftPayload,
  captainCuratedSkillLabel,
  mapToCaptainPoolPlayer,
  type CaptainDraftSnapshot,
} from '@/app/lib/captain-draft/contract'

describe('captain draft contract', () => {
  it('maps pool players to allowlisted fields only', () => {
    const player = mapToCaptainPoolPlayer({
      registrationId: 'reg-1',
      nickname: 'Ace',
      firstName: 'Alex',
      lastName: 'Example',
      gender: 'female',
      skillLevel: 45,
      photoUrl: 'https://example.com/p.jpg',
    })
    expect(Object.keys(player).sort()).toEqual([...CAPTAIN_DRAFT_PLAYER_FIELD_KEYS].sort())
    expect(player.skillLabel).toBe('Intermediate')
    assertCaptainDraftPayload({ pool: [player] })
  })

  it('uses anchor skill labels only', () => {
    expect(captainCuratedSkillLabel(20)).toBe('Beginner')
    expect(captainCuratedSkillLabel(60)).toBe('Advanced')
    expect(captainCuratedSkillLabel(null)).toBe('Unset')
  })

  it('rejects forbidden keys in serialized snapshots', () => {
    const snapshot: CaptainDraftSnapshot = {
      version: 1,
      eventId: 'evt',
      eventName: 'Throwdown',
      status: 'live',
      viewer: { email: 'c@example.com', draftGroup: 2, isCaptain: true },
      turn: {
        pickIndex: 0,
        draftGroup: 1,
        teamName: 'Team 1',
        isComplete: false,
      },
      pool: [
        mapToCaptainPoolPlayer({
          registrationId: 'r1',
          nickname: null,
          firstName: 'A',
          lastName: 'B',
          gender: 'male',
          skillLevel: 40,
          photoUrl: null,
        }),
      ],
      teams: [],
      rules: {
        minWomenNb: 3,
        includeOtherInWomenNb: false,
        minIntermediate: 2,
        intermediateMin: 30,
        intermediateMax: 50,
      },
      playDraftUrl: 'https://play.example.com/drafts/evt',
    }
    assertCaptainDraftPayload(snapshot)

    for (const key of CAPTAIN_DRAFT_FORBIDDEN_KEYS) {
      const bad = { ...snapshot, [key]: 'leak' }
      expect(() => assertCaptainDraftPayload(bad)).toThrow(/Forbidden captain-draft key/)
    }
  })
})
