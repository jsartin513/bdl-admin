/**
 * CSV column headers for DodgeballHub roster import.
 * Keep this list in sync with what DodgeballHub expects.
 */
export const DODGEBALLHUB_ROSTER_CSV_HEADERS = [
  'team_name',
  'jersey_number',
  'last_name',
] as const

export type DodgeballHubRosterCsvHeader =
  (typeof DODGEBALLHUB_ROSTER_CSV_HEADERS)[number]

export type DodgeballHubRosterRow = {
  teamName: string
  jerseyNumber: number | null
  lastName: string
}

/**
 * Resolve a display/export team name from the ordered event teamNames list.
 * Index i maps to draft group i + 1. Empty/missing names fall back to "Team N".
 */
export function resolveTeamName(
  draftGroup: number,
  teamNames: string[] | null | undefined
): string {
  const names = Array.isArray(teamNames) ? teamNames : []
  const raw = names[draftGroup - 1]
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed || `Team ${draftGroup}`
}

export function normalizeTeamNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => (typeof v === 'string' ? v : String(v ?? '')))
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildDodgeballHubRosterCsv(rows: DodgeballHubRosterRow[]): string {
  const headerLine = DODGEBALLHUB_ROSTER_CSV_HEADERS.join(',')
  const dataLines = rows.map((row) => {
    const cells: Record<DodgeballHubRosterCsvHeader, string> = {
      team_name: row.teamName,
      jersey_number: row.jerseyNumber == null ? '' : String(row.jerseyNumber),
      last_name: row.lastName,
    }
    return DODGEBALLHUB_ROSTER_CSV_HEADERS.map((h) =>
      escapeCsvCell(cells[h])
    ).join(',')
  })
  return [headerLine, ...dataLines].join('\n') + (dataLines.length > 0 ? '\n' : '')
}

export function buildDodgeballHubRosterRows(input: {
  teamNames: string[]
  registrations: Array<{
    draftGroup: number | null
    jerseyNumber: number | null
    lastName: string
  }>
}): DodgeballHubRosterRow[] {
  const assigned = input.registrations.filter(
    (r): r is typeof r & { draftGroup: number } => r.draftGroup != null
  )

  assigned.sort((a, b) => {
    if (a.draftGroup !== b.draftGroup) return a.draftGroup - b.draftGroup
    return a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' })
  })

  return assigned.map((r) => ({
    teamName: resolveTeamName(r.draftGroup, input.teamNames),
    jerseyNumber: r.jerseyNumber,
    lastName: r.lastName,
  }))
}
