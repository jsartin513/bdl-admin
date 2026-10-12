import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportGoogleSpreadsheetAsXlsx } from '@/app/lib/driveExportSpreadsheet'
import { LEAGUE_TEMPLATES } from '@/app/lib/leagueTemplates'

const fiveTeamId =
  LEAGUE_TEMPLATES.find((t) => t.numTeams === 5 && !t.builtIn)?.id ?? ''

describe('exportGoogleSpreadsheetAsXlsx', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects unknown spreadsheet ids', async () => {
    await expect(exportGoogleSpreadsheetAsXlsx('not-in-config')).rejects.toThrow(
      'Unknown league template id',
    )
  })

  it('rejects built-in template ids', async () => {
    await expect(exportGoogleSpreadsheetAsXlsx('generated-four-team')).rejects.toThrow(
      'generated in-app',
    )
  })

  it('throws a clear error when Google returns HTML', async () => {
    const html = '<!DOCTYPE html><html><body>Sign in</body></html>'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    )

    await expect(exportGoogleSpreadsheetAsXlsx(fiveTeamId)).rejects.toThrow(/sign-in or confirmation/)
  })

  it('returns xlsx bytes when export succeeds', async () => {
    const xlsxHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(xlsxHeader, {
          status: 200,
          headers: {
            'content-type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        }),
      ),
    )

    const buf = await exportGoogleSpreadsheetAsXlsx(fiveTeamId)
    expect(new Uint8Array(buf).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]))
  })
})
