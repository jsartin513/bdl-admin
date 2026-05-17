import * as XLSX from 'xlsx'

/** Week tabs like "Week 1 Schedule" */
const WEEK_SCHEDULE_NAME_RE = /^Week\s+\d+\s+Schedule\s*$/i

function sheetRows(sheet: XLSX.WorkSheet): string[][] {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][]
}

/** Teams listed under League Standings — rows after "Teams | Wins | … | Losses". */
export function extractTemplateTeamsFromStandings(wb: XLSX.WorkBook): string[] | null {
  const sh = wb.Sheets['League Standings']
  if (!sh) return null
  const rows = sheetRows(sh)
  let found = false
  const teams: string[] = []
  for (const row of rows) {
    const a = String(row[0] ?? '').trim()
    const b = String(row[1] ?? '').trim()
    if (!found) {
      if (a === 'Teams' && b === 'Wins') found = true
      continue
    }
    if (!a) break
    if (a.startsWith('=')) break
    teams.push(a)
  }
  return teams.length ? teams : null
}

export function extractTemplateTeamsFromTeamsSheet(wb: XLSX.WorkBook): string[] | null {
  const sh = wb.Sheets.Teams ?? wb.Sheets['Teams']
  if (!sh) return null
  const rows = sheetRows(sh)
  const header = rows[0]
  if (!header || String(header[0]).trim() !== 'Team Names') return null
  const names = header.slice(2).map((c) => String(c ?? '').trim()).filter(Boolean)
  return names.length ? names : null
}

export function extractTemplateTeamsFromScheduleGenerator(wb: XLSX.WorkBook): string[] | null {
  const sh = wb.Sheets['Schedule Generator']
  if (!sh) return null
  const rows = sheetRows(sh)
  const header = rows[0]
  if (!header) return null
  const names = header
    .slice(1)
    .map((c) => String(c ?? '').trim())
    .filter((c) => c && c !== '-')
  return names.length ? names : null
}

/** Ordered template team names (standings order preferred). */
export function extractTemplateTeams(wb: XLSX.WorkBook): string[] {
  const a = extractTemplateTeamsFromStandings(wb)
  if (a?.length) return a
  const b = extractTemplateTeamsFromTeamsSheet(wb)
  if (b?.length) return b
  const c = extractTemplateTeamsFromScheduleGenerator(wb)
  if (c?.length) return c
  throw new Error('Could not find team names in template (no standings / Teams / Schedule Generator).')
}

/** Teams that never appear on the first game row (two-court layout) in any week schedule tab. */
export function findTemplateTeamsNeverInGame01(
  wb: XLSX.WorkBook,
  templateTeams: string[],
): string[] {
  const teamSet = new Set(templateTeams)
  const weekNames = wb.SheetNames.filter((n) => WEEK_SCHEDULE_NAME_RE.test(n))
  if (weekNames.length === 0) return []

  let intersection: Set<string> | null = null

  for (const name of weekNames) {
    const sh = wb.Sheets[name]
    if (!sh) continue
    const rows = sheetRows(sh)
    const row0 = rows[0]
    if (!row0) continue
    const inGame = new Set<string>()
    for (let c = 1; c < row0.length; c++) {
      const v = String(row0[c] ?? '').trim()
      if (!v || v.startsWith('Game')) continue
      if (teamSet.has(v)) inGame.add(v)
    }
    const missing = new Set(templateTeams.filter((t) => !inGame.has(t)))
    if (intersection === null) {
      intersection = missing
    } else {
      const next = new Set<string>()
      for (const x of intersection) {
        if (missing.has(x)) next.add(x)
      }
      intersection = next
    }
  }

  return intersection ? [...intersection] : []
}

export function buildTeamRenamePairs(
  templateTeams: string[],
  userTeams: string[],
  avoidFirstRound: string | undefined,
  templateNeverGame01: string[],
): Array<{ from: string; to: string }> {
  if (userTeams.length !== templateTeams.length) {
    throw new Error(
      `Team count mismatch: template has ${templateTeams.length}, request has ${userTeams.length}`,
    )
  }

  const perm = [...userTeams]
  if (avoidFirstRound?.trim() && templateNeverGame01.length === 1) {
    const templateAvoid = templateNeverGame01[0]
    const tIdx = templateTeams.indexOf(templateAvoid)
    const uIdx = userTeams.indexOf(avoidFirstRound.trim())
    if (tIdx >= 0 && uIdx >= 0 && tIdx !== uIdx) {
      const tmp = perm[tIdx]!
      perm[tIdx] = perm[uIdx]!
      perm[uIdx] = tmp
    }
  }

  const pairs: Array<{ from: string; to: string }> = []
  for (let i = 0; i < templateTeams.length; i++) {
    pairs.push({ from: templateTeams[i]!, to: perm[i]! })
  }
  return pairs.sort((a, b) => b.from.length - a.from.length)
}

/** Apply replacements to literal values and formula strings. */
export function applyTeamRenamesToWorkbook(wb: XLSX.WorkBook, pairs: Array<{ from: string; to: string }>) {
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet || !sheet['!ref']) continue
    const range = XLSX.utils.decode_range(sheet['!ref'])
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = sheet[addr]
        if (!cell) continue

        if (cell.f) {
          let f = cell.f
          for (const { from, to } of pairs) {
            if (from && f.includes(from)) f = f.split(from).join(to)
          }
          if (f !== cell.f) cell.f = f
        }

        if (typeof cell.v === 'string') {
          let v = cell.v
          for (const { from, to } of pairs) {
            if (from && v.includes(from)) v = v.split(from).join(to)
          }
          if (v !== cell.v) cell.v = v
        }

        if (typeof cell.w === 'string') {
          let w = cell.w
          for (const { from, to } of pairs) {
            if (from && w.includes(from)) w = w.split(from).join(to)
          }
          if (w !== cell.w) cell.w = w
        }
      }
    }
  }
}
