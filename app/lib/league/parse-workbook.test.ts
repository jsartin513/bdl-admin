import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseLeagueWorkbook } from '@/app/lib/league/parse-workbook'

const SAMPLE = join(process.cwd(), 'public', 'league_schedules', 'Fall_2026_BYOT.xlsx')

describe('parseLeagueWorkbook', () => {
  it('parses teams and week schedules from Fall 2026 sample', () => {
    const buffer = readFileSync(SAMPLE)
    const parsed = parseLeagueWorkbook(buffer)

    expect(parsed.name).toBe('Eight Team Team-Ref League')
    expect(parsed.scheduleFormat).toBe('team-ref')
    expect(parsed.teams).toHaveLength(8)
    expect(parsed.teams[0]).toBe('Biker Gang')
    expect(parsed.weeks).toHaveLength(6)
    expect(parsed.weeks[0].weekNumber).toBe(1)
    expect(parsed.weeks[0].games[0]).toMatchObject({
      gameNumber: 1,
      court1TeamA: 'Biker Gang',
      court1TeamB: 'Boop Boop',
      court2TeamA: 'Most Improved',
      court2TeamB: 'Boston T Party',
      court1Refs: 'Left Corners',
      court2Refs: 'Big Bugs',
      teamsOff: 'Free Agents of Chaos, Cash Only',
    })
  })
})
