'use client'

import { useState } from 'react'
import {
  GameCard,
  LoadingState,
  ErrorState,
  WeekSelector,
  ConflictsAlert,
  TeamStatsCards,
} from '../components/schedule'
import { useScheduleData } from '../components/schedule/useScheduleData'

const DEFAULT_SELECTED_WEEK = 'all'

export default function SchedulesStatic() {
  const [selectedWeek, setSelectedWeek] = useState(DEFAULT_SELECTED_WEEK)

  const { games, teamStats, conflicts, loading, error } = useScheduleData({
    apiEndpoint: '/api/schedules-static',
    selectedWeek,
    parseOptions: {
      includeHomeAway: true,
      includeMatchups: true,
      detectCourtConflicts: false,
    },
  })

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">Dodgeball League Schedules (Static)</h1>
        <p className="text-gray-700 mb-4">Static version using local XLSX file - no authentication required</p>
        
        <WeekSelector 
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
          showAllWeeks={true}
        />
        
        {loading && <LoadingState />}
        
        {error && <ErrorState error={error} />}
      </div>

      {!loading && !error && (
        <>
          <TeamStatsCards 
            teamStats={Object.entries(teamStats).map(([teamName, stats]) => ({ team: teamName, ...stats, matchups: stats.matchups || {} }))}
            selectedWeek={selectedWeek}
          />

          <ConflictsAlert conflicts={conflicts} />

          {selectedWeek !== 'all' && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                Games Schedule - Week {selectedWeek}
              </h2>
              <div className="space-y-4">
                {games.map((game, index) => (
                  <GameCard 
                    key={index} 
                    game={game} 
                    teamStats={teamStats}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}