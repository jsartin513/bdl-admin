import type {
  NonBdlEventAttendeeItem,
  NonBdlEventDetail,
  NonBdlEventTeamItem,
} from '@/app/lib/non-bdl-events/types'
import {
  ballTypeLabel,
  hostOrgDisplayLabel,
} from '@/app/lib/non-bdl-events/types'

function formatDisplayDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function buildGoodLuckBlurb(input: {
  event: {
    name: string
    eventDate: string
    ballType: string
    division: string | null
    city: string | null
    hostOrgHomeLeague: string | null
    hostOrgName: string | null
  }
  teams: NonBdlEventTeamItem[]
  attendees: NonBdlEventAttendeeItem[]
}): string {
  const host = hostOrgDisplayLabel(
    input.event.hostOrgHomeLeague,
    input.event.hostOrgName
  )
  const date = formatDisplayDate(input.event.eventDate)
  const ball = ballTypeLabel(input.event.ballType)
  const placeParts = [
    input.event.city?.trim() || null,
    host !== '—' ? host : null,
  ].filter(Boolean)

  const header = [
    `Good luck to our BDL players heading to ${input.event.name}!`,
    `${date}${placeParts.length ? ` · ${placeParts.join(' · ')}` : ''}`,
    [
      `${ball} ball`,
      input.event.division?.trim() ? `${input.event.division.trim()} division` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  ]
    .filter(Boolean)
    .join('\n')

  if (input.attendees.length === 0) {
    return `${header}\n\n(No players listed yet.)`
  }

  const byTeam = new Map<string | null, NonBdlEventAttendeeItem[]>()
  for (const a of input.attendees) {
    const key = a.teamId
    const list = byTeam.get(key) ?? []
    list.push(a)
    byTeam.set(key, list)
  }

  const teamNameById = new Map(input.teams.map((t) => [t.id, t.name]))
  const sections: string[] = []

  const assignedTeamIds = [...byTeam.keys()].filter((id): id is string => id != null)
  assignedTeamIds.sort((a, b) =>
    (teamNameById.get(a) ?? '').localeCompare(teamNameById.get(b) ?? '')
  )

  for (const teamId of assignedTeamIds) {
    const members = byTeam.get(teamId) ?? []
    members.sort((a, b) => a.nickname.localeCompare(b.nickname))
    const teamName = teamNameById.get(teamId) ?? 'Team'
    const names = members.map((m) => m.nickname).join(', ')
    sections.push(`${teamName}: ${names}`)
  }

  const unassigned = byTeam.get(null) ?? []
  if (unassigned.length > 0) {
    unassigned.sort((a, b) => a.nickname.localeCompare(b.nickname))
    sections.push(
      `Playing (team TBD): ${unassigned.map((m) => m.nickname).join(', ')}`
    )
  }

  return `${header}\n\n${sections.join('\n')}\n\nGo BDL!`
}

export function buildGoodLuckFromDetail(detail: NonBdlEventDetail): string {
  return buildGoodLuckBlurb({
    event: detail.event,
    teams: detail.teams,
    attendees: detail.attendees,
  })
}
