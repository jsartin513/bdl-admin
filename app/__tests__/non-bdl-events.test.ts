import { describe, expect, it } from 'vitest'
import { buildGoodLuckBlurb } from '@/app/lib/non-bdl-events/good-luck'
import {
  hostOrgDisplayLabel,
  parseHostOrgForCreate,
  parseHostOrgPatch,
} from '@/app/lib/non-bdl-events/types'

describe('non-bdl host org', () => {
  it('accepts known league only', () => {
    expect(
      parseHostOrgForCreate({ hostOrgHomeLeague: 'philly_dodgeball' })
    ).toEqual({
      hostOrgHomeLeague: 'philly_dodgeball',
      hostOrgName: null,
    })
  })

  it('accepts free text only', () => {
    expect(parseHostOrgForCreate({ hostOrgName: 'Local Club' })).toEqual({
      hostOrgHomeLeague: null,
      hostOrgName: 'Local Club',
    })
  })

  it('rejects empty host org', () => {
    expect(() => parseHostOrgForCreate({})).toThrow(/host org is required/)
    expect(() =>
      parseHostOrgForCreate({ hostOrgHomeLeague: '', hostOrgName: '' })
    ).toThrow(/host org is required/)
  })

  it('patch cannot clear both host fields', () => {
    expect(() =>
      parseHostOrgPatch(
        { hostOrgHomeLeague: null, hostOrgName: null },
        {
          hostOrgHomeLeague: 'philly_dodgeball',
          hostOrgName: null,
        }
      )
    ).toThrow(/host org is required/)
  })

  it('formats display label', () => {
    expect(hostOrgDisplayLabel('philly_dodgeball', null)).toBe(
      'Philly Dodgeball'
    )
    expect(hostOrgDisplayLabel(null, 'Custom Host')).toBe('Custom Host')
    expect(hostOrgDisplayLabel('philly_dodgeball', 'Foam Fest Host')).toBe(
      'Foam Fest Host (Philly Dodgeball)'
    )
  })
})

describe('good luck blurb', () => {
  it('groups players by team', () => {
    const blurb = buildGoodLuckBlurb({
      event: {
        name: 'Philly Foam Classic',
        eventDate: '2026-08-15',
        ballType: 'foam',
        division: 'Open',
        city: 'Philadelphia',
        hostOrgHomeLeague: 'philly_dodgeball',
        hostOrgName: null,
      },
      teams: [
        {
          id: 't1',
          eventId: 'e1',
          name: 'Squish Squad',
          resultText: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      attendees: [
        {
          id: 'a1',
          eventId: 'e1',
          playerId: 'p1',
          teamId: 't1',
          teamName: 'Squish Squad',
          notes: null,
          firstName: 'Alex',
          lastName: 'Rivera',
          rosterName: 'Alex Rivera',
          nickname: 'Alex R',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'a2',
          eventId: 'e1',
          playerId: 'p2',
          teamId: null,
          teamName: null,
          notes: null,
          firstName: 'Sam',
          lastName: 'Lee',
          rosterName: 'Sam Lee',
          nickname: 'Sam L',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })

    expect(blurb).toContain('Philly Foam Classic')
    expect(blurb).toContain('Foam ball')
    expect(blurb).toContain('Open division')
    expect(blurb).toContain('Squish Squad: Alex R')
    expect(blurb).toContain('Playing (team TBD): Sam L')
    expect(blurb).toContain('Go BDL!')
  })
})
