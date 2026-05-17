/**
 * Export a native Google Spreadsheet (Drive file) to .xlsx bytes using the Drive API.
 * Requires GOOGLE_DRIVE_API_KEY and a file that is readable with that key (e.g. link-shared).
 */
export async function exportGoogleSpreadsheetAsXlsx(fileId: string): Promise<ArrayBuffer> {
  const key = process.env.GOOGLE_DRIVE_API_KEY
  if (!key) {
    throw new Error('GOOGLE_DRIVE_API_KEY is not configured')
  }
  const id = fileId.trim()
  if (!id) {
    throw new Error('Missing file id')
  }

  const mime = encodeURIComponent(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    id,
  )}/export?mimeType=${mime}&key=${encodeURIComponent(key)}`

  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Drive export failed (${res.status}): ${text.slice(0, 200)}`)
  }
  return res.arrayBuffer()
}
