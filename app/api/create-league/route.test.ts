import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { LEAGUE_TEMPLATES } from '@/app/lib/leagueTemplates'

const exportMock = vi.fn()

vi.mock('@/app/lib/driveExportSpreadsheet', () => ({
  exportGoogleSpreadsheetAsXlsx: (...args: unknown[]) => exportMock(...args),
}))

const fiveTeamTemplate = LEAGUE_TEMPLATES.find((t) => t.numTeams === 5 && !t.builtIn)!

function postCreateLeague(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost/api/create-league', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function teamNames(n: number, prefix = 'Team') {
  return Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`)
}

function readWorkbookFromResponse(res: Response) {
  return res.arrayBuffer().then((buf) => XLSX.read(buf, { type: 'array' }))
}

function buildMinimalFiveTeamTemplateXlsx(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const standings: (string | number)[][] = [
    ['Teams', 'Wins', '', '', 'Losses'],
    ['Alpha', '', '', '', ''],
    ['Beta', '', '', '', ''],
    ['Gamma', '', '', '', ''],
    ['Delta', '', '', '', ''],
    ['Epsilon', '', '', '', ''],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(standings), 'League Standings')
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['', 'Game 01', '', 'Game 02'],
      ['Court 1', 'Alpha', 'Beta', 'Gamma', 'Delta'],
    ]),
    'Week 1 Schedule',
  )
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

describe('POST /api/create-league', () => {
  afterEach(() => {
    exportMock.mockReset()
  })

  it.each([
    [4, teamNames(4)],
    [6, teamNames(6)],
    [7, teamNames(7)],
  ] as const)('generates built-in workbook for %i teams', async (numTeams, teams) => {
    const res = await postCreateLeague({
      leagueName: 'Test League',
      numTeams,
      teams,
      numWeeks: 6,
    })
    expect(res.status).toBe(200)
    const wb = await readWorkbookFromResponse(res)
    expect(wb.SheetNames).toContain('Teams')
    expect(wb.SheetNames).toContain('Schedule Generator')
    expect(wb.SheetNames).toContain('League Standings')
    const weekSheets = wb.SheetNames.filter((n) => n.startsWith('Week '))
    expect(weekSheets.length).toBe(6)
  })

  it('uses mocked Drive export for 5-team template', async () => {
    exportMock.mockResolvedValue(buildMinimalFiveTeamTemplateXlsx())
    const teams = teamNames(5, 'T')
    const res = await postCreateLeague({
      leagueName: 'Five Team Test',
      templateId: fiveTeamTemplate.id,
      templateName: fiveTeamTemplate.name,
      teams,
      numWeeks: 6,
    })
    expect(exportMock).toHaveBeenCalledWith(fiveTeamTemplate.id)
    expect(res.status).toBe(200)
    const wb = await readWorkbookFromResponse(res)
    expect(wb.SheetNames).toContain('League Standings')
  })

  it('rejects unknown template ids', async () => {
    const res = await postCreateLeague({
      leagueName: 'Bad',
      templateId: 'unknown-sheet-id',
      templateName: 'Five Team League',
      teams: teamNames(5),
      numWeeks: 6,
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Unknown league template/)
    expect(exportMock).not.toHaveBeenCalled()
  })
})
