'use client'

import { useState, useEffect } from 'react'
import {
  GameCard,
  LoadingState,
  ErrorState,
  WeekSelector,
  ConflictsAlert,
  TeamStatsCards,
  HeadToHeadMatrix,
} from '../components/schedule'
import { useScheduleData } from '../components/schedule/useScheduleData'

interface DriveFile {
  id: string
  name: string
}

type ScheduleViewTab = 'overview' | 'head-to-head'

export default function SchedulesPage() {
  const [viewTab, setViewTab] = useState<ScheduleViewTab>('overview')
  const [selectedWeek, setSelectedWeek] = useState('all')
  const [sheets, setSheets] = useState<DriveFile[]>([])
  const [selectedSheetId, setSelectedSheetId] = useState<string>('')
  const [loadingSheets, setLoadingSheets] = useState(true)
  const [sheetsError, setSheetsError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingSheets(true)
    setSheetsError(null)
    fetch('/api/drive-folder')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load leagues (${res.status})`)
        return res.json()
      })
      .then((data: DriveFile[]) => {
        setSheets(data)
        if (data.length > 0 && !selectedSheetId) {
          setSelectedSheetId(data[0].id)
        }
      })
      .catch((err) => setSheetsError(err.message))
      .finally(() => setLoadingSheets(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { games, teamStats, conflicts, loading, error, refetch } = useScheduleData({
    apiEndpoint: '/api/schedules-live',
    selectedWeek,
    sheetId: selectedSheetId || null,
    parseOptions: {
      includeHomeAway: true,
      includeMatchups: true,
      detectCourtConflicts: true,
    },
  })

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
            )}
          </div>
        </div>

        <div
          className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2"
          role="tablist"
          aria-label="Schedule view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'overview'}
            onClick={() => setViewTab('overview')}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              viewTab === 'overview'
                ? 'border border-b-0 border-gray-300 bg-white text-gray-900'
                : 'border border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Team overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'head-to-head'}
            onClick={() => setViewTab('head-to-head')}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              viewTab === 'head-to-head'
                ? 'border border-b-0 border-gray-300 bg-white text-gray-900'
                : 'border border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Head-to-head schedule
          </button>
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
            disabled={loading}
            className="px-4 py-2 rounded-md border border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {loading && <LoadingState />}

        {error && <ErrorState error={error} />}
      </div>

      {!loading && !error && (
        <>
          {viewTab === 'overview' && (
            <>
              <TeamStatsCards
                teamStats={Object.entries(teamStats).map(([teamName, stats]) => ({
                  team: teamName,
                  ...stats,
                  matchups: stats.matchups || {},
                }))}
                selectedWeek={selectedWeek}
                games={games}
              />

              <ConflictsAlert conflicts={conflicts} />

              {selectedWeek !== 'all' && selectedWeek !== 'weeks5-6' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                    Games Schedule — Week {selectedWeek}
                  </h2>
                  <div className="space-y-4">
                    {games.map((game, index) => (
                      <GameCard key={index} game={game} teamStats={teamStats} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {viewTab === 'head-to-head' && (
            <section aria-labelledby="h2h-heading" className="space-y-4">
              <h2 id="h2h-heading" className="text-2xl font-semibold text-gray-900">
                Head-to-head (scheduled meetings)
              </h2>
              <HeadToHeadMatrix teamStats={teamStats} selectedWeek={selectedWeek} />
              <ConflictsAlert conflicts={conflicts} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
