import type { ParsedLeagueGame, ParsedLeagueWorkbook } from '@/app/lib/league/parse-workbook'

export const SAMPLE_LEAGUE_WORKBOOK_FILENAME = 'Fall_2026_BYOT.xlsx'

export type TeamScheduleSlot = {
  weekNumber: number
  gameNumber: number
  description: string
}

export type TeamPrintSchedule = {
  teamName: string
  slots: TeamScheduleSlot[]
}

function namesInCsv(value: string | null): string[] {
  if (!value?.trim()) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

function teamListed(teamName: string, value: string | null): boolean {
  return namesInCsv(value).includes(teamName)
}

function opponentOnCourt(
  teamName: string,
  court: 1 | 2,
  teamA: string,
  teamB: string
): { court: 1 | 2; opponent: string } | null {
  if (teamName === teamA) return { court, opponent: teamB }
  if (teamName === teamB) return { court, opponent: teamA }
  return null
}

function roleForTeamInGame(teamName: string, game: ParsedLeagueGame): string {
  const court1 = opponentOnCourt(teamName, 1, game.court1TeamA, game.court1TeamB)
  if (court1) {
    return `Court ${court1.court} · vs ${court1.opponent}`
  }

  const court2 = opponentOnCourt(teamName, 2, game.court2TeamA, game.court2TeamB)
  if (court2) {
    return `Court ${court2.court} · vs ${court2.opponent}`
  }

  if (teamListed(teamName, game.court1Refs)) {
    return 'Ref Court 1'
  }
  if (teamListed(teamName, game.court2Refs)) {
    return 'Ref Court 2'
  }
  if (teamListed(teamName, game.teamsOff)) {
    return 'Off'
  }

  return '—'
}

function formatGameNumber(gameNumber: number): string {
  return String(gameNumber).padStart(2, '0')
}

/**
 * Build a full-season schedule per team from all weeks of league games.
 */
export function buildTeamPrintSchedulesFromWorkbook(parsed: ParsedLeagueWorkbook): TeamPrintSchedule[] {
  const sortedWeeks = [...parsed.weeks].sort((a, b) => a.weekNumber - b.weekNumber)

  return parsed.teams.map((teamName) => {
    const slots: TeamScheduleSlot[] = []

    for (const week of sortedWeeks) {
      const sortedGames = [...week.games].sort((a, b) => a.gameNumber - b.gameNumber)
      for (const game of sortedGames) {
        const role = roleForTeamInGame(teamName, game)
        slots.push({
          weekNumber: week.weekNumber,
          gameNumber: game.gameNumber,
          description: `Game ${formatGameNumber(game.gameNumber)} · ${role}`,
        })
      }
    }

    return { teamName, slots }
  })
}
