import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.GOOGLE_DRIVE_API_KEY

function isWeekTab(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.includes('week') ||
    /w\s*[1-9]/.test(lower) ||
    /[1-9]\s*week/.test(lower)
  )
}

async function getSheetTabs(sheetId: string): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${API_KEY}&fields=sheets.properties.title`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) {
    throw new Error(`Sheets metadata API returned ${res.status}`)
  }
  const data = await res.json()
  return (data.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title)
}

async function fetchTabCsv(sheetId: string, tabName: string): Promise<string> {
  const encodedTab = encodeURIComponent(tabName)
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedTab}`
  const res = await fetch(url, { next: { revalidate: 120 } })
  if (!res.ok) {
    throw new Error(`gviz CSV fetch returned ${res.status} for tab "${tabName}"`)
  }
  return res.text()
}

function processWeekCsv(csv: string, weekNum: number | string): string {
  return csv
    .split('\n')
    .map((line) => {
      if (line.includes('Game ') && !line.includes('Game Number')) {
        return line.replace(/Game\s+(\d+)/i, `Week ${weekNum} Game $1`)
      }
      return line
    })
    .join('\n')
}

function combineCsvWeeks(weekCsvs: string[]): string {
  const allLines: string[] = []
  let headerAdded = false

  for (const csv of weekCsvs) {
    for (const line of csv.split('\n')) {
      if (line.includes('Game Number') || line.includes('Court 1 Team 1')) {
        if (!headerAdded) {
          allLines.push(line)
          headerAdded = true
        }
      } else if (line.trim()) {
        allLines.push(line)
      }
    }
  }

  return allLines.join('\n')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sheetId = searchParams.get('sheetId')
  const week = searchParams.get('week') || 'all'

  if (!sheetId) {
    return NextResponse.json({ error: 'sheetId query parameter is required' }, { status: 400 })
  }

  if (!API_KEY) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 })
  }

  try {
    const allTabs = await getSheetTabs(sheetId)
    const weekTabs = allTabs.filter(isWeekTab).sort()

    if (weekTabs.length === 0) {
      return NextResponse.json(
        { error: 'No week tabs found in this spreadsheet', allTabs },
        { status: 404 }
      )
    }

    // Numeric week labels extracted from tab names (e.g. "Week 3" → 3)
    const availableWeeks = weekTabs.map((name) => {
      const m = name.match(/(\d+)/)
      return m ? m[1] : name
    })

    if (week === 'all') {
      const weekCsvs: string[] = []
      for (let i = 0; i < weekTabs.length; i++) {
        const raw = await fetchTabCsv(sheetId, weekTabs[i])
        const weekNum = availableWeeks[i]
        weekCsvs.push(processWeekCsv(raw, weekNum))
      }

      return NextResponse.json({
        success: true,
        week,
        sheetName: 'All Weeks Combined',
        availableWeeks,
        csvData: combineCsvWeeks(weekCsvs),
      })
    }

    // Single week — find matching tab
    const tabName = weekTabs.find((name) => {
      const m = name.match(/(\d+)/)
      return m && m[1] === week
    })

    if (!tabName) {
      return NextResponse.json(
        { error: `Week ${week} not found. Available weeks: ${availableWeeks.join(', ')}` },
        { status: 404 }
      )
    }

    const csvData = await fetchTabCsv(sheetId, tabName)

    return NextResponse.json({
      success: true,
      week,
      sheetName: tabName,
      availableWeeks,
      csvData,
    })
  } catch (err) {
    console.error('schedules-live error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch schedule' },
      { status: 500 }
    )
  }
}
