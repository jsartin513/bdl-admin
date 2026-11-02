import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseLeagueWorkbook } from '@/app/lib/league/parse-workbook'
import { buildTeamPrintSchedulesFromWorkbook } from '@/app/lib/league/team-schedule'

const SAMPLE = join(process.cwd(), 'public', 'league_schedules', 'Fall_2026_BYOT.xlsx')

describe('buildTeamPrintSchedulesFromWorkbook', () => {
  it('labels play, ref, and off for each team across the season', () => {
    const buffer = readFileSync(SAMPLE)
    const parsed = parseLeagueWorkbook(buffer)
    const schedules = buildTeamPrintSchedulesFromWorkbook(parsed)

    expect(parsed.weeks).toHaveLength(6)
    expect(schedules).toHaveLength(8)

    const bikerGang = schedules.find((s) => s.teamName === 'Biker Gang')
    expect(bikerGang).toBeDefined()

    const week1 = bikerGang!.slots.filter((s) => s.weekNumber === 1)
    expect(week1[0].description).toBe('Game 01 · Court 1 · vs Boop Boop')

    const leftCorners = schedules.find((s) => s.teamName === 'Left Corners')
    expect(leftCorners!.slots.find((s) => s.weekNumber === 1 && s.gameNumber === 1)?.description).toBe(
      'Game 01 · Ref Court 1'
    )

    const bigBugs = schedules.find((s) => s.teamName === 'Big Bugs')
    expect(bigBugs!.slots.find((s) => s.weekNumber === 1 && s.gameNumber === 1)?.description).toBe(
      'Game 01 · Ref Court 2'
    )

    const freeAgents = schedules.find((s) => s.teamName === 'Free Agents of Chaos')
    expect(freeAgents!.slots.find((s) => s.weekNumber === 1 && s.gameNumber === 1)?.description).toBe(
      'Game 01 · Off'
    )

    expect(bikerGang!.slots.length).toBe(parsed.weeks.length * parsed.weeks[0].games.length)
  })
})
