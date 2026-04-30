import { NextResponse } from 'next/server'

export interface DriveFile {
  id: string
  name: string
}

// Patterns that identify non-schedule files that should not appear in UI dropdowns.
// Template sheets are intentionally kept so the create-league picker can use them.
const EXCLUDE_PATTERNS = [
  /standings/i,
  /backup/i,
  /import/i,
]

function isScheduleSheet(name: string): boolean {
  return !EXCLUDE_PATTERNS.some((re) => re.test(name))
}

export async function GET() {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

  if (!apiKey || !folderId) {
    return NextResponse.json(
      { error: 'Google Drive API key or folder ID not configured' },
      { status: 500 }
    )
  }

  const query = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  )

  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&key=${apiKey}&fields=files(id,name)&orderBy=name`

  const res = await fetch(url, { next: { revalidate: 60 } })

  if (!res.ok) {
    const body = await res.text()
    console.error('Drive API error:', res.status, body)
    return NextResponse.json(
      { error: `Drive API returned ${res.status}` },
      { status: res.status }
    )
  }

  const data = await res.json()
  const files: DriveFile[] = (data.files ?? [])
    .map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))
    .filter((f: DriveFile) => isScheduleSheet(f.name))

  return NextResponse.json(files)
}
