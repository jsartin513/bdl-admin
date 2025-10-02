'use client'

import { useState, useEffect } from 'react'
import { 
  Game, 
  TeamStats, 
  Conflict,
  GameCard,
  LoadingState,
  ErrorState,
  WeekSelector,
  ConflictsAlert,
  TeamStatsCards
} from '../components/schedule'

const DEFAULT_SELECTED_WEEK = '1';

export default function SchedulesStatic() {
  const [selectedWeek, setSelectedWeek] = useState(DEFAULT_SELECTED_WEEK)
  const [games, setGames] = useState<Game[]>([])
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({})
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const parseScheduleCSV = (csvData: string) => {
      if (!csvData || csvData.trim() === '') {
        return { games: [], teamStats: {}, conflicts: [] }
      }

      const lines = csvData.split('\n').filter(line => line.trim() !== '')
      const games: Game[] = []
      const stats: { [team: string]: TeamStats } = {}
      const detectedConflicts: Conflict[] = []

      const initializeTeamStats = (team: string) => {
        const cleanTeam = team.trim()
        if (cleanTeam && cleanTeam !== '' && cleanTeam !== 'Refs:' && !stats[cleanTeam]) {
          stats[cleanTeam] = { 
            gamesPlayed: 0, 
            gamesReffed: 0,
            homeGames: 0,
            awayGames: 0,
            matchups: {}
          }
        }
        return cleanTeam
      }

      const recordMatchup = (team1: string, team2: string, team1IsHome: boolean = true) => {
        if (selectedWeek === 'all' && team1 && team2 && team1 !== team2) {
          if (stats[team1]?.matchups) {
            if (!stats[team1].matchups![team2]) {
              stats[team1].matchups![team2] = { total: 0, home: 0, away: 0 }
            }
            stats[team1].matchups![team2].total += 1
            if (team1IsHome) {
              stats[team1].matchups![team2].home += 1
            } else {
              stats[team1].matchups![team2].away += 1
            }
          }
          if (stats[team2]?.matchups) {
            if (!stats[team2].matchups![team1]) {
              stats[team2].matchups![team1] = { total: 0, home: 0, away: 0 }
            }
            stats[team2].matchups![team1].total += 1
            if (team1IsHome) {
              stats[team2].matchups![team1].away += 1
            } else {
              stats[team2].matchups![team1].home += 1
            }
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
          recordMatchup(court1Team1, court1Team2, true)  // team1 is home
          recordMatchup(court2Team1, court2Team2, true)  // team1 is home

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

      // Return stats object directly
      const teamStats: Record<string, TeamStats> = stats

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
        
        // Debug logging for week inclusion
        if (selectedWeek === 'all' && data.debug) {
          console.log('Static All Weeks Debug Info:', data.debug)
          console.log('Available weeks:', data.availableWeeks)
          console.log('Week count:', data.weekCount)
        }
        
        const { games, teamStats, conflicts } = parseScheduleCSV(data.csvData || '')
        setGames(games)
        setTeamStats(teamStats)
        setConflicts(conflicts)
      } catch (error) {
        console.error('Error fetching schedule:', error)
        setError(error instanceof Error ? error.message : 'An error occurred')
        setGames([])
        setTeamStats({})
        setConflicts([])
      } finally {
        setLoading(false)
      }
    }

    fetchSchedule()
  }, [selectedWeek])

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