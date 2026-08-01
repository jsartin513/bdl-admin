/** True when the strong-personality flag is on and notes are blank/whitespace. */
export function shouldPromptForStrongPersonalityNotes(
  nextChecked: boolean,
  notes: string
): boolean {
  return nextChecked && !notes.trim()
}
