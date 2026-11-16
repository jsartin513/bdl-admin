import type { PlayerListItem } from '@/app/lib/players/types'

export const PLAYER_EXPORT_CSV_HEADERS = [
  'id',
  'first_name',
  'last_name',
  'primary_email',
  'primary_phone',
  'gender',
  'skill_level',
  'home_leagues',
  'last_league_event_name',
  'last_league_event_date',
] as const

export type PlayerExportCsvHeader = (typeof PLAYER_EXPORT_CSV_HEADERS)[number]

export type LastLeagueEventSnapshot = {
  name: string
  eventDate: string
}

export type PlayerExportRowInput = {
  player: PlayerListItem
  lastLeagueEvent: LastLeagueEventSnapshot | null
}

function escapeCsvCell(raw: string): string {
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

/** Mitigate spreadsheet formula injection when CSV is opened in Excel/Sheets. */
export function guardSpreadsheetFormulaInjection(value: string): string {
  if (value.length === 0) return value
  const first = value.charAt(0)
  if (first === '=' || first === '+' || first === '-' || first === '@') {
    return `'${value}`
  }
  return value
}

function cellForExport(raw: string): string {
  return escapeCsvCell(guardSpreadsheetFormulaInjection(raw))
}

function formatSkillLevel(skillLevel: number | null): string {
  return skillLevel == null ? '' : String(skillLevel)
}

export function playerToExportRow(input: PlayerExportRowInput): Record<PlayerExportCsvHeader, string> {
  const { player, lastLeagueEvent } = input
  const homeLeagues = player.homeLeagues.map((h) => h.homeLeague).join(';')
  return {
    id: player.id,
    first_name: player.firstName,
    last_name: player.lastName,
    primary_email: player.primaryEmail ?? '',
    primary_phone: player.primaryPhone ?? '',
    gender: player.gender ?? '',
    skill_level: formatSkillLevel(player.skillLevel),
    home_leagues: homeLeagues,
    last_league_event_name: lastLeagueEvent?.name ?? '',
    last_league_event_date: lastLeagueEvent?.eventDate ?? '',
  }
}

export function buildPlayersExportCsv(rows: PlayerExportRowInput[]): string {
  const headerLine = PLAYER_EXPORT_CSV_HEADERS.join(',')
  const dataLines = rows.map((input) => {
    const cells = playerToExportRow(input)
    return PLAYER_EXPORT_CSV_HEADERS.map((h) => cellForExport(cells[h])).join(',')
  })
  return [headerLine, ...dataLines].join('\n') + (dataLines.length > 0 ? '\n' : '')
}

export function playersExportFilename(date: Date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `bdl-players-${y}-${m}-${d}.csv`
}
