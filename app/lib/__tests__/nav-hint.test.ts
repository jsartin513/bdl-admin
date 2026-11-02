import { describe, expect, it } from 'vitest'
import { navHintAccessibleText } from '@/app/lib/nav-hint'

describe('nav hints', () => {
  it('combines title and description for accessible descriptions', () => {
    expect(
      navHintAccessibleText({
        title: 'Outbox',
        description: 'Review sent and failed outbound messages.',
      })
    ).toBe('Outbox. Review sent and failed outbound messages.')
  })
})
