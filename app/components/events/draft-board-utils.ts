import type { EventRegistrationListItem } from '@/app/lib/events/types'
import { genderGroup, genderGroupSortKey } from '@/app/lib/players/gender'
import {
  effectiveSkillScore,
  type SkillViewMode,
} from '@/app/lib/players/skill'

export type DraftAssignment = Map<string, number | null>

export type PlayerSort = 'name' | 'gender' | 'skill'

export const COPY_FEEDBACK_DURATION_MS = 2000

export const INPUT_CLASS =
  'rounded border border-[var(--tm-border,#d1d5db)] bg-[var(--tm-surface,#fff)] px-2 py-1.5 text-[var(--tm-fg,#111827)]'

export function columnId(team: number | null): string {
  return team == null ? 'unassigned' : `team-${team}`
}

export function parseColumnId(id: string): number | null {
  if (id === 'unassigned') return null
  const m = /^team-(\d+)$/.exec(id)
  if (!m) return null
  return Number.parseInt(m[1], 10)
}

export function displayName(player: EventRegistrationListItem): string {
  return player.nickname || `${player.firstName} ${player.lastName}`
}

export function captainBadgeForAssignment(
  player: EventRegistrationListItem,
  team: number | null,
  registrations: EventRegistrationListItem[],
  assignments: DraftAssignment
): '(C)' | '(CC)' | null {
  if (!player.isCaptain || team == null) return null
  const captainsOnTeam = registrations.filter((r) => {
    if (!r.isCaptain) return false
    const assigned = assignments.get(r.id)
    const effective = assigned !== undefined ? assigned : r.draftGroup
    return effective === team
  })
  return captainsOnTeam.length > 1 ? '(CC)' : '(C)'
}

export function homeLeagueText(player: EventRegistrationListItem): string | null {
  if (!player.homeLeagues || player.homeLeagues.length === 0) return null
  return player.homeLeagues.map((h) => h.label).join(', ')
}

export function sortPlayers(
  players: EventRegistrationListItem[],
  sort: PlayerSort,
  mode: SkillViewMode
): EventRegistrationListItem[] {
  return [...players].sort((a, b) => {
    if (sort === 'gender') {
      const g = genderGroupSortKey(a.gender) - genderGroupSortKey(b.gender)
      if (g !== 0) return g
    } else if (sort === 'skill') {
      const sa = effectiveSkillScore(a, mode) ?? -1
      const sb = effectiveSkillScore(b, mode) ?? -1
      if (sb !== sa) return sb - sa
    }
    return displayName(a).localeCompare(displayName(b), undefined, {
      sensitivity: 'base',
    })
  })
}

export function playerCardClass(gender: string | null): string {
  const g = genderGroup(gender)
  if (g === 'w_nb_o') {
    return 'border-[var(--tm-card-wnbo-border,#fecdd3)] bg-[var(--tm-card-wnbo-bg,rgb(255_241_242_/_0.8))]'
  }
  if (g === 'men') {
    return 'border-[var(--tm-card-men-border,#bae6fd)] bg-[var(--tm-card-men-bg,rgb(240_249_255_/_0.8))]'
  }
  return 'border-[var(--tm-border,#e5e7eb)] bg-[var(--tm-surface,#fff)]'
}

export function withEffectiveSkill(
  players: EventRegistrationListItem[],
  mode: SkillViewMode
): Array<{ skillLevel: number | null; gender: string | null }> {
  return players.map((p) => ({
    skillLevel: effectiveSkillScore(p, mode),
    gender: p.gender,
  }))
}
