import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  commitTeamlinktImport,
  previewTeamlinktImport,
} from '@/app/lib/players/teamlinkt-import'

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = (await request.json()) as {
      csv?: string
      filename?: string
      dryRun?: boolean
    }

    if (!body.csv?.trim()) {
      return NextResponse.json({ error: 'csv is required' }, { status: 400 })
    }

    if (body.dryRun !== false) {
      const preview = await previewTeamlinktImport(body.csv)
      if (preview.error) {
        return NextResponse.json({ error: preview.error }, { status: 400 })
      }
      return NextResponse.json({
        dryRun: true,
        headers: preview.headers,
        actions: preview.actions,
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
    })

    return NextResponse.json({ dryRun: false, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
