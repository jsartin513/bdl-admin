import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { mergePlayers, type MergeFieldResolution } from '@/app/lib/players/merge'

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = (await request.json()) as {
      survivorId?: string
      loserIds?: string[]
      fields?: MergeFieldResolution
    }

    if (!body.survivorId || !Array.isArray(body.loserIds)) {
      return NextResponse.json(
        { error: 'survivorId and loserIds are required' },
        { status: 400 }
      )
    }

    const result = await mergePlayers({
      survivorId: body.survivorId,
      loserIds: body.loserIds,
      fields: body.fields,
      actor: session.email,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Merge failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
