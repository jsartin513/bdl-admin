import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  commitTeamlinktImport,
  previewTeamlinktImport,
  type ImportProfileFieldsMode,
} from '@/app/lib/players/teamlinkt-import'

export const maxDuration = 60

function parseProfileFieldsMode(value: unknown): ImportProfileFieldsMode {
  if (value === 'fill_blank' || value === 'overwrite' || value === 'skip') return value
  return 'skip'
}

async function readJsonBody(request: NextRequest): Promise<
  | {
      ok: true
      body: {
        csv?: string
        filename?: string
        dryRun?: boolean
        profileFields?: ImportProfileFieldsMode
      }
    }
  | { ok: false; error: string }
> {
  try {
    const body = (await request.json()) as {
      csv?: string
      filename?: string
      dryRun?: boolean
      profileFields?: ImportProfileFieldsMode
    }
    return { ok: true, body }
  } catch {
    return { ok: false, error: 'Request body must be valid JSON' }
  }
}

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const parsedBody = await readJsonBody(request)
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 })
    }
    const body = parsedBody.body
    const options = { profileFields: parseProfileFieldsMode(body.profileFields) }

    if (!body.csv?.trim()) {
      return NextResponse.json({ error: 'csv is required' }, { status: 400 })
    }

    if (body.dryRun !== false) {
      const preview = await previewTeamlinktImport(body.csv, options)
      if (preview.error) {
        return NextResponse.json({ error: preview.error }, { status: 400 })
      }
      return NextResponse.json({
        dryRun: true,
        headers: preview.headers,
        actions: preview.actions,
        options,
        summary: {
          create: preview.actions.filter((a) => a.action === 'create').length,
          update: preview.actions.filter((a) => a.action === 'update').length,
          skip: preview.actions.filter((a) => a.action === 'skip').length,
          ambiguous: preview.actions.filter((a) => a.action === 'ambiguous').length,
        },
      })
    }

    const result = await commitTeamlinktImport({
      csvText: body.csv,
      filename: body.filename?.trim() || 'teamlinkt.csv',
      actor: session.email,
      options,
    })

    return NextResponse.json({ dryRun: false, ...result })
  } catch (err) {
    console.error('players import failed', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
