'use client'

import { useState } from 'react'
import {
  GameCard,
  LoadingState,
  ErrorState,
  WeekSelector,
  ConflictsAlert,
  TeamStatsTable,
  TeamStatsCards,
} from '../components/schedule'
import { useScheduleData } from '../components/schedule/useScheduleData'

export default function SchedulesPage() {
  // Initialize selectedWeek from URL params or default to 'all'
  const [selectedWeek, setSelectedWeek] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('week') || 'all'
    }
    return 'all'
  })

  const { games, teamStats, conflicts, loading, error, refetch } = useScheduleData({
    apiEndpoint: '/api/schedules',
    selectedWeek,
    requiresAuth: true,
    parseOptions: {
      includeHomeAway: true,
      includeMatchups: true,
      detectCourtConflicts: true,
    },
  })

  const handleRefresh = () => {
    console.log('Manual refresh triggered')
    refetch()
  }

  if (loading) return <LoadingState />
  
  if (error) return <ErrorState error={error} />

  return (
    <div className="p-6">
              <h1 className="text-3xl font-bold mb-4 text-gray-900">Dodgeball League Schedules (Live)</h1>
        <p className="text-gray-700 mb-4">Live version reading from Google Sheets - requires authentication</p>
      
      <div className="flex items-center gap-4 mb-6">
        <WeekSelector 
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
          showAllWeeks={true}
        />
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">Debug Information</h3>
        <div className="text-sm text-blue-700">
          <p>Selected Week: {selectedWeek}</p>
          <p>Games Found: {games.length}</p>
          <p>Teams Found: {Object.keys(teamStats).length}</p>
          <p>Conflicts: {conflicts.length}</p>
        </div>
      </div>
      
      <ConflictsAlert conflicts={conflicts} />

      <TeamStatsCards 
        teamStats={Object.entries(teamStats).map(([teamName, stats]) => ({ team: teamName, ...stats, matchups: stats.matchups || {} }))}
        selectedWeek={selectedWeek}
      />

      <TeamStatsTable 
        teamStats={teamStats}
      />

      {/* Team Matchups Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">
          {selectedWeek === 'all' ? 'Team Matchups - All Weeks Combined' : `Team Matchups - Week ${selectedWeek}`}
        </h2>
        {Object.keys(teamStats).length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              {selectedWeek === 'all' 
                ? 'No matchup data available across all weeks.' 
                : `No matchup data available for Week ${selectedWeek}.`
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(teamStats)
              .filter(([, stats]) => stats.matchups && Object.keys(stats.matchups).length > 0)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([team, stats]) => (
                <div key={team} className="bg-white border border-gray-300 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-3 text-gray-900">{team}</h3>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-600 mb-2">
                      Opponents faced {selectedWeek === 'all' ? 'across all weeks' : `in Week ${selectedWeek}`}:
                    </div>
                    {Object.entries(stats.matchups || {})
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([opponent, matchupData]) => {
                        const data = matchupData as { total: number; home: number; away: number }
                        return (
                          <div key={opponent} className="flex justify-between items-center text-sm bg-gray-50 rounded p-2">
                            <span className="font-medium text-gray-900">vs {opponent}</span>
                            <div className="text-right">
                              <div className="font-semibold text-blue-700">{data.total} games</div>
                              <div className="text-xs text-gray-600">
                                {data.home} home, {data.away} away
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">
          {selectedWeek === 'all' ? 'Games Schedule - All Weeks' : `Games Schedule - Week ${selectedWeek}`}
        </h2>
        {games.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              {selectedWeek === 'all' 
                ? 'No games found across all weeks.' 
                : `No games found for Week ${selectedWeek}.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game, index) => (
              <GameCard 
                key={index} 
                game={game} 
                teamStats={teamStats}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
