import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { listPlayers } from '@/app/lib/players/queries'
import { createPlayer } from '@/app/lib/players/mutations'
import { isValidSkillLevel } from '@/app/lib/players/skill'
import { isValidGender } from '@/app/lib/players/gender'
import { isValidHomeLeague } from '@/app/lib/players/home-league'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { searchParams } = request.nextUrl
    const q = searchParams.get('q') ?? undefined
    const skillParam = searchParams.get('skill')
    const homeLeagueParam = searchParams.get('homeLeague')
    const eventIdParam = searchParams.get('eventId')
    const includeMerged = searchParams.get('includeMerged') === '1'

    let skill: number | 'unset' | null = null
    if (skillParam === 'unset') skill = 'unset'
    else if (skillParam) {
      const n = Number(skillParam)
      if (isValidSkillLevel(n)) skill = n
    }

    let homeLeague: string | 'unset' | null = null
    if (homeLeagueParam === 'unset') homeLeague = 'unset'
    else if (homeLeagueParam && isValidHomeLeague(homeLeagueParam)) {
      homeLeague = homeLeagueParam
    }

    const eventId =
      eventIdParam &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        eventIdParam
      )
        ? eventIdParam
        : null

    const players = await listPlayers({ q, skill, homeLeague, eventId, includeMerged })
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
