import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { getPlayerSnapshot } from '@/app/lib/players/queries'
import {
  addPlayerAlias,
  addPlayerEmail,
  removePlayerAlias,
  removePlayerEmail,
  setPrimaryEmail,
  updatePlayer,
} from '@/app/lib/players/mutations'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const { id } = await context.params
  try {
    const player = await getPlayerSnapshot(id)
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    return NextResponse.json({ player })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load player'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const { id } = await context.params
  try {
    const body = (await request.json()) as {
      firstName?: string
      lastName?: string
      rosterName?: string
      jerseyNumber?: number | null
      skillLevel?: number | null
      gender?: string | null
      addEmail?: string
      removeEmailId?: string
      setPrimaryEmailId?: string
      addAlias?: string
      removeAliasId?: string
    }

    let player = await getPlayerSnapshot(id)
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const hasCorePatch =
      body.firstName !== undefined ||
      body.lastName !== undefined ||
      body.rosterName !== undefined ||
      body.jerseyNumber !== undefined ||
      body.skillLevel !== undefined ||
      body.gender !== undefined

    if (hasCorePatch) {
      player = await updatePlayer(
        id,
        {
          firstName: body.firstName,
          lastName: body.lastName,
          rosterName: body.rosterName,
          jerseyNumber: body.jerseyNumber,
          skillLevel: body.skillLevel,
          gender: body.gender,
        },
        { actor: session.email, source: 'admin' }
      )
    }

    if (body.addEmail) {
      player = await addPlayerEmail(id, body.addEmail, { actor: session.email })
    }
    if (body.removeEmailId) {
      player = await removePlayerEmail(id, body.removeEmailId, {
        actor: session.email,
      })
    }
    if (body.setPrimaryEmailId) {
      player = await setPrimaryEmail(id, body.setPrimaryEmailId, {
        actor: session.email,
      })
    }
    if (body.addAlias) {
      player = await addPlayerAlias(id, body.addAlias, { actor: session.email })
    }
    if (body.removeAliasId) {
      player = await removePlayerAlias(id, body.removeAliasId, {
        actor: session.email,
      })
    }

    return NextResponse.json({ player })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update player'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
