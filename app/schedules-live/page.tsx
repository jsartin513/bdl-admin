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
  TeamStatsTable,
  TeamStatsCards
} from '../components/schedule'

export default function SchedulesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({})
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState('1')

  useEffect(() => {
    const parseScheduleCSV = (csvText: string) => {
      const lines = csvText.split('\n').filter(line => line.trim())
      const parsedGames: Game[] = []
      const stats: Record<string, TeamStats> = {}
      const detectedConflicts: Conflict[] = []

      console.log(`Parsing CSV with ${lines.length} total lines`)
      console.log('First 10 lines:', lines.slice(0, 10))

      // Helper function to get initial team stats object
      const getInitialTeamStats = (): TeamStats => {
        return selectedWeek === 'all'
          ? { gamesPlayed: 0, gamesReffed: 0, homeGames: 0, awayGames: 0, matchups: {} }
          : { gamesPlayed: 0, gamesReffed: 0, homeGames: 0, awayGames: 0 }
      }

      const initializeTeamStats = (team: string) => {
        const cleanTeam = team.trim()
        if (cleanTeam && cleanTeam !== '' && cleanTeam !== 'Refs:' && !stats[cleanTeam]) {
          stats[cleanTeam] = getInitialTeamStats()
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
        
        // Track home and away games (team1 is home, team2 is away)
        if (court1Team1) {
          stats[court1Team1].gamesPlayed++
          stats[court1Team1].homeGames++ // Court 1 Team 1 is home
          teamsInGame.add(court1Team1)
        }
        if (court1Team2) {
          stats[court1Team2].gamesPlayed++
          stats[court1Team2].awayGames++ // Court 1 Team 2 is away
          teamsInGame.add(court1Team2)
        }
        if (court2Team1) {
          stats[court2Team1].gamesPlayed++
          stats[court2Team1].homeGames++ // Court 2 Team 1 is home
          teamsInGame.add(court2Team1)
        }
        if (court2Team2) {
          stats[court2Team2].gamesPlayed++
          stats[court2Team2].awayGames++ // Court 2 Team 2 is away
          teamsInGame.add(court2Team2)
        }

        recordMatchup(court1Team1, court1Team2, true)  // team1 is home
        recordMatchup(court2Team1, court2Team2, true)  // team1 is home

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

      console.log(`Parsed ${parsedGames.length} games total`)
      console.log('Game numbers found:', parsedGames.map(g => g.gameNumber))
      
      return { parsedGames, stats, detectedConflicts }
    }

    const loadScheduleData = async (retryCount = 0) => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('Loading schedule data for week', selectedWeek)
        
        const response = await fetch('/api/schedules?week=' + selectedWeek)
        const data = await response.json()
        
        if (!response.ok) {
          // Only redirect if user is completely unauthenticated
          if (response.status === 401 && data.message?.includes('Please log in')) {
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)
            return
          }
          // For session expired, try once more to allow JWT callback to refresh token
          if (response.status === 401 && retryCount === 0) {
            console.log('Session may have expired, retrying...')
            return loadScheduleData(1)
          }
          // For session expired after retry, suggest refresh
          if (response.status === 401 && data.message?.includes('Session expired')) {
            throw new Error(data.message + ' (Try refreshing the page)')
          }
          throw new Error(data.error || 'HTTP ' + response.status)
        }
        
        console.log('API Response received')
        
        // Debug logging for week inclusion
        if (selectedWeek === 'all' && data.debug) {
          console.log('All Weeks Debug Info:', data.debug)
          console.log('Available weeks:', data.availableWeeks)
          console.log('Week count:', data.weekCount)
        }
        
        // Debug raw CSV data
        if (selectedWeek === 'all') {
          console.log('Raw CSV data length:', data.csvData?.length || 0)
          console.log('CSV data preview (first 1000 chars):', data.csvData?.substring(0, 1000))
        }
        
        const { parsedGames, stats, detectedConflicts } = parseScheduleCSV(data.csvData)
        
        setGames(parsedGames)
        setTeamStats(stats)
        setConflicts(detectedConflicts)
      } catch (err) {
        const errorMessage = 'Failed to load schedule data: ' + (err instanceof Error ? err.message : 'Unknown error')
        setError(errorMessage)
        console.error('Error loading schedule data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadScheduleData()
  }, [selectedWeek])

  if (loading) return <LoadingState />
  
  if (error) return <ErrorState error={error} />

  return (
    <div className="p-6">
              <h1 className="text-3xl font-bold mb-4 text-gray-900">Dodgeball League Schedules (Live)</h1>
        <p className="text-gray-700 mb-4">Live version reading from Google Sheets - requires authentication</p>
      
      <WeekSelector 
        selectedWeek={selectedWeek}
        onWeekChange={setSelectedWeek}
        showAllWeeks={true}
      />
      
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
    </div>
  )
}
