import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { listPlayers } from '@/app/lib/players/queries'
import { parseListPlayersSearchParams } from '@/app/lib/players/list-params'
import { createPlayer } from '@/app/lib/players/mutations'
import { isValidGender } from '@/app/lib/players/gender'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const opts = parseListPlayersSearchParams(request.nextUrl.searchParams)
    const players = await listPlayers(opts)
    return NextResponse.json({ players })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list players'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = (await request.json()) as {
      firstName?: string
      lastName?: string
      rosterName?: string
      nickname?: string | null
      jerseyNumber?: number | null
      jerseyName?: string | null
      skillLevel?: number | null
      skillLevelFib?: number | null
      skillAreas?: {
        offense?: number | null
        defense?: number | null
        stayingAlive?: number | null
        courtPresence?: number | null
      } | null
      gender?: string | null
      email?: string | null
    }

    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      return NextResponse.json(
        { error: 'firstName and lastName are required' },
        { status: 400 }
      )
    }

    if (body.gender != null && body.gender !== '' && !isValidGender(body.gender)) {
      return NextResponse.json({ error: 'Invalid gender' }, { status: 400 })
    }

    const player = await createPlayer({
      firstName: body.firstName,
      lastName: body.lastName,
      rosterName: body.rosterName,
      nickname: body.nickname,
      jerseyNumber: body.jerseyNumber ?? null,
      jerseyName: body.jerseyName,
      skillLevel: body.skillLevel ?? null,
      skillLevelFib: body.skillLevelFib ?? null,
      skillAreas: body.skillAreas ?? null,
      gender: body.gender || null,
      email: body.email,
      actor: session.email,
      source: 'admin',
    })

    return NextResponse.json({ player }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create player'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
