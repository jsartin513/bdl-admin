import { describe, expect, it } from 'vitest'
import { shouldPromptForStrongPersonalityNotes } from '@/app/lib/players/strong-personality'

describe('shouldPromptForStrongPersonalityNotes', () => {
  it('prompts when enabling strong personality without notes', () => {
    expect(shouldPromptForStrongPersonalityNotes(true, '')).toBe(true)
    expect(shouldPromptForStrongPersonalityNotes(true, '   ')).toBe(true)
  })

  it('does not prompt when notes are present or checkbox is not enabled', () => {
    expect(shouldPromptForStrongPersonalityNotes(true, 'Needs clear communication plan')).toBe(false)
    expect(shouldPromptForStrongPersonalityNotes(false, '')).toBe(false)
  })
})
