import * as XLSX from 'xlsx'

export type ParsedLeagueGame = {
  gameNumber: number
  court1TeamA: string
  court1TeamB: string
  court2TeamA: string
  court2TeamB: string
  court1Refs: string | null
  court2Refs: string | null
  teamsOff: string | null
}

export type ParsedLeagueWeek = {
  weekNumber: number
  games: ParsedLeagueGame[]
}

export type ParsedLeagueWorkbook = {
  name: string
  scheduleFormat: string | null
  teams: string[]
  weeks: ParsedLeagueWeek[]
}

const WEEK_SHEET_RE = /^Week\s+(\d+)\s+Schedule$/i

function cellText(ws: XLSX.WorkSheet, row1: number, col1: number): string {
  const addr = XLSX.utils.encode_cell({ r: row1 - 1, c: col1 - 1 })
  const cell = ws[addr]
  if (!cell || cell.v == null) return ''
  return String(cell.v).trim()
}

function parseRefsLine(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed.toLowerCase().startsWith('refs:')) return null
  return trimmed.replace(/^refs:\s*/i, '').trim() || null
}

function parseOffLine(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed.toLowerCase().startsWith('off:')) return null
  return trimmed.replace(/^off:\s*/i, '').trim() || null
}

function parseTeamsSheet(ws: XLSX.WorkSheet): { teams: string[]; name: string; scheduleFormat: string | null } {
  const teams: string[] = []
  let startCol = 2
  for (let col = 2; col <= 30; col++) {
    const name = cellText(ws, 1, col)
    if (name) {
      startCol = col
      break
    }
  }
  for (let col = startCol; col <= 30; col++) {
    const name = cellText(ws, 1, col)
    if (!name) break
    teams.push(name)
  }

  let leagueName = cellText(ws, 3, 2)
  if (!leagueName) leagueName = 'League'

  const scheduleFormat = cellText(ws, 2, 2) || null

  return { teams, name: leagueName, scheduleFormat }
}

/**
 * Dual-court team-ref week sheet:
 * Game row — C1 A/B in cols 2/4, C2 A/B in cols 7/9.
 * Next row — "Refs: …" in cols 2 and 7, "Off: …" in col 12.
 */
function parseWeekSheet(ws: XLSX.WorkSheet): ParsedLeagueGame[] {
  const ref = ws['!ref']
  if (!ref) return []

  const range = XLSX.utils.decode_range(ref)
  const games: ParsedLeagueGame[] = []

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowNum = r + 1
    const label = cellText(ws, rowNum, 1)
    const gameMatch = label.match(/^Game\s*(\d+)/i)
    if (!gameMatch) continue

    const gameNumber = Number(gameMatch[1])
    const court1TeamA = cellText(ws, rowNum, 2)
    const court1TeamB = cellText(ws, rowNum, 4)
    const court2TeamA = cellText(ws, rowNum, 7)
    const court2TeamB = cellText(ws, rowNum, 9)

    if (!court1TeamA && !court1TeamB && !court2TeamA && !court2TeamB) continue

    const refsRow = rowNum + 1
    const court1Refs = parseRefsLine(cellText(ws, refsRow, 2))
    const court2Refs = parseRefsLine(cellText(ws, refsRow, 7))
    const teamsOff = parseOffLine(cellText(ws, refsRow, 12))

    games.push({
      gameNumber,
      court1TeamA,
      court1TeamB,
      court2TeamA,
      court2TeamB,
      court1Refs,
      court2Refs,
      teamsOff,
    })
  }

  games.sort((a, b) => a.gameNumber - b.gameNumber)
  return games
}

export function parseLeagueWorkbook(buffer: ArrayBuffer | Buffer): ParsedLeagueWorkbook {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  const teamsSheet = wb.Sheets['Teams']
  if (!teamsSheet) {
    throw new Error('Workbook must include a "Teams" sheet.')
  }

  const { teams, name, scheduleFormat } = parseTeamsSheet(teamsSheet)
  if (teams.length === 0) {
    throw new Error('No team names found on the Teams sheet (row 1, starting column B).')
  }

  const weeks: ParsedLeagueWeek[] = []
  for (const sheetName of wb.SheetNames) {
    const match = sheetName.match(WEEK_SHEET_RE)
    if (!match) continue
    const weekNumber = Number(match[1])
    const games = parseWeekSheet(wb.Sheets[sheetName])
    if (games.length > 0) {
      weeks.push({ weekNumber, games })
    }
  }

  weeks.sort((a, b) => a.weekNumber - b.weekNumber)

  if (weeks.length === 0) {
    throw new Error('No "Week N Schedule" sheets with games were found.')
  }

  return {
    name,
    scheduleFormat,
    teams,
    weeks,
  }
}
