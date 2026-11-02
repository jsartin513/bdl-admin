import { isValidSkillLevel } from '@/app/lib/players/skill'
import { isValidHomeLeague } from '@/app/lib/players/home-league'
import type { EventMatch } from '@/app/lib/players/queries'

/** Parse list-players query params (kept out of the route module for Next.js route typing). */
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
