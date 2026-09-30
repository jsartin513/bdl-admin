import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseLeagueWorkbook, type ParsedLeagueWorkbook } from '@/app/lib/league/parse-workbook'

const SCHEDULES_DIR = path.join(process.cwd(), 'public', 'league_schedules')

export function resolveLocalLeaguePath(league: string): string | null {
  const base = path.basename(league)
  if (!base.toLowerCase().endsWith('.xlsx')) return null
  const candidate = path.resolve(SCHEDULES_DIR, base)
  const root = path.resolve(SCHEDULES_DIR)
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null
  if (!existsSync(candidate)) return null
  return candidate
}

export function loadLocalLeagueWorkbook(league: string): ParsedLeagueWorkbook {
  const filePath = resolveLocalLeaguePath(league)
  if (!filePath) {
    throw new Error(`Local league not found: ${path.basename(league)}`)
  }
  return parseLeagueWorkbook(readFileSync(filePath))
}
