import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventRegistrationListItem } from '@/app/lib/events/types'
import { EventDraftBoard } from '../EventDraftBoard'

function registration(
  overrides: Partial<EventRegistrationListItem> & { id: string }
): EventRegistrationListItem {
  return {
    eventId: 'evt-1',
    playerId: `player-${overrides.id}`,
    status: 'registered',
    draftGroup: null,
    isCaptain: false,
    teamLocked: false,
    pairId: null,
    partnerRegistrationId: null,
    partnerNickname: null,
    groupMembers: [],
    registeredAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    firstName: 'Alex',
    lastName: 'Player',
    rosterName: 'Alex Player',
    nickname: 'Alex',
    jerseyNumber: null,
    skillLevel: 40,
    skillLevelFib: null,
    skillAreas: null,
    skillLabel: 'Intermediate',
    gender: 'female',
    genderLabel: 'Female',
    genderGroupLabel: 'W/NB/O',
    primaryEmail: null,
    hasStrongPersonality: false,
    strongPersonalityNotes: null,
    homeLeagues: [],
    ...overrides,
  }
}

describe('EventDraftBoard', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('min-width: 768px'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('renders draft chrome, unassigned badge, and actions', () => {
    const assignments = new Map<string, number | null>([
      ['r1', null],
      ['r2', 1],
    ])
    render(
      <EventDraftBoard
        registrations={[
          registration({ id: 'r1', nickname: 'Unassigned One' }),
          registration({ id: 'r2', nickname: 'Team One', draftGroup: 1 }),
        ]}
        teamCount={2}
        assignments={assignments}
        onAssignmentsChange={() => undefined}
        onReshuffle={() => undefined}
        onApply={() => undefined}
        onDiscard={() => undefined}
        applying={false}
        error={null}
        snapshots={[]}
        snapshotsBusy={false}
        onSaveSnapshot={async () => undefined}
        onLoadSnapshot={() => undefined}
        onRenameSnapshot={async () => undefined}
        onDeleteSnapshot={async () => undefined}
        onPromoteSnapshot={async () => undefined}
      />
    )

    expect(screen.getByRole('heading', { name: 'Draft mode' })).toBeInTheDocument()
    expect(screen.getByText('Unassigned 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reshuffle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply to event' })).toBeInTheDocument()
    expect(screen.getByTestId('draft-board-wide')).toBeInTheDocument()
  })

  it('shows BYOT sections and locked aria-disabled', () => {
    const assignments = new Map<string, number | null>([
      ['locked', 1],
      ['fa', null],
    ])
    render(
      <EventDraftBoard
        registrations={[
          registration({
            id: 'locked',
            nickname: 'Locked BYOT',
            teamLocked: true,
            draftGroup: 1,
          }),
          registration({ id: 'fa', nickname: 'Free Agent' }),
        ]}
        teamCount={1}
        assignments={assignments}
        onAssignmentsChange={() => undefined}
        onReshuffle={() => undefined}
        onApply={() => undefined}
        onDiscard={() => undefined}
        applying={false}
        error={null}
        byotMode
        teamNames={['Sharks']}
        snapshots={[]}
        snapshotsBusy={false}
        onSaveSnapshot={async () => undefined}
        onLoadSnapshot={() => undefined}
        onRenameSnapshot={async () => undefined}
        onDeleteSnapshot={async () => undefined}
        onPromoteSnapshot={async () => undefined}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Assign free agents' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Signup \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Added free agents/i)).toBeInTheDocument()
    expect(screen.getByText('Locked BYOT').closest('[aria-disabled="true"]')).toBeTruthy()
  })

  it('disables Save snapshot when name is empty and shows errors', async () => {
    render(
      <EventDraftBoard
        registrations={[registration({ id: 'r1', nickname: 'Alex' })]}
        teamCount={1}
        assignments={new Map([['r1', 1]])}
        onAssignmentsChange={() => undefined}
        onReshuffle={() => undefined}
        onApply={() => undefined}
        onDiscard={() => undefined}
        applying={false}
        error="Something went wrong"
        snapshots={[]}
        snapshotsBusy={false}
        onSaveSnapshot={async () => undefined}
        onLoadSnapshot={() => undefined}
        onRenameSnapshot={async () => undefined}
        onDeleteSnapshot={async () => undefined}
        onPromoteSnapshot={async () => undefined}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: 'Save snapshot' })).toBeDisabled()
    await userEvent.type(screen.getByPlaceholderText('e.g. Balanced A'), 'Plan A')
    expect(screen.getByRole('button', { name: 'Save snapshot' })).toBeEnabled()
  })

  it('exposes copy roster aria-label', () => {
    render(
      <EventDraftBoard
        registrations={[
          registration({ id: 'r1', nickname: 'Alex', draftGroup: 1 }),
        ]}
        teamCount={1}
        assignments={new Map([['r1', 1]])}
        onAssignmentsChange={() => undefined}
        onReshuffle={() => undefined}
        onApply={() => undefined}
        onDiscard={() => undefined}
        applying={false}
        error={null}
        teamNames={['Team A']}
        snapshots={[]}
        snapshotsBusy={false}
        onSaveSnapshot={async () => undefined}
        onLoadSnapshot={() => undefined}
        onRenameSnapshot={async () => undefined}
        onDeleteSnapshot={async () => undefined}
        onPromoteSnapshot={async () => undefined}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Copy roster names' })
    ).toBeInTheDocument()
  })

  it('uses stacked layout below md', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <EventDraftBoard
        registrations={[registration({ id: 'r1', nickname: 'Alex' })]}
        teamCount={1}
        assignments={new Map([['r1', null]])}
        onAssignmentsChange={() => undefined}
        onReshuffle={() => undefined}
        onApply={() => undefined}
        onDiscard={() => undefined}
        applying={false}
        error={null}
        snapshots={[]}
        snapshotsBusy={false}
        onSaveSnapshot={async () => undefined}
        onLoadSnapshot={() => undefined}
        onRenameSnapshot={async () => undefined}
        onDeleteSnapshot={async () => undefined}
        onPromoteSnapshot={async () => undefined}
      />
    )
    expect(screen.getByTestId('draft-board-stacked')).toBeInTheDocument()
  })
})
