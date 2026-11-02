import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

const SCHEDULES_DIR = path.join(process.cwd(), 'public', 'league_schedules')

function isWeekTab(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('week') || /w\s*[1-9]/.test(lower)
}

function resolveLeaguePath(league: string): string | null {
  const base = path.basename(league)
  if (!base.toLowerCase().endsWith('.xlsx')) return null
  const candidate = path.join(SCHEDULES_DIR, base)
  if (!candidate.startsWith(SCHEDULES_DIR)) return null
  if (!fs.existsSync(candidate)) return null
  return candidate
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function rowToCsv(cells: string[]): string {
  return cells.map(csvEscape).join(',')
}

/**
 * Convert our dual-court week sheet rows into the CSV shape scheduleParser expects:
 *   Game NN, home1, , away1, , , home2, , away2
 *   , Refs: ref1, , , , , Refs: ref2
 */
function weekSheetToCsv(sheet: XLSX.WorkSheet, weekNum: string): string {
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as string[][]

  const out: string[] = []
  let gameOrdinal = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? '').trim())
    const label = row[0] || ''
    if (!/^Round\s+\d+/i.test(label) && !/^Game\s+\d+/i.test(label)) {
      continue
    }

    gameOrdinal += 1
    const home1 = row[1] || ''
    const away1 = row[3] || ''
    const home2 = row[6] || ''
    const away2 = row[8] || ''

    const refRow = (rows[i + 1] || []).map((c) => String(c ?? '').trim())
    // Generator layout: Ref label in B/G, names in F/K (indices 5 / 10)
    // Legacy paired layout: "Refs: Name" already in B/G (indices 1 / 6)
    let ref1 = ''
    let ref2 = ''
    if (refRow[1]?.toLowerCase() === 'ref' || refRow[1]?.toLowerCase().startsWith('refs:')) {
      ref1 = (refRow[5] || refRow[1] || '').replace(/^Refs:\s*/i, '')
    }
    if (refRow[6]?.toLowerCase() === 'ref' || refRow[6]?.toLowerCase().startsWith('refs:')) {
      ref2 = (refRow[10] || refRow[6] || '').replace(/^Refs:\s*/i, '')
    }
    // Also accept "Refs: Name" parked in later columns (She/They style)
    for (const cell of refRow) {
      if (/^Refs:\s*/i.test(cell)) {
        const name = cell.replace(/^Refs:\s*/i, '').trim()
        if (!ref1) ref1 = name
        else if (!ref2 && name !== ref1) ref2 = name
      }
    }

    out.push(
      rowToCsv([
        `Week ${weekNum} Game ${String(gameOrdinal).padStart(2, '0')}`,
        home1,
        '',
        away1,
        '',
        '',
        home2,
        '',
        away2,
      ])
    )
    out.push(
      rowToCsv([
        '',
        ref1 ? `Refs: ${ref1}` : '',
        '',
        '',
        '',
        '',
        ref2 ? `Refs: ${ref2}` : '',
      ])
    )
    i += 1 // skip ref row
  }

  return out.join('\n')
}

function combineCsvWeeks(weekCsvs: string[]): string {
  return weekCsvs.filter(Boolean).join('\n')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const league = searchParams.get('league')
  const week = searchParams.get('week') || 'all'

  if (!league) {
    return NextResponse.json({ error: 'league query parameter is required' }, { status: 400 })
  }

  const filePath = resolveLeaguePath(league)
  if (!filePath) {
    return NextResponse.json({ error: `Local league not found: ${league}` }, { status: 404 })
  }

  try {
    const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' })
    const weekTabs = workbook.SheetNames.filter(isWeekTab).sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)?.[1] || '0', 10)
      const nb = parseInt(b.match(/(\d+)/)?.[1] || '0', 10)
      return na - nb
    })

    if (weekTabs.length === 0) {
      return NextResponse.json(
        { error: 'No week tabs found in this workbook', sheets: workbook.SheetNames },
        { status: 404 }
      )
    }

    const availableWeeks = weekTabs.map((name) => name.match(/(\d+)/)?.[1] || name)

    if (week === 'all' || week === 'weeks5-6') {
      const tabs =
        week === 'weeks5-6'
          ? weekTabs.filter((_, idx) => {
              const n = parseInt(availableWeeks[idx] || '0', 10)
              return n >= 5 && n <= 6
            })
          : weekTabs

      const weekCsvs = tabs.map((tabName) => {
        const weekNum = tabName.match(/(\d+)/)?.[1] || '0'
        return weekSheetToCsv(workbook.Sheets[tabName], weekNum)
      })

      return NextResponse.json({
        success: true,
        week,
        sheetName: week === 'all' ? 'All Weeks Combined' : 'Weeks 5-6 Combined',
        availableWeeks,
        csvData: combineCsvWeeks(weekCsvs),
      })
    }

    const tabName = weekTabs.find((name) => name.match(/(\d+)/)?.[1] === week)
    if (!tabName) {
      return NextResponse.json(
        { error: `Week ${week} not found. Available: ${availableWeeks.join(', ')}` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      week,
      sheetName: tabName,
      availableWeeks,
      csvData: weekSheetToCsv(workbook.Sheets[tabName], week),
    })
  } catch (err) {
    console.error('schedules-local error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read local schedule' },
      { status: 500 }
    )
  }
}
