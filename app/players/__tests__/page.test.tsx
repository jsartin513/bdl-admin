import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PlayersPage from '../page'

const STORAGE_KEY = 'bdl-admin.players.visibleColumns'

function player(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'player-1',
    firstName: 'Alex',
    lastName: 'Player',
    rosterName: 'Alex Player',
    nickname: 'Alex P',
    jerseyNumber: null,
    jerseyName: 'Player',
    skillLevel: 2,
    skillLabel: 'Intermediate',
    gender: 'woman',
    genderLabel: 'Woman',
    genderGroupLabel: 'W/NB/O',
    primaryEmail: null,
    isMerged: false,
    hasStrongPersonality: false,
    strongPersonalityNotes: null,
    ...overrides,
  }
}

function playerSnapshot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'player-1',
    firstName: 'Alex',
    lastName: 'Player',
    rosterName: 'Alex Player',
    nickname: 'Alex P',
    nicknameCustom: null,
    jerseyNumber: null,
    jerseyName: 'Player',
    jerseyNameCustom: null,
    skillLevel: 2,
    gender: 'woman',
    isMerged: false,
    mergedIntoPlayerId: null,
    hasStrongPersonality: false,
    strongPersonalityNotes: null,
    emails: [],
    aliases: [],
    ...overrides,
  }
}

function jsonResponse(data: Record<string, unknown>, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(data),
  }
}

describe('PlayersPage quick fill mode', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('shows only players missing info and forces skill/gender controls visible in quick fill mode', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        gender: false,
        skill: false,
      })
    )

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        players: [
          player({ id: 'complete', firstName: 'Casey', lastName: 'Complete', rosterName: 'Casey Complete' }),
          player({
            id: 'missing-gender',
            firstName: 'Alex',
            lastName: 'NoGender',
            rosterName: 'Alex NoGender',
            gender: null,
            genderLabel: '—',
            genderGroupLabel: '—',
          }),
          player({
            id: 'missing-skill',
            firstName: 'Blair',
            lastName: 'NoSkill',
            rosterName: 'Blair NoSkill',
            skillLevel: null,
            skillLabel: 'Unset',
            gender: 'man',
            genderLabel: 'Man',
            genderGroupLabel: 'M',
          }),
        ],
      })
    )

    render(<PlayersPage />)

    await screen.findByText('3 players')
    expect(screen.queryByText('Gender')).not.toBeInTheDocument()
    expect(screen.queryByText('Skill')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Quick fill missing info (2)' }))

    expect(screen.getByText(/Quick fill mode:/)).toBeInTheDocument()
    expect(screen.queryByText('Casey')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Set gender for Alex NoGender')).toBeInTheDocument()
    expect(screen.getByLabelText('Set skill for Blair NoSkill')).toBeInTheDocument()
  })

  it('saves only the missing fields from inline quick fill controls', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          players: [
            player({
              id: 'missing-gender',
              firstName: 'Alex',
              lastName: 'NoGender',
              rosterName: 'Alex NoGender',
              gender: null,
              genderLabel: '—',
              genderGroupLabel: '—',
            }),
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          player: playerSnapshot({
            id: 'missing-gender',
            firstName: 'Alex',
            lastName: 'NoGender',
            rosterName: 'Alex NoGender',
          }),
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          players: [
            player({
              id: 'missing-gender',
              firstName: 'Alex',
              lastName: 'NoGender',
              rosterName: 'Alex NoGender',
            }),
          ],
        })
      )

    render(<PlayersPage />)

    await screen.findByText('1 player')
    await userEvent.click(screen.getByRole('button', { name: 'Quick fill missing info (1)' }))
    await userEvent.selectOptions(screen.getByLabelText('Set gender for Alex NoGender'), 'woman')
    await userEvent.click(screen.getByRole('button', { name: 'Save info' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/players/missing-gender')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender: 'woman' }),
    })

    await waitFor(() =>
      expect(screen.getByText('Everyone currently has gender and skill filled in.')).toBeInTheDocument()
    )
  })
})
