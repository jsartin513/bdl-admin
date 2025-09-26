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
  team: string
  gamesPlayed: number
  gamesReffed: number
  homeGames: number
  awayGames: number
  matchups: { [opponent: string]: number }
}

interface Conflict {
  gameNumber: string
  team: string
  conflicts: string[]
}

const DEFAULT_SELECTED_WEEK = '1';

export default function SchedulesStatic() {
  const [selectedWeek, setSelectedWeek] = useState(DEFAULT_SELECTED_WEEK)
  const [games, setGames] = useState<Game[]>([])
  const [teamStats, setTeamStats] = useState<TeamStats[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const parseScheduleCSV = (csvData: string) => {
      if (!csvData || csvData.trim() === '') {
        return { games: [], teamStats: [], conflicts: [] }
      }

      const lines = csvData.split('\n').filter(line => line.trim() !== '')
      const games: Game[] = []
      const stats: { [team: string]: TeamStats } = {}
      const detectedConflicts: Conflict[] = []

      const initializeTeamStats = (team: string) => {
        const cleanTeam = team.trim()
        if (cleanTeam && cleanTeam !== '' && cleanTeam !== 'Refs:' && !stats[cleanTeam]) {
          stats[cleanTeam] = { 
            team: cleanTeam,
            gamesPlayed: 0, 
            gamesReffed: 0,
            homeGames: 0,
            awayGames: 0,
            matchups: {}
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

        if (gameNumber) {
          const teamsInGame = new Set<string>()
          
          // Count games played and track home/away games (team1 is home, team2 is away)
          if (court1Team1 && court1Team1 !== 'BYE') {
            if (stats[court1Team1]) {
              stats[court1Team1].gamesPlayed++
              stats[court1Team1].homeGames++ // Court 1 Team 1 is home
              teamsInGame.add(court1Team1)
            }
          }
          if (court1Team2 && court1Team2 !== 'BYE') {
            if (stats[court1Team2]) {
              stats[court1Team2].gamesPlayed++
              stats[court1Team2].awayGames++ // Court 1 Team 2 is away
              teamsInGame.add(court1Team2)
            }
          }
          if (court2Team1 && court2Team1 !== 'BYE') {
            if (stats[court2Team1]) {
              stats[court2Team1].gamesPlayed++
              stats[court2Team1].homeGames++ // Court 2 Team 1 is home
              teamsInGame.add(court2Team1)
            }
          }
          if (court2Team2 && court2Team2 !== 'BYE') {
            if (stats[court2Team2]) {
              stats[court2Team2].gamesPlayed++
              stats[court2Team2].awayGames++ // Court 2 Team 2 is away
              teamsInGame.add(court2Team2)
            }
          }

          games.push({
            gameNumber,
            court1Team1,
            court1Team2,
            court2Team1,
            court2Team2,
            court1Ref,
            court2Ref
          })

          // Record matchups for "all weeks" view
          recordMatchup(court1Team1, court1Team2)
          recordMatchup(court2Team1, court2Team2)

          // Count games reffed and check for conflicts
          if (court1Ref && court1Ref !== 'TBD') {
            if (stats[court1Ref]) {
              stats[court1Ref].gamesReffed++
              
              // Check if referee is also playing in this game
              if (teamsInGame.has(court1Ref)) {
                detectedConflicts.push({
                  gameNumber,
                  team: court1Ref,
                  conflicts: ['Playing and reffing Court 1']
                })
              }
            }
          }
          
          if (court2Ref && court2Ref !== 'TBD') {
            if (stats[court2Ref]) {
              stats[court2Ref].gamesReffed++
              
              // Check if referee is also playing in this game
              if (teamsInGame.has(court2Ref)) {
                detectedConflicts.push({
                  gameNumber,
                  team: court2Ref,
                  conflicts: ['Playing and reffing Court 2']
                })
              }
            }
          }
        }
      }

      // Convert stats object to array and sort
      const teamStats: TeamStats[] = Object.values(stats).sort((a, b) => a.team.localeCompare(b.team))

      return { games, teamStats, conflicts: detectedConflicts }
    }

    const fetchSchedule = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/schedules-static?week=${selectedWeek}`)
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch schedule')
        }
        
        const { games, teamStats, conflicts } = parseScheduleCSV(data.csvData || '')
        setGames(games)
        setTeamStats(teamStats)
        setConflicts(conflicts)
      } catch (error) {
        console.error('Error fetching schedule:', error)
        setError(error instanceof Error ? error.message : 'An error occurred')
        setGames([])
        setTeamStats([])
        setConflicts([])
      } finally {
        setLoading(false)
      }
    }

    fetchSchedule()
  }, [selectedWeek])

  const weekOptions = ['1', '2', '3', '4', '5', '6', 'all']

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">Dodgeball League Schedules (Static)</h1>
        <p className="text-gray-700 mb-4">Static version using local XLSX file - no authentication required</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <label className="text-gray-900 font-semibold mr-2">Select Week:</label>
          {weekOptions.map(week => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedWeek === week
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {week === 'all' ? 'All Weeks (Totals)' : `Week ${week}`}
            </button>
          ))}
        </div>
        
        {loading && (
          <div className="text-blue-600 font-medium">Loading schedule data...</div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded mb-4">
            Error: {error}
          </div>
        )}
      </div>

      {!loading && !error && (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">
              {selectedWeek === 'all' ? 'Schedule by Team - All Weeks Totals' : 'Schedule by Team - Week ' + selectedWeek}
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {teamStats.map(stat => (
                <div key={stat.team} className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
                  <h3 className="font-bold text-lg mb-3 text-gray-900">{stat.team}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-800">Games Played:</span>
                      <span className="font-semibold text-gray-900">{stat.gamesPlayed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-800">Home Games:</span>
                      <span className="font-semibold text-blue-600">{stat.homeGames}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-800">Away Games:</span>
                      <span className="font-semibold text-purple-600">{stat.awayGames}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-800">Games Reffed:</span>
                      <span className="font-semibold text-green-600">{stat.gamesReffed}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2">
                      <span className="text-gray-800 font-medium">Total Activities:</span>
                      <span className={`font-bold ${(stat.gamesPlayed + stat.gamesReffed) > 2 ? 'text-red-600' : 'text-black'}`}>
                        {stat.gamesPlayed + stat.gamesReffed}
                      </span>
                    </div>
                    
                    {selectedWeek === 'all' && Object.keys(stat.matchups).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-800 mb-2">Head-to-Head:</h4>
                        <div className="space-y-1">
                          {Object.entries(stat.matchups)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([opponent, count]) => (
                              <div key={opponent} className="flex justify-between text-sm">
                                <span className="text-gray-700">vs {opponent}:</span>
                                <span className="font-medium text-gray-900">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-red-600">⚠️ Schedule Conflicts</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-bold text-red-800">{conflict.team}</h3>
                    <p className="text-red-700 mb-2">Game: {conflict.gameNumber}</p>
                    <div className="text-sm text-red-600">
                      {conflict.conflicts.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedWeek !== 'all' && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                Games Schedule - Week {selectedWeek}
              </h2>
              <div className="space-y-4">
                {games.map((game, index) => (
                  <div key={index} className="bg-white border border-gray-300 rounded-lg p-4">
                    <h3 className="font-bold text-xl mb-3 text-gray-900">{game.gameNumber}</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="border border-gray-300 rounded p-3 bg-gray-50">
                        <h4 className="font-bold mb-2 text-gray-900">Court 1</h4>
                        {game.court1Team1 || game.court1Team2 ? (
                          <>
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-center">
                                <span className="font-semibold text-gray-900">{game.court1Team1 || 'BYE'}</span>
                                <div className="text-xs text-blue-600 font-medium">HOME</div>
                              </div>
                              <span className="text-gray-800 font-bold">vs</span>
                              <div className="text-center">
                                <span className="font-semibold text-gray-900">{game.court1Team2 || 'BYE'}</span>
                                <div className="text-xs text-purple-600 font-medium">AWAY</div>
                              </div>
                            </div>
                            <div className="text-sm text-green-600 font-medium">
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
                              <div className="text-center">
                                <span className="font-semibold text-gray-900">{game.court2Team1 || 'BYE'}</span>
                                <div className="text-xs text-blue-600 font-medium">HOME</div>
                              </div>
                              <span className="text-gray-800 font-bold">vs</span>
                              <div className="text-center">
                                <span className="font-semibold text-gray-900">{game.court2Team2 || 'BYE'}</span>
                                <div className="text-xs text-purple-600 font-medium">AWAY</div>
                              </div>
                            </div>
                            <div className="text-sm text-green-600 font-medium">
                              Ref: {game.court2Ref || 'TBD'}
                            </div>
                          </>
                        ) : (
                          <div className="text-gray-600 italic">No game scheduled</div>
                        )}
                      </div>
                      <div className="border border-gray-300 rounded p-3 bg-gray-50">
                        <h4 className="font-bold mb-2 text-gray-900">Teams Off</h4>
                        <div className="text-sm text-gray-700">
                          {(() => {
                            const playingTeams = new Set([
                              game.court1Team1, game.court1Team2, 
                              game.court2Team1, game.court2Team2,
                              game.court1Ref, game.court2Ref
                            ].filter(team => team && team !== 'BYE' && team !== 'TBD'))
                            
                            const allTeams = teamStats.map(stat => stat.team).sort()
                            const offTeams = allTeams.filter(team => !playingTeams.has(team))
                            
                            return offTeams.length > 0 
                              ? offTeams.map(team => (
                                  <div key={team} className="text-black font-medium text-xs mb-1">{team}</div>
                                ))
                              : <div className="text-gray-500 italic text-xs">All teams active</div>
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}