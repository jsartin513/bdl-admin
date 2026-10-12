import { getLeagueTemplateById, isKnownLeagueTemplateId } from '@/app/lib/leagueTemplates'

/**
 * Export a link-shared Google Spreadsheet to .xlsx bytes (no API key).
 * Only spreadsheet ids listed in {@link LEAGUE_TEMPLATES} are allowed.
 */
export async function exportGoogleSpreadsheetAsXlsx(fileId: string): Promise<ArrayBuffer> {
  const id = fileId.trim()
  if (!id) {
    throw new Error('Missing file id')
  }
  if (!isKnownLeagueTemplateId(id)) {
    throw new Error('Unknown league template id')
  }
  const template = getLeagueTemplateById(id)
  if (template?.builtIn) {
    throw new Error('This template is generated in-app and is not exported from Google Sheets')
  }

  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=xlsx`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Drive export failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const contentType = res.headers.get('content-type')

  if (responseLooksLikeHtml(bytes, contentType)) {
    throw new Error(
      'Google Sheets returned a sign-in or confirmation page instead of a spreadsheet. ' +
        'Share the template as “Anyone with the link” viewer.',
    )
  }
  if (!isXlsxZip(bytes)) {
    throw new Error(
      'Expected an Excel (.xlsx) file from Google Sheets export. ' +
        `Got content-type ${contentType ?? 'unknown'}.`,
    )
  }

  return buf
}

function isXlsxZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

function responseLooksLikeHtml(bytes: Uint8Array, contentType: string | null): boolean {
  if (contentType?.toLowerCase().includes('text/html')) return true
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 256)).trimStart()
  return head.startsWith('<!DOCTYPE') || head.startsWith('<html') || head.startsWith('<HTML')
}
