'use client'

import { useState, useEffect } from 'react'

interface Game {
  gameNumber: string
  court1Team1: string
  court1Team2: string
  court1Ref: string
  court2Team1: string
  court2Team2: string
  court2Ref: string
}

interface TeamStats {
  gamesPlayed: number
  gamesReffed: number
  matchups?: Record<string, number>
}

interface Conflict {
  gameNumber: string
  team: string
  conflicts: string[]
}

export default function SchedulesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({})
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState('all')

  useEffect(() => {
    const parseScheduleCSV = (csvText: string) => {
      const lines = csvText.split('\n').filter(line => line.trim())
      const parsedGames: Game[] = []
      const stats: Record<string, TeamStats> = {}
      const detectedConflicts: Conflict[] = []

      const initializeTeamStats = (team: string) => {
        const cleanTeam = team.trim()
        if (cleanTeam && cleanTeam !== '' && cleanTeam !== 'Refs:' && !stats[cleanTeam]) {
          stats[cleanTeam] = { 
            gamesPlayed: 0, 
            gamesReffed: 0,
            ...(selectedWeek === 'all' ? { matchups: {} } : {})
          }
        }
        return cleanTeam
      }

      const recordMatchup = (team1: string, team2: string) => {
        if (selectedWeek === 'all' && team1 && team2 && team1 !== team2) {
          if (stats[team1]?.matchups) {
            stats[team1].matchups![team2] = (stats[team1].matchups![team2] || 0) + 1
          }
          if (stats[team2]?.matchups) {
            stats[team2].matchups![team1] = (stats[team2].matchups![team1] || 0) + 1
          }
        }
      }

      for (let i = 1; i < lines.length; i += 2) {
        const gameLine = lines[i]
        const refLine = lines[i + 1]

        if (!gameLine || !gameLine.includes('Game ')) {
          continue
        }

        const gameData = gameLine.split(',')
        const refData = refLine ? refLine.split(',') : []

        const gameNumber = gameData[0]?.trim()
        
        const court1Team1 = initializeTeamStats(gameData[1] || '')
        const court1Team2 = initializeTeamStats(gameData[3] || '')
        const court2Team1 = initializeTeamStats(gameData[6] || '')
        const court2Team2 = initializeTeamStats(gameData[8] || '')

        const court1Ref = initializeTeamStats(refData[1]?.replace(/Refs:\s*/g, '') || '')
        const court2Ref = initializeTeamStats(refData[6]?.replace(/Refs:\s*/g, '') || '')

        if (!court1Team1 && !court1Team2 && !court2Team1 && !court2Team2) {
          continue
        }

        const game: Game = {
          gameNumber: gameNumber || '',
          court1Team1,
          court1Team2,
          court1Ref,
          court2Team1,
          court2Team2,
          court2Ref
        }

        parsedGames.push(game)

        const teamsInGame = new Set<string>()
        
        if (court1Team1) {
          stats[court1Team1].gamesPlayed++
          teamsInGame.add(court1Team1)
        }
        if (court1Team2) {
          stats[court1Team2].gamesPlayed++
          teamsInGame.add(court1Team2)
        }
        if (court2Team1) {
          stats[court2Team1].gamesPlayed++
          teamsInGame.add(court2Team1)
        }
        if (court2Team2) {
          stats[court2Team2].gamesPlayed++
          teamsInGame.add(court2Team2)
        }

        recordMatchup(court1Team1, court1Team2)
        recordMatchup(court2Team1, court2Team2)

        if (court1Ref) {
          stats[court1Ref].gamesReffed++
          
          if (teamsInGame.has(court1Ref)) {
            detectedConflicts.push({
              gameNumber: gameNumber || '',
              team: court1Ref,
              conflicts: ['Playing and reffing Court 1']
            })
          }
        }

        if (court2Ref) {
          stats[court2Ref].gamesReffed++
          
          if (teamsInGame.has(court2Ref)) {
            detectedConflicts.push({
              gameNumber: gameNumber || '',
              team: court2Ref,
              conflicts: ['Playing and reffing Court 2']
            })
          }
        }
      }

      return { parsedGames, stats, detectedConflicts }
    }

    const loadScheduleData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('Loading schedule data for week', selectedWeek)
        
        const response = await fetch('/api/schedules?week=' + selectedWeek)
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'HTTP ' + response.status)
        }
        
        console.log('API Response received')
        
        const { parsedGames, stats, detectedConflicts } = parseScheduleCSV(data.csvData)
        
        setGames(parsedGames)
        setTeamStats(stats)
        setConflicts(detectedConflicts)
      } catch (err) {
        const errorMessage = `Failed to load schedule data: ${err instanceof Error ? err.message : 'Unknown error'}`
        setError(errorMessage)
        console.error('Error loading schedule data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadScheduleData()
  }, [selectedWeek])

  if (loading) return (
    <div className="p-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800">Loading schedule data...</p>
      </div>
    </div>
  )
  
  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-semibold">Error: {error}</p>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">League Schedules</h1>
      
      <div className="mb-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <label htmlFor="week-select" className="font-semibold text-gray-900">
              Select Week:
            </label>
            <select
              id="week-select"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Weeks (Totals)</option>
              <option value="1">Week 1 (9/30)</option>
              <option value="2">Week 2</option>
              <option value="3">Week 3</option>
              <option value="4">Week 4</option>
              <option value="5">Week 5</option>
              <option value="6">Week 6</option>
            </select>
          </div>
        </div>
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
      
      {conflicts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-red-600">⚠️ Schedule Conflicts</h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            {conflicts.map((conflict, index) => (
              <div key={index} className="mb-2">
                <span className="font-semibold">{conflict.gameNumber}</span> - 
                <span className="font-medium text-red-700"> {conflict.team}</span>: 
                <span className="text-red-600"> {conflict.conflicts.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">
          {selectedWeek === 'all' ? 'Schedule by Team - All Weeks Combined' : 'Schedule by Team'}
        </h2>
        {Object.keys(teamStats).length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              {selectedWeek === 'all' ? 'No team data available across all weeks.' : 'No team data available.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.keys(teamStats)
              .sort((a, b) => a.localeCompare(b))
              .map((team) => (
                <div key={team} className="bg-white border border-gray-300 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-3 text-gray-900">{team}</h3>
                  
                  {selectedWeek === 'all' && teamStats[team].matchups ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        Total: {teamStats[team].gamesPlayed} games played, {teamStats[team].gamesReffed} games reffed
                      </div>
                      <div className="text-sm text-gray-700 mb-2 font-medium">Games vs. other teams:</div>
                      {Object.entries(teamStats[team].matchups || {})
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([opponent, gameCount]) => (
                          <div key={opponent} className="flex justify-between text-sm">
                            <span className="text-gray-900">vs {opponent}</span>
                            <span className="font-medium text-blue-700">{gameCount} games</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {games.map((game, index) => {
                        const activities: string[] = []
                        
                        if (game.court1Team1 === team || game.court1Team2 === team) {
                          activities.push('Playing Court 1')
                        }
                        if (game.court2Team1 === team || game.court2Team2 === team) {
                          activities.push('Playing Court 2')
                        }
                        
                        if (game.court1Ref === team) {
                          activities.push('Reffing Court 1')
                        }
                        if (game.court2Ref === team) {
                          activities.push('Reffing Court 2')
                        }
                        
                        if (activities.length === 0) {
                          activities.push('Off')
                        }
                        
                        return (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-900">{game.gameNumber}</span>
                            <div className="text-right">
                              {activities.map((activity, actIndex) => (
                                <div key={actIndex} className={
                                  activity === 'Off' 
                                    ? 'text-gray-600 italic'
                                    : activity.startsWith('Playing') 
                                      ? 'text-blue-700 font-medium'
                                      : 'text-green-700 font-medium'
                                }>
                                  {activity}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">
          {selectedWeek === 'all' ? 'Team Statistics - All Weeks Combined' : 'Team Statistics'}
        </h2>
        {Object.keys(teamStats).length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              {selectedWeek === 'all' 
                ? 'No team statistics available across all weeks.' 
                : `No team statistics available for Week ${selectedWeek}.`
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300 rounded-lg shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold border-b text-gray-900">Team</th>
                  <th className="px-4 py-3 text-center font-semibold border-b text-gray-900">Games Played</th>
                  <th className="px-4 py-3 text-center font-semibold border-b text-gray-900">Games Reffed</th>
                  <th className="px-4 py-3 text-center font-semibold border-b text-gray-900">Total Commitments</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(teamStats)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([team, stats]) => (
                    <tr key={team} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border-b font-medium text-gray-900">{team}</td>
                      <td className="px-4 py-3 border-b text-center text-gray-900">{stats.gamesPlayed}</td>
                      <td className="px-4 py-3 border-b text-center text-gray-900">{stats.gamesReffed}</td>
                      <td className="px-4 py-3 border-b text-center font-semibold text-gray-900">
                        {stats.gamesPlayed + stats.gamesReffed}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedWeek !== 'all' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">
            Games Schedule - Week {selectedWeek}
          </h2>
          <div className="space-y-4">
            {games.map((game, index) => (
              <div key={index} className="bg-white border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-xl mb-3 text-gray-900">{game.gameNumber}</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border border-gray-300 rounded p-3 bg-gray-50">
                    <h4 className="font-bold mb-2 text-gray-900">Court 1</h4>
                    {game.court1Team1 || game.court1Team2 ? (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-900">{game.court1Team1 || 'BYE'}</span>
                          <span className="text-gray-800 font-bold">vs</span>
                          <span className="font-semibold text-gray-900">{game.court1Team2 || 'BYE'}</span>
                        </div>
                        <div className="text-sm text-gray-900 font-medium">
                          Ref: {game.court1Ref || 'TBD'}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-600 italic">No game scheduled</div>
                    )}
                  </div>
                  <div className="border border-gray-300 rounded p-3 bg-gray-50">
                    <h4 className="font-bold mb-2 text-gray-900">Court 2</h4>
                    {game.court2Team1 || game.court2Team2 ? (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-900">{game.court2Team1 || 'BYE'}</span>
                          <span className="text-gray-800 font-bold">vs</span>
                          <span className="font-semibold text-gray-900">{game.court2Team2 || 'BYE'}</span>
                        </div>
                        <div className="text-sm text-gray-900 font-medium">
                          Ref: {game.court2Ref || 'TBD'}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-600 italic">No game scheduled</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
