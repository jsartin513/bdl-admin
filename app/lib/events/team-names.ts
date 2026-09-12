/**
 * When teams are locked, BYOT (imported) name slots cannot change.
 * A BYOT slot is draft group g (1-based) with ≥1 teamLocked registration.
 * FA / remix slots may still be edited.
 */
export function assertTeamNamesPatchWhenLocked(
  previousNames: string[],
  nextNames: string[],
  byotDraftGroups: Iterable<number>
): void {
  const byotIndexes = [
    ...new Set(
      [...byotDraftGroups].filter((g) => Number.isInteger(g) && g >= 1)
    ),
  ].sort((a, b) => a - b)

  if (byotIndexes.length === 0) return

  for (const g of byotIndexes) {
    const i = g - 1
    if (nextNames.length <= i) {
      throw new Error(
        'Teams are locked. Unlock to edit imported BYOT team names.'
      )
    }
    const prev = (previousNames[i] ?? '').trim()
    const next = (nextNames[i] ?? '').trim()
    if (prev !== next) {
      throw new Error(
        'Teams are locked. Unlock to edit imported BYOT team names.'
      )
    }
  }
}
