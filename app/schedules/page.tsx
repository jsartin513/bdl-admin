'use client'

import Link from 'next/link'
import { Suspense, useState, useEffect, useMemo } from 'react'
import {
  GameCard,
  LoadingState,
  ErrorState,
  WeekSelector,
  ConflictsAlert,
  TeamStatsCards,
} from '../components/schedule'
import { useScheduleData } from '../components/schedule/useScheduleData'
import { useDevMode } from '@/app/hooks/useDevMode'

interface DriveFile {
  id: string
  name: string
}

export default function SchedulesPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-6 text-gray-600">Loading…</div>}>
      <SchedulesPageContent />
    </Suspense>
  )
}

function isLocalLeagueId(id: string): boolean {
  return id.startsWith('local:')
}

function localLeagueFilename(id: string): string {
  return id.slice('local:'.length)
}

type ScheduleView = 'everyone' | 'byTeam'

function SchedulesPageContent() {
  const { devMode } = useDevMode()
  const [selectedWeek, setSelectedWeek] = useState('all')
  const [sheets, setSheets] = useState<DriveFile[]>([])
  const [selectedSheetId, setSelectedSheetId] = useState<string>('')
  const [loadingSheets, setLoadingSheets] = useState(true)
  const [sheetsError, setSheetsError] = useState<string | null>(null)
  const [scheduleView, setScheduleView] = useState<ScheduleView>('everyone')
  const [focusTeam, setFocusTeam] = useState('')

  useEffect(() => {
    setLoadingSheets(true)
    setSheetsError(null)

    const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
      ])

    Promise.all([
      fetch('/api/local-leagues').then(async (res) => {
        if (!res.ok) return [] as DriveFile[]
        return (await res.json()) as DriveFile[]
      }),
      withTimeout(
        fetch('/api/drive-folder').then(async (res) => {
          if (!res.ok) {
            return { ok: false as const, error: `Drive leagues unavailable (${res.status})` }
          }
          return { ok: true as const, data: (await res.json()) as DriveFile[] }
        }),
        2500,
        { ok: false as const, error: 'Drive leagues timed out' }
      ),
    ])
      .then(([localFiles, driveResult]) => {
        const driveFiles = driveResult.ok ? driveResult.data : []
        const merged = [...localFiles, ...driveFiles]
        setSheets(merged)

        if (!driveResult.ok && localFiles.length === 0) {
          setSheetsError(driveResult.error)
        } else if (!driveResult.ok && localFiles.length > 0) {
          setSheetsError(null)
        }

        if (merged.length > 0 && !selectedSheetId) {
          const eightTeam = localFiles.find((f) =>
            f.name.toLowerCase().includes('eight team')
          )
          setSelectedSheetId(eightTeam?.id ?? merged[0].id)
        }
      })
      .catch((err) => setSheetsError(err.message))
      .finally(() => setLoadingSheets(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scheduleReady =
    !loadingSheets && selectedSheetId.length > 0 && sheets.length > 0

  const usingLocalLeague = isLocalLeagueId(selectedSheetId)
  const apiEndpoint = usingLocalLeague ? '/api/schedules-local' : '/api/schedules-live'

  const scheduleParseOptions = useMemo(
    () => ({
      includeHomeAway: true,
      includeMatchups: true,
      detectCourtConflicts: true,
    }),
    []
  )

  const { games, teamStats, conflicts, loading, error, refetch } = useScheduleData({
    apiEndpoint,
    selectedWeek,
    league: usingLocalLeague ? localLeagueFilename(selectedSheetId) : null,
    sheetId: usingLocalLeague ? null : selectedSheetId || null,
    skipScheduleFetch: !scheduleReady,
    parseOptions: scheduleParseOptions,
  })

  const scheduleContentVisible = scheduleReady && !loading && !error

  const teamNames = useMemo(() => Object.keys(teamStats), [teamStats])

  const weekGroups = useMemo(() => {
    const groups: { weekLabel: string; games: typeof games }[] = []
    let current: { weekLabel: string; games: typeof games } | null = null

    for (const game of games) {
      const match = game.gameNumber.match(/^Week\s*(\d+)/i)
      const weekLabel = match ? `Week ${match[1]}` : 'Schedule'
      if (!current || current.weekLabel !== weekLabel) {
        current = { weekLabel, games: [] }
        groups.push(current)
      }
      current.games.push(game)
    }
    return groups
  }, [games])

  const showWeekDelimiters = weekGroups.length > 1

  const scheduleHeading =
    selectedWeek === 'all'
      ? 'Games Schedule — All Weeks'
      : selectedWeek === 'weeks5-6'
        ? 'Games Schedule — Weeks 5–6'
        : `Games Schedule — Week ${selectedWeek}`

  useEffect(() => {
    if (teamNames.length === 0) {
      setFocusTeam('')
      return
    }
    if (!focusTeam || !teamNames.includes(focusTeam)) {
      setFocusTeam(teamNames[0])
    }
  }, [teamNames, focusTeam, selectedWeek, selectedSheetId])

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">Dodgeball League Schedules</h1>

        <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <label htmlFor="league-select" className="font-semibold text-gray-900">
              League:
            </label>
            {loadingSheets ? (
              <span className="text-gray-500">Loading leagues…</span>
            ) : sheetsError ? (
              <span className="text-red-600">{sheetsError}</span>
            ) : (
              <>
                <select
                  id="league-select"
                  value={selectedSheetId}
                  onChange={(e) => setSelectedSheetId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md min-w-[240px]"
                >
                  {sheets.length === 0 && <option value="">No leagues found</option>}
                  {sheets.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
                {selectedSheetId && !isLocalLeagueId(selectedSheetId) ? (
                  <Link
                    href={`/create-league?templateId=${encodeURIComponent(selectedSheetId)}`}
                    className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    New league from this template
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <WeekSelector
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            showAllWeeks={true}
          />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={!scheduleReady || loading}
            className="px-4 py-2 rounded-md border border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {(loadingSheets || (scheduleReady && loading)) && <LoadingState />}

        {error && scheduleReady && <ErrorState error={error} />}
      </div>

      {scheduleContentVisible && (
        <>
          <TeamStatsCards
            teamStats={Object.entries(teamStats).map(([teamName, stats]) => ({
              team: teamName,
              ...stats,
              matchups: stats.matchups || {},
            }))}
            selectedWeek={selectedWeek}
            games={games}
            showTeamSchedules={devMode}
          />

          <ConflictsAlert conflicts={conflicts} />

          {games.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {scheduleHeading}
                </h2>
                <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setScheduleView('everyone')}
                    className={`px-3 py-1.5 text-sm font-medium ${
                      scheduleView === 'everyone'
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Everyone
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleView('byTeam')
                      if (!focusTeam && teamNames.length > 0) {
                        setFocusTeam(teamNames[0])
                      }
                    }}
                    className={`px-3 py-1.5 text-sm font-medium border-l border-gray-300 ${
                      scheduleView === 'byTeam'
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    By team
                  </button>
                </div>
              </div>

              {scheduleView === 'byTeam' && teamNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {teamNames.map((team) => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setFocusTeam(team)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        team === focusTeam
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              )}

              <div
                className={
                  showWeekDelimiters
                    ? 'flex gap-4 overflow-x-auto pb-2 items-start'
                    : 'space-y-8'
                }
              >
                {weekGroups.map((group) => (
                  <section
                    key={group.weekLabel}
                    className={
                      showWeekDelimiters
                        ? scheduleView === 'byTeam'
                          ? 'min-w-[260px] w-[280px] shrink-0 border border-gray-300 rounded-lg p-3 bg-gray-50'
                          : 'min-w-[420px] w-[480px] shrink-0 border border-gray-300 rounded-lg p-3 bg-gray-50'
                        : undefined
                    }
                  >
                    {showWeekDelimiters && (
                      <div className="mb-3 pb-2 border-b-2 border-gray-800">
                        <h3 className="text-lg font-bold text-gray-900">{group.weekLabel}</h3>
                      </div>
                    )}
                    <div className="space-y-3">
                      {group.games.map((game, index) => (
                        <GameCard
                          key={`${group.weekLabel}-${index}`}
                          game={game}
                          teamStats={teamStats}
                          focusTeam={scheduleView === 'byTeam' ? focusTeam || undefined : undefined}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
