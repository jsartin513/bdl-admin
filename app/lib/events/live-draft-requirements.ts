import type { CaptainDraftRules, CaptainDraftTeamRequirement } from '@/app/lib/captain-draft/contract'
import { genderGroup } from '@/app/lib/players/gender'
import { isValidSkillLevel } from '@/app/lib/players/skill'

export type RequirementPlayer = {
  gender: string | null
  skillLevel: number | null
}

export function countsForWomenNb(
  players: RequirementPlayer[],
  includeOther: boolean
): number {
  return players.filter((p) => {
    const g = genderGroup(p.gender)
    if (g === 'w_nb_o') return true
    if (includeOther && p.gender === 'other') return true
    return false
  }).length
}

export function countsIntermediate(
  players: RequirementPlayer[],
  rules: Pick<CaptainDraftRules, 'intermediateMin' | 'intermediateMax'>
): number {
  return players.filter((p) => {
    if (p.skillLevel == null || !isValidSkillLevel(p.skillLevel)) return false
    return p.skillLevel >= rules.intermediateMin && p.skillLevel <= rules.intermediateMax
  }).length
}

export function teamRequirementMeter(
  draftGroup: number,
  teamName: string,
  players: RequirementPlayer[],
  rules: CaptainDraftRules
): CaptainDraftTeamRequirement {
  const womenNbCount = countsForWomenNb(players, rules.includeOtherInWomenNb)
  const intermediateCount = countsIntermediate(players, rules)
  return {
    draftGroup,
    teamName,
    womenNbCount,
    womenNbRequired: rules.minWomenNb,
    intermediateCount,
    intermediateRequired: rules.minIntermediate,
  }
}
