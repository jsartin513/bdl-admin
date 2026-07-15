import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  commitTeamlinktImport,
  getSavedImportBatch,
  listSavedImportBatches,
  previewTeamlinktImport,
  saveTeamlinktImportCsv,
} from '@/app/lib/players/teamlinkt-import'

export const maxDuration = 60

async function readJsonBody(request: NextRequest): Promise<
  | {
      ok: true
      body: {
        csv?: string
        filename?: string
        dryRun?: boolean
        saveOnly?: boolean
        batchId?: string
      }
    }
  | { ok: false; error: string }
> {
  try {
    const body = (await request.json()) as {
      csv?: string
      filename?: string
      dryRun?: boolean
      saveOnly?: boolean
      batchId?: string
    }
    return { ok: true, body }
  } catch {
    return { ok: false, error: 'Request body must be valid JSON' }
  }
}

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (id) {
      const batch = await getSavedImportBatch(id)
      if (!batch) {
        return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
      }
      return NextResponse.json({ batch })
    }

    const batches = await listSavedImportBatches()
    return NextResponse.json({ batches })
  } catch (err) {
    console.error('players import list failed', err)
    const message = err instanceof Error ? err.message : 'Failed to list imports'
    return NextResponse.json({ error: message }, { status: 500 })
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

    let csvText = body.csv?.trim() ? body.csv : ''
    let filename = body.filename?.trim() || 'teamlinkt.csv'

    if (body.batchId) {
      const batch = await getSavedImportBatch(body.batchId)
      if (!batch) {
        return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
      }
      if (!batch.csvText?.trim()) {
        return NextResponse.json(
          { error: 'This saved import has no CSV payload to re-apply' },
          { status: 400 }
        )
      }
      csvText = batch.csvText
      if (!body.filename?.trim()) {
        filename = batch.filename
      }
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'csv is required' }, { status: 400 })
    }

    if (body.saveOnly) {
      const saved = await saveTeamlinktImportCsv({
        csvText,
        filename,
        actor: session.email,
      })
      return NextResponse.json({ saveOnly: true, ...saved })
    }

    if (body.dryRun !== false) {
      const preview = await previewTeamlinktImport(csvText)
      if (preview.error) {
        return NextResponse.json({ error: preview.error }, { status: 400 })
      }
      return NextResponse.json({
        dryRun: true,
        headers: preview.headers,
        warnings: preview.warnings,
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
      csvText,
      filename,
      actor: session.email,
    })

    return NextResponse.json({ dryRun: false, ...result })
  } catch (err) {
    console.error('players import failed', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
