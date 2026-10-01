export type LiveDraftOrderType = 'snake' | 'linear' | 'custom'

export function generatePickSequence(
  orderType: LiveDraftOrderType,
  teamOrder: number[],
  pickCount: number,
  customSlots: number[] | null | undefined
): number[] {
  if (pickCount <= 0) return []
  if (teamOrder.length === 0) {
    throw new Error('team_order must include at least one draft group')
  }

  if (orderType === 'custom') {
    const slots = customSlots ?? []
    if (slots.length < pickCount) {
      throw new Error(
        `custom_slots must have at least ${pickCount} entries (has ${slots.length})`
      )
    }
    return slots.slice(0, pickCount)
  }

  const n = teamOrder.length
  const result: number[] = []
  for (let i = 0; i < pickCount; i++) {
    const round = Math.floor(i / n)
    const posInRound = i % n
    const idx =
      orderType === 'snake' && round % 2 === 1 ? n - 1 - posInRound : posInRound
    result.push(teamOrder[idx])
  }
  return result
}

export function defaultTeamOrderFromRegistrations(
  registrations: Array<{ draftGroup: number | null; isCaptain: boolean }>
): number[] {
  const groups = new Set<number>()
  for (const r of registrations) {
    if (r.draftGroup != null) groups.add(r.draftGroup)
  }
  return [...groups].sort((a, b) => a - b)
}
