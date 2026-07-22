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
    homeLeagues: [],
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
    homeLeagues: [],
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

  it('shows one missing player at a time and forces skill/gender controls visible', async () => {
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
          player({
            id: 'missing-both',
            firstName: 'Drew',
            lastName: 'BothMissing',
            rosterName: 'Drew BothMissing',
            skillLevel: null,
            skillLabel: 'Unset',
            gender: null,
            genderLabel: '—',
            genderGroupLabel: '—',
          }),
        ],
      })
    )

    render(<PlayersPage />)

    await screen.findByText('4 players')
    expect(screen.queryByText('Gender')).not.toBeInTheDocument()
    expect(screen.queryByText('Skill')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Quick fill missing info (3)' }))

    expect(screen.getByText(/Quick fill mode:/)).toBeInTheDocument()
    expect(screen.getByText('3 players remaining')).toBeInTheDocument()
    expect(screen.queryByText('Casey')).not.toBeInTheDocument()
    // Most-incomplete first, and only that one row is shown.
    expect(screen.getByText('Drew')).toBeInTheDocument()
    expect(screen.getByLabelText('Set gender for Drew BothMissing')).toBeInTheDocument()
    expect(screen.getByLabelText('Set skill for Drew BothMissing')).toBeInTheDocument()
    expect(screen.queryByText('Alex')).not.toBeInTheDocument()
    expect(screen.queryByText('Blair')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save info' })).not.toBeInTheDocument()
  })

  it('auto-saves when the last missing field is selected', async () => {
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

  it('waits until both missing fields are set before auto-saving', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          players: [
            player({
              id: 'missing-both',
              firstName: 'Drew',
              lastName: 'BothMissing',
              rosterName: 'Drew BothMissing',
              skillLevel: null,
              skillLabel: 'Unset',
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
            id: 'missing-both',
            firstName: 'Drew',
            lastName: 'BothMissing',
            rosterName: 'Drew BothMissing',
            skillLevel: 2,
            gender: 'man',
          }),
        })
      )
      .mockResolvedValueOnce(jsonResponse({ players: [] }))

    render(<PlayersPage />)

    await screen.findByText('1 player')
    await userEvent.click(screen.getByRole('button', { name: 'Quick fill missing info (1)' }))
    await userEvent.selectOptions(screen.getByLabelText('Set gender for Drew BothMissing'), 'man')

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await userEvent.selectOptions(screen.getByLabelText('Set skill for Drew BothMissing'), '2')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ skillLevel: 2, gender: 'man' }),
    })
  })
})

describe('PlayersPage home leagues', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('adds a home league from the edit panel', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ players: [player()] }))
      .mockResolvedValueOnce(jsonResponse({ player: playerSnapshot() }))
      .mockResolvedValueOnce(
        jsonResponse({
          player: playerSnapshot({
            homeLeagues: [
              {
                id: 'hl-1',
                homeLeague: 'boston_dodgeball_league',
                label: 'Boston Dodgeball League',
                sortOrder: 0,
              },
            ],
          }),
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          players: [
            player({
              homeLeagues: [
                {
                  homeLeague: 'boston_dodgeball_league',
                  label: 'Boston Dodgeball League',
                },
              ],
            }),
          ],
        })
      )

    render(<PlayersPage />)

    await screen.findByText('1 player')
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Home leagues')).toBeInTheDocument()

    await userEvent.selectOptions(
      screen.getByDisplayValue('Select home league'),
      'boston_dodgeball_league'
    )
    const homeLeagueSelect = screen.getByDisplayValue('Boston Dodgeball League')
    const addHomeLeagueButton = homeLeagueSelect.parentElement?.querySelector('button')
    expect(addHomeLeagueButton).toBeTruthy()
    await userEvent.click(addHomeLeagueButton!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/players/player-1')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ addHomeLeague: 'boston_dodgeball_league' }),
    })
    expect(await screen.findByText(/1\.\s*Boston Dodgeball League|Boston Dodgeball League/)).toBeInTheDocument()
  })
})
