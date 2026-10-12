export type LeagueTemplate = {
  /** Google Spreadsheet id, or a stable in-app id when `builtIn` is true. */
  id: string
  name: string
  numTeams: number
  /** Use in-app schedule generation instead of exporting from Google Sheets. */
  builtIn?: boolean
}

/**
 * League templates for Create League (Step 1 picker).
 * Drive ids from the public folder: https://drive.google.com/drive/folders/1Xnd7hzIzs2QE2IOnPBfQPO8jTXwvsABj
 * (fetched via embeddedfolderview, 2026-10-12).
 */
export const LEAGUE_TEMPLATES: LeagueTemplate[] = [
  {
    id: 'generated-four-team',
    name: 'Four Team League (generated schedule)',
    numTeams: 4,
    builtIn: true,
  },
  {
    id: '1718n6pbYiz2WSluxdThdayBLggOvaXr-nrhDjpDzGFQ',
    name: 'Five Team Dedicated Ref League',
    numTeams: 5,
  },
  {
    id: '1IbxeJeNEVGQ-ScN2FmuPnsvn8zhL4yp4neZ5BKgoxNs',
    name: 'Six Team League',
    numTeams: 6,
  },
  {
    id: '18gbDQT9ap1y2Cv_2H7wAg5KQWFlDh24_b8Ns4qr4qbY',
    name: 'Seven Team League',
    numTeams: 7,
  },
  {
    id: '1wAPILR3XC1hZeLVxR3yMkG_RciJHRKAAu5cEHryXpBE',
    name: 'Eight Team Team-Ref League',
    numTeams: 8,
  },
]

const byId = new Map(LEAGUE_TEMPLATES.map((t) => [t.id, t]))

export function getLeagueTemplateById(id: string): LeagueTemplate | undefined {
  return byId.get(id.trim())
}

export function isKnownLeagueTemplateId(id: string): boolean {
  return byId.has(id.trim())
}
