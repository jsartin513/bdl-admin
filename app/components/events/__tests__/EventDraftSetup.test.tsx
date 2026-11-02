import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EventDraftSetup } from '../EventDraftSetup'

describe('EventDraftSetup', () => {
  it('shows draft radios and Start drafting', async () => {
    const onStart = vi.fn()
    const onCancel = vi.fn()
    const onSeed = vi.fn()
    render(
      <EventDraftSetup
        hasByotLocked={false}
        minDraftTeamCount={1}
        registrationCount={14}
        draftTeamCount={2}
        onDraftTeamCountChange={() => undefined}
        draftSeedMode="auto"
        onDraftSeedModeChange={onSeed}
        hasExistingGroups
        onCancel={onCancel}
        onStart={onStart}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Draft setup' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Number of teams/i)).toHaveValue(2)
    await userEvent.click(
      screen.getByRole('radio', {
        name: /Empty free-agent pool/i,
      })
    )
    expect(onSeed).toHaveBeenCalledWith('empty')
    await userEvent.click(screen.getByRole('button', { name: 'Start drafting' }))
    expect(onStart).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('uses BYOT labels when locked seats exist', () => {
    render(
      <EventDraftSetup
        hasByotLocked
        minDraftTeamCount={3}
        registrationCount={20}
        draftTeamCount={3}
        onDraftTeamCountChange={() => undefined}
        draftSeedMode="existing"
        onDraftSeedModeChange={() => undefined}
        hasExistingGroups
        onCancel={() => undefined}
        onStart={() => undefined}
      />
    )
    expect(
      screen.getByRole('heading', { name: 'Finish team assignments' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Open assignment board' })
    ).toBeInTheDocument()
  })
})
