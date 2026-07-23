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

describe('PlayersPage bulk edit mode', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('selects all visible filtered players and applies a bulk gender update', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          players: [
            player({
              id: 'w1',
              firstName: 'Ada',
              lastName: 'Woman',
              rosterName: 'Ada Woman',
              gender: 'woman',
            }),
            player({
              id: 'w2',
              firstName: 'Bea',
              lastName: 'Woman',
              rosterName: 'Bea Woman',
              gender: 'woman',
            }),
            player({
              id: 'm1',
              firstName: 'Cal',
              lastName: 'Man',
              rosterName: 'Cal Man',
              gender: 'man',
              genderLabel: 'Man',
              genderGroupLabel: 'M',
            }),
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ updated: 2, players: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          players: [
            player({
              id: 'w1',
              firstName: 'Ada',
              lastName: 'Woman',
              rosterName: 'Ada Woman',
              skillLevel: 3,
              skillLabel: 'Advanced',
              gender: 'woman',
            }),
            player({
              id: 'w2',
              firstName: 'Bea',
              lastName: 'Woman',
              rosterName: 'Bea Woman',
              skillLevel: 3,
              skillLabel: 'Advanced',
              gender: 'woman',
            }),
            player({
              id: 'm1',
              firstName: 'Cal',
              lastName: 'Man',
              rosterName: 'Cal Man',
              gender: 'man',
              genderLabel: 'Man',
              genderGroupLabel: 'M',
            }),
          ],
        })
      )

    render(<PlayersPage />)

    await screen.findByText('3 players')
    expect(screen.queryByLabelText('Select Ada Woman')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Bulk edit' }))
    expect(screen.getByText(/Bulk edit mode:/)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Filter by gender'), 'w_nb_o')
    expect(screen.getByText('2 players')).toBeInTheDocument()
    expect(screen.queryByText('Cal')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Select all visible \(2\)/ }))
    expect(screen.getByLabelText('Select Ada Woman')).toBeChecked()
    expect(screen.getByLabelText('Select Bea Woman')).toBeChecked()

    await userEvent.selectOptions(screen.getByLabelText('Bulk set skill'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Apply to 2 players' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/players/bulk')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({
        playerIds: ['w1', 'w2'],
        patch: { skillLevel: 3 },
      }),
    })
    expect(await screen.findByText('Updated 2 players')).toBeInTheDocument()
  })

  it('exits quick fill when entering bulk edit', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        players: [
          player({
            id: 'missing-gender',
            gender: null,
            genderLabel: '—',
            genderGroupLabel: '—',
          }),
        ],
      })
    )

    render(<PlayersPage />)
    await screen.findByText('1 player')
    await userEvent.click(screen.getByRole('button', { name: 'Quick fill missing info (1)' }))
    expect(screen.getByText(/Quick fill mode:/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Bulk edit' }))
    expect(screen.queryByText(/Quick fill mode:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Bulk edit mode:/)).toBeInTheDocument()
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
                logoUrl: '/home-leagues/boston_dodgeball_league.webp',
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
                  logoUrl: '/home-leagues/boston_dodgeball_league.webp',
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
    expect(await screen.findByText('1.')).toBeInTheDocument()
    expect(screen.getAllByText('Boston Dodgeball League').length).toBeGreaterThanOrEqual(1)
  })
})

describe('PlayersPage tournament filters and columns', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('minimal view hides full name, roster name, and email', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        players: [
          player({
            primaryEmail: 'alex@example.com',
            rosterName: 'Alex Player',
          }),
        ],
      })
    )

    render(<PlayersPage />)

    await screen.findByText('1 player')
    expect(screen.getByRole('columnheader', { name: /First/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Last/ })).toBeInTheDocument()
    expect(screen.getByText('Alex Player')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Columns' }))
    await userEvent.click(screen.getByRole('button', { name: 'Minimal view' }))

    expect(screen.queryByRole('columnheader', { name: /First/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Last/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Alex Player')).not.toBeInTheDocument()
    expect(screen.queryByText('alex@example.com')).not.toBeInTheDocument()
    expect(screen.getByText('Alex P')).toBeInTheDocument()
  })

  it('filters by event participation and home league none set', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/events')) {
        return Promise.resolve(
          jsonResponse({
            events: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                name: 'Throw Down',
                eventDate: '2026-07-01',
                eventType: 'tournament',
                eventTypeLabel: 'Tournament',
                notes: null,
                registrationCount: 12,
              },
            ],
          })
        )
      }
      return Promise.resolve(jsonResponse({ players: [player()] }))
    })

    render(<PlayersPage />)
    await screen.findByText('1 player')

    const eventSelect = screen.getByLabelText('Filter by event')
    await userEvent.click(eventSelect)
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Throw Down (2026-07-01)' })).toBeInTheDocument()
    )
    await userEvent.selectOptions(eventSelect, '11111111-1111-4111-8111-111111111111')

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]))
      expect(
        urls.some((url) =>
          url.includes('eventId=11111111-1111-4111-8111-111111111111')
        )
      ).toBe(true)
    })

    await userEvent.selectOptions(screen.getByLabelText('Filter by home league'), 'unset')

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]))
      expect(urls.some((url) => url.includes('homeLeague=unset'))).toBe(true)
    })
  })
})
