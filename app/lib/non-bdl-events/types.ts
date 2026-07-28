import {
  HOME_LEAGUES,
  homeLeagueLabel,
  isValidHomeLeague,
  type HomeLeague,
} from '@/app/lib/players/home-league'

export const BALL_TYPES = {
  foam: 'Foam',
  cloth: 'Cloth',
} as const

export type BallType = keyof typeof BALL_TYPES

export function isValidBallType(value: unknown): value is BallType {
  return value === 'foam' || value === 'cloth'
}

export function ballTypeLabel(type: string | null | undefined): string {
  if (type && isValidBallType(type)) return BALL_TYPES[type]
  return BALL_TYPES.foam
}

export type NonBdlEventRecord = {
  id: string
  name: string
  eventDate: string
  ballType: string
  division: string | null
  city: string | null
  hostOrgHomeLeague: string | null
  hostOrgName: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type NonBdlEventListItem = {
  id: string
  name: string
  eventDate: string
  ballType: string
  ballTypeLabel: string
  division: string | null
  city: string | null
  hostOrgLabel: string
  attendeeCount: number
}

export type NonBdlEventTeamItem = {
  id: string
  eventId: string
  name: string
  resultText: string | null
  createdAt: Date
  updatedAt: Date
}

export type NonBdlEventAttendeeItem = {
  id: string
  eventId: string
  playerId: string
  teamId: string | null
  teamName: string | null
  notes: string | null
  firstName: string
  lastName: string
  rosterName: string
  nickname: string
  createdAt: Date
  updatedAt: Date
}

export type NonBdlEventStoryItem = {
  id: string
  eventId: string
  title: string | null
  body: string
  sortOrder: number
  teamIds: string[]
  playerIds: string[]
  createdAt: Date
  updatedAt: Date
}

export type NonBdlEventPhotoItem = {
  id: string
  eventId: string
  blobUrl: string
  pathname: string
  caption: string | null
  sortOrder: number
  teamIds: string[]
  playerIds: string[]
  createdAt: Date
  updatedAt: Date
}

export type NonBdlEventDetail = {
  event: NonBdlEventRecord & {
    ballTypeLabel: string
    hostOrgLabel: string
  }
  teams: NonBdlEventTeamItem[]
  attendees: NonBdlEventAttendeeItem[]
  stories: NonBdlEventStoryItem[]
  photos: NonBdlEventPhotoItem[]
}

export function hostOrgDisplayLabel(
  homeLeague: string | null | undefined,
  name: string | null | undefined
): string {
  const fromLeague =
    homeLeague && isValidHomeLeague(homeLeague)
      ? homeLeagueLabel(homeLeague)
      : null
  const fromName = name?.trim() ? name.trim() : null
  if (fromName && fromLeague && fromName !== fromLeague) {
    return `${fromName} (${fromLeague})`
  }
  return fromName || fromLeague || '—'
}

export function parseHostOrg(input: {
  hostOrgHomeLeague?: string | null
  hostOrgName?: string | null
}): { hostOrgHomeLeague: HomeLeague | null; hostOrgName: string | null } {
  const rawLeague =
    typeof input.hostOrgHomeLeague === 'string'
      ? input.hostOrgHomeLeague.trim()
      : input.hostOrgHomeLeague === null
        ? null
        : undefined
  const rawName =
    typeof input.hostOrgName === 'string'
      ? input.hostOrgName.trim()
      : input.hostOrgName === null
        ? null
        : undefined

  let hostOrgHomeLeague: HomeLeague | null = null
  if (rawLeague === null || rawLeague === '') {
    hostOrgHomeLeague = null
  } else if (rawLeague !== undefined) {
    if (!isValidHomeLeague(rawLeague)) {
      throw new Error('Invalid hostOrgHomeLeague')
    }
    hostOrgHomeLeague = rawLeague
  }

  const hostOrgName =
    rawName === undefined ? null : rawName === null || rawName === '' ? null : rawName

  // When called for create with both undefined, treat as missing.
  if (rawLeague === undefined && rawName === undefined) {
    throw new Error('host org is required (home league and/or name)')
  }

  // For create, at least one must be present. Callers that only patch one field
  // should use parseHostOrgPatch instead.
  if (hostOrgHomeLeague == null && hostOrgName == null) {
    throw new Error('host org is required (home league and/or name)')
  }

  return { hostOrgHomeLeague, hostOrgName }
}

export function parseHostOrgForCreate(input: {
  hostOrgHomeLeague?: string | null
  hostOrgName?: string | null
}): { hostOrgHomeLeague: HomeLeague | null; hostOrgName: string | null } {
  return parseHostOrg(input)
}

export function parseHostOrgPatch(
  patch: {
    hostOrgHomeLeague?: string | null
    hostOrgName?: string | null
  },
  current: {
    hostOrgHomeLeague: string | null
    hostOrgName: string | null
  }
): { hostOrgHomeLeague: string | null; hostOrgName: string | null } | null {
  const hasLeague = Object.prototype.hasOwnProperty.call(patch, 'hostOrgHomeLeague')
  const hasName = Object.prototype.hasOwnProperty.call(patch, 'hostOrgName')
  if (!hasLeague && !hasName) return null

  let hostOrgHomeLeague = current.hostOrgHomeLeague
  let hostOrgName = current.hostOrgName

  if (hasLeague) {
    const raw = patch.hostOrgHomeLeague
    if (raw == null || raw === '') {
      hostOrgHomeLeague = null
    } else if (!isValidHomeLeague(raw)) {
      throw new Error('Invalid hostOrgHomeLeague')
    } else {
      hostOrgHomeLeague = raw
    }
  }

  if (hasName) {
    const raw = patch.hostOrgName
    hostOrgName = raw == null || String(raw).trim() === '' ? null : String(raw).trim()
  }

  if (hostOrgHomeLeague == null && hostOrgName == null) {
    throw new Error('host org is required (home league and/or name)')
  }

  return { hostOrgHomeLeague, hostOrgName }
}

export { HOME_LEAGUES }
