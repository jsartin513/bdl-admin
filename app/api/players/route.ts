import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { listPlayers, type EventMatch } from '@/app/lib/players/queries'
import { createPlayer } from '@/app/lib/players/mutations'
import { isValidSkillLevel } from '@/app/lib/players/skill'
import { isValidGender } from '@/app/lib/players/gender'
import { isValidHomeLeague } from '@/app/lib/players/home-league'

/** Parse list-players query params (exported for tests). */
export function parseListPlayersSearchParams(searchParams: URLSearchParams): {
  q?: string
  skill: number | 'unset' | null
  homeLeague: string | 'unset' | null
  homeLeagues: string[] | null
  eventId: string | null
  eventMatch: EventMatch
  includeMerged: boolean
} {
  const q = searchParams.get('q') ?? undefined
  const skillParam = searchParams.get('skill')
  const homeLeagueParam = searchParams.get('homeLeague')
  const homeLeaguesParam = searchParams.get('homeLeagues')
  const eventIdParam = searchParams.get('eventId')
  const eventMatchParam = searchParams.get('eventMatch')
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

  const homeLeagues = homeLeaguesParam
    ? homeLeaguesParam
        .split(',')
        .map((s) => s.trim())
        .filter(isValidHomeLeague)
    : null

  const eventId =
    eventIdParam &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      eventIdParam
    )
      ? eventIdParam
      : null

  const eventMatch: EventMatch =
    eventMatchParam === 'not_registered' ? 'not_registered' : 'registered'

  return { q, skill, homeLeague, homeLeagues, eventId, eventMatch, includeMerged }
}

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
