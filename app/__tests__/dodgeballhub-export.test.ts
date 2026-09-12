import { describe, expect, it } from 'vitest'
import {
  DODGEBALLHUB_ROSTER_CSV_HEADERS,
  buildDodgeballHubRosterCsv,
  buildDodgeballHubRosterRows,
  normalizeTeamNames,
  resolveTeamName,
} from '@/app/lib/events/dodgeballhub-export'

describe('resolveTeamName', () => {
  it('uses ordered names when present', () => {
    expect(resolveTeamName(1, ['Alpha', 'Beta'])).toBe('Alpha')
    expect(resolveTeamName(2, ['Alpha', 'Beta'])).toBe('Beta')
  })

  it('falls back to Team N when name missing or blank', () => {
    expect(resolveTeamName(1, [])).toBe('Team 1')
    expect(resolveTeamName(3, ['Alpha'])).toBe('Team 3')
    expect(resolveTeamName(2, ['Alpha', '  '])).toBe('Team 2')
  })

  it('ignores extra names beyond team count usage', () => {
    expect(resolveTeamName(1, ['Only', 'Extra', 'Names'])).toBe('Only')
  })
})

describe('normalizeTeamNames', () => {
  it('returns empty array for non-arrays', () => {
    expect(normalizeTeamNames(null)).toEqual([])
    expect(normalizeTeamNames(undefined)).toEqual([])
    expect(normalizeTeamNames('nope')).toEqual([])
  })

  it('coerces array values to strings', () => {
    expect(normalizeTeamNames(['A', 2, null])).toEqual(['A', '2', ''])
  })
})

describe('DodgeballHub roster CSV', () => {
  it('exposes stable import headers as a constant', () => {
    expect([...DODGEBALLHUB_ROSTER_CSV_HEADERS]).toEqual([
      'team_name',
      'jersey_number',
      'last_name',
    ])
  })

  it('builds rows only for assigned players, sorted by team then last name', () => {
    const rows = buildDodgeballHubRosterRows({
      teamNames: ['Sharks', ''],
      registrations: [
        { draftGroup: 2, jerseyNumber: 7, lastName: 'Zebra' },
        { draftGroup: null, jerseyNumber: 1, lastName: 'Skip' },
        { draftGroup: 1, jerseyNumber: null, lastName: 'Baker' },
        { draftGroup: 1, jerseyNumber: 9, lastName: 'Adams' },
        { draftGroup: 2, jerseyNumber: 3, lastName: 'Young' },
      ],
    })

    expect(rows).toEqual([
      { teamName: 'Sharks', jerseyNumber: 9, lastName: 'Adams' },
      { teamName: 'Sharks', jerseyNumber: null, lastName: 'Baker' },
      { teamName: 'Team 2', jerseyNumber: 3, lastName: 'Young' },
      { teamName: 'Team 2', jerseyNumber: 7, lastName: 'Zebra' },
    ])
  })

  it('serializes CSV with constant headers and empty jersey cells', () => {
    const csv = buildDodgeballHubRosterCsv([
      { teamName: 'Sharks', jerseyNumber: 9, lastName: 'Adams' },
      { teamName: 'Team, "X"', jerseyNumber: null, lastName: 'O\'Neil' },
    ])

    expect(csv).toBe(
      [
        'team_name,jersey_number,last_name',
        'Sharks,9,Adams',
        '"Team, ""X""",,O\'Neil',
        '',
      ].join('\n')
    )
  })
})
