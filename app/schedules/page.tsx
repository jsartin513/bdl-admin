'use client'

import { useState, useEffect } from 'react'
import { week1ScheduleCSV } from './scheduleData'

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

  useEffect(() => {
    const loadScheduleData = () => {
      try {
        console.log('About to parse CSV data...')
        console.log('CSV length:', week1ScheduleCSV.length)
        console.log('First 200 chars:', week1ScheduleCSV.substring(0, 200))
        
        const { parsedGames, stats, detectedConflicts } = parseScheduleCSV(week1ScheduleCSV)
        console.log('Results:', { parsedGames: parsedGames.length, stats: Object.keys(stats), conflicts: detectedConflicts.length })
        
        setGames(parsedGames)
        setTeamStats(stats)
        setConflicts(detectedConflicts)
      } catch (err) {
        setError(`Failed to load schedule data: ${err instanceof Error ? err.message : 'Unknown error'}`)
        console.error('Error loading schedule data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadScheduleData()
  }, [])

  const parseScheduleCSV = (csvText: string) => {
    console.log('=== PARSING STARTED ===')
    console.log('parseScheduleCSV called with text length:', csvText.length)
    const lines = csvText.split('\n').filter(line => line.trim()) // Remove empty lines
    console.log('Filtered lines:', lines.length)
    
    // Count lines that start with "Game"
    const gameLines = lines.filter(line => line.includes('Game '))
    console.log('Game lines found:', gameLines.length)
    console.log('First few game lines:', gameLines.slice(0, 3))
    
    const parsedGames: Game[] = []
    const stats: Record<string, TeamStats> = {}
    const detectedConflicts: Conflict[] = []

    // Initialize team stats
    const initializeTeamStats = (team: string) => {
      const cleanTeam = team.trim()
      console.log(`Processing team: "${team}" -> cleaned: "${cleanTeam}"`)
      if (cleanTeam && cleanTeam !== '' && cleanTeam !== 'Refs:' && !stats[cleanTeam]) {
        stats[cleanTeam] = { gamesPlayed: 0, gamesReffed: 0 }
        console.log('Initialized team:', cleanTeam)
      }
      return cleanTeam
    }

    // Start from line 1 (skip header) and process every 2 lines (game, refs, game, refs...)
    for (let i = 1; i < lines.length; i += 2) {
      const gameLine = lines[i]
      const refLine = lines[i + 1]

      console.log(`\n=== Processing line ${i} ===`)
      console.log(`Game line: "${gameLine}"`)
      console.log(`Ref line: "${refLine || 'undefined'}"`)

      if (!gameLine || !gameLine.includes('Game ')) {
        console.log('Skipping non-game line')
        continue
      }

      const gameData = gameLine.split(',')
      const refData = refLine ? refLine.split(',') : []

      console.log('Game data split (first 10):', gameData.slice(0, 10))
      console.log('Ref data split (first 10):', refData.slice(0, 10))

      const gameNumber = gameData[0]?.trim()
      
      // Court 1: columns 1, 3 for teams
      const court1Team1 = initializeTeamStats(gameData[1] || '')
      const court1Team2 = initializeTeamStats(gameData[3] || '')
      
      // Court 2: columns 6, 8 for teams  
      const court2Team1 = initializeTeamStats(gameData[6] || '')
      const court2Team2 = initializeTeamStats(gameData[8] || '')

      // Extract refs from ref line - same column positions
      const court1Ref = initializeTeamStats(refData[1]?.replace('Refs: ', '').replace('Refs:', '') || '')
      const court2Ref = initializeTeamStats(refData[6]?.replace('Refs: ', '').replace('Refs:', '') || '')

      console.log('Extracted teams:', { gameNumber, court1Team1, court1Team2, court2Team1, court2Team2, court1Ref, court2Ref })

      // Skip completely empty games
      if (!court1Team1 && !court1Team2 && !court2Team1 && !court2Team2) {
        console.log('Skipping empty game')
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

      // Track team stats and conflicts
      const teamsInGame = new Set<string>()
      
      // Add playing teams
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

      // Add reffing teams and check for conflicts
      if (court1Ref) {
        stats[court1Ref].gamesReffed++
        
        if (teamsInGame.has(court1Ref)) {
          const existingConflict = detectedConflicts.find(c => c.gameNumber === gameNumber && c.team === court1Ref)
          if (existingConflict) {
            existingConflict.conflicts.push('Playing and reffing Court 1')
          } else {
            detectedConflicts.push({
              gameNumber: gameNumber || '',
              team: court1Ref,
              conflicts: ['Playing and reffing Court 1']
            })
          }
        }
      }

      if (court2Ref) {
        stats[court2Ref].gamesReffed++
        
        if (teamsInGame.has(court2Ref)) {
          const existingConflict = detectedConflicts.find(c => c.gameNumber === gameNumber && c.team === court2Ref)
          if (existingConflict) {
            existingConflict.conflicts.push('Playing and reffing Court 2')
          } else {
            detectedConflicts.push({
              gameNumber: gameNumber || '',
              team: court2Ref,
              conflicts: ['Playing and reffing Court 2']
            })
          }
        }
      }

      // Check if same team is reffing both courts
      if (court1Ref && court2Ref && court1Ref === court2Ref) {
        const existingConflict = detectedConflicts.find(c => c.gameNumber === gameNumber && c.team === court1Ref)
        if (existingConflict) {
          existingConflict.conflicts.push('Reffing both courts')
        } else {
          detectedConflicts.push({
            gameNumber: gameNumber || '',
            team: court1Ref,
            conflicts: ['Reffing both courts']
          })
        }
      }
    }

    return { parsedGames, stats, detectedConflicts }
  }

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
        <p className="text-red-600 text-sm mt-2">Check the browser console for more details.</p>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">League Schedules</h1>
      
      {/* Debug Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">Debug Information</h3>
        <div className="text-sm text-blue-700 grid grid-cols-1 md:grid-cols-2 gap-2">
          <p>CSV Length: {week1ScheduleCSV.length} chars</p>
          <p>Games Found: {games.length}</p>
          <p>Teams Found: {Object.keys(teamStats).length}</p>
          <p>Conflicts: {conflicts.length}</p>
          <p>Loading: {loading.toString()}</p>
          <p>Error: {error || 'None'}</p>
        </div>
        <div className="mt-2">
          <p className="text-xs text-blue-600">CSV Preview:</p>
          <pre className="text-xs bg-blue-100 p-2 rounded overflow-auto max-h-20">
            {week1ScheduleCSV.substring(0, 200)}...
          </pre>
        </div>
      </div>
      
      {/* Conflicts Section */}
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

      {/* Team Stats Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Team Statistics</h2>
        {Object.keys(teamStats).length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">No team statistics available. Check if the CSV file is loading correctly.</p>
            <div className="mt-2 text-sm text-gray-600">
              <p>Debug info:</p>
              <p>CSV data length: {week1ScheduleCSV.length}</p>
              <p>CSV preview: {week1ScheduleCSV.substring(0, 100)}...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300 rounded-lg shadow-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold border-b text-gray-800">Team</th>
                  <th className="px-4 py-3 text-center font-semibold border-b text-gray-800">Games Played</th>
                  <th className="px-4 py-3 text-center font-semibold border-b text-gray-800">Games Reffed</th>
                  <th className="px-4 py-3 text-center font-semibold border-b text-gray-800">Total Commitments</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(teamStats)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([team, stats]) => (
                    <tr key={team} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border-b font-medium text-gray-900">{team}</td>
                      <td className="px-4 py-3 border-b text-center text-gray-800">{stats.gamesPlayed}</td>
                      <td className="px-4 py-3 border-b text-center text-gray-800">{stats.gamesReffed}</td>
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

      {/* Games Schedule Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Games Schedule - Week 1</h2>
        <div className="space-y-4">
          {games.map((game, index) => (
            <div key={index} className="bg-white border border-gray-300 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-3">{game.gameNumber}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded p-3">
                  <h4 className="font-semibold mb-2">Court 1</h4>
                  {game.court1Team1 || game.court1Team2 ? (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{game.court1Team1 || 'BYE'}</span>
                        <span className="text-gray-500">vs</span>
                        <span className="font-medium">{game.court1Team2 || 'BYE'}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Ref: {game.court1Ref || 'TBD'}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-400">No game scheduled</div>
                  )}
                </div>
                <div className="border border-gray-200 rounded p-3">
                  <h4 className="font-semibold mb-2">Court 2</h4>
                  {game.court2Team1 || game.court2Team2 ? (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{game.court2Team1 || 'BYE'}</span>
                        <span className="text-gray-500">vs</span>
                        <span className="font-medium">{game.court2Team2 || 'BYE'}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Ref: {game.court2Ref || 'TBD'}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-400">No game scheduled</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
