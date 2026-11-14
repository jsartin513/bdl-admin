import { describe, expect, it } from 'vitest'
import {
  buildPlayersExportCsv,
  guardSpreadsheetFormulaInjection,
  PLAYER_EXPORT_CSV_HEADERS,
  playerToExportRow,
  playersExportFilename,
} from '@/app/lib/players/export-csv'
import type { PlayerListItem } from '@/app/lib/players/types'

function samplePlayer(overrides: Partial<PlayerListItem> = {}): PlayerListItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    firstName: 'Alex',
    lastName: 'Rivera',
    rosterName: 'Alex Rivera',
    nickname: 'Alex R',
    jerseyNumber: 7,
    jerseyName: 'Rivera',
    skillLevel: 40,
    skillLevelFib: null,
    skillAreas: null,
    skillLabel: 'Intermediate',
    gender: 'male',
    genderLabel: 'Male',
    genderGroupLabel: 'Male',
    photoUrl: null,
    primaryEmail: 'alex@example.com',
    primaryPhone: '+16175551212',
    isMerged: false,
    hasStrongPersonality: false,
    strongPersonalityNotes: null,
    homeLeagues: [
      {
        homeLeague: 'boston_dodgeball_league',
        label: 'Boston Dodgeball League',
        logoUrl: null,
      },
      { homeLeague: 'nutmeg_dodgeball', label: 'Nutmeg Dodgeball', logoUrl: null },
    ],
    ...overrides,
  }
}

describe('export-csv', () => {
  it('uses the expected column headers', () => {
    const csv = buildPlayersExportCsv([])
    expect(csv.trim()).toBe(PLAYER_EXPORT_CSV_HEADERS.join(','))
  })

  it('maps player fields and last league event', () => {
    const row = playerToExportRow({
      player: samplePlayer(),
      lastLeagueEvent: { name: 'Fall 2025 BYOT', eventDate: '2025-09-02' },
    })
    expect(row).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      first_name: 'Alex',
      last_name: 'Rivera',
      primary_email: 'alex@example.com',
      primary_phone: '+16175551212',
      gender: 'male',
      skill_level: '40',
      home_leagues: 'boston_dodgeball_league;nutmeg_dodgeball',
      last_league_event_name: 'Fall 2025 BYOT',
      last_league_event_date: '2025-09-02',
    })
  })

  it('escapes commas and quotes in CSV cells', () => {
    const csv = buildPlayersExportCsv([
      {
        player: samplePlayer({ lastName: 'O"Brien, Jr' }),
        lastLeagueEvent: null,
      },
    ])
    expect(csv).toContain('"O""Brien, Jr"')
  })

  it('guards spreadsheet formula injection', () => {
    expect(guardSpreadsheetFormulaInjection('=1+1')).toBe("'=1+1")
    expect(guardSpreadsheetFormulaInjection('+SUM(A1)')).toBe("'+SUM(A1)")
    expect(guardSpreadsheetFormulaInjection('-cmd')).toBe("'-cmd")
    expect(guardSpreadsheetFormulaInjection('@evil')).toBe("'@evil")
    expect(guardSpreadsheetFormulaInjection('safe@email.com')).toBe('safe@email.com')

    const csv = buildPlayersExportCsv([
      {
        player: samplePlayer({ primaryEmail: '=HYPERLINK("http://evil")' }),
        lastLeagueEvent: null,
      },
    ])
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
  })

  it('formats export filename with UTC date', () => {
    expect(playersExportFilename(new Date('2026-03-15T12:00:00.000Z'))).toBe(
      'bdl-players-2026-03-15.csv'
    )
  })
})
