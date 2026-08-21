import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

const SCHEDULES_DIR = path.join(process.cwd(), 'public', 'league_schedules')

export async function GET() {
  if (!fs.existsSync(SCHEDULES_DIR)) {
    return NextResponse.json([])
  }

  const files = fs
    .readdirSync(SCHEDULES_DIR)
    .filter((name) => name.toLowerCase().endsWith('.xlsx') && !name.startsWith('~'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      id: `local:${name}`,
      name: `${name} (local)`,
    }))

  return NextResponse.json(files)
}
