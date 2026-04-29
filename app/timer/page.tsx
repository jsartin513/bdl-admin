'use client'

import { useState, useEffect, useCallback } from 'react';
import { TimerComponent } from '../components/timer';
import { GameInfo, NextGameInfo } from '../components/timer/types';
import { Game } from '../components/schedule/types';
import { splitCsvLine } from '../lib/scheduleParser';
import Link from 'next/link';

interface DriveFile {
  id: string
  name: string
}

const WEEK_OPTIONS = ['1', '2', '3', '4', '5', '6']

export default function TimerPage() {
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheets, setSheets] = useState<DriveFile[]>([])
  const [selectedSheetId, setSelectedSheetId] = useState('')
  const [selectedWeek, setSelectedWeek] = useState('1')
  const [loadingSheets, setLoadingSheets] = useState(true)

  useEffect(() => {
    fetch('/api/drive-folder')
      .then((res) => res.json())
      .then((data: DriveFile[]) => {
        setSheets(data)
        if (data.length > 0) setSelectedSheetId(data[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingSheets(false))
  }, [])

  const convertToGameInfo = useCallback((game: Game, weekNum: string): GameInfo => ({
    gameNumber: game.gameNumber,
    court1Team1: game.court1Team1,
    court1Team2: game.court1Team2,
    court2Team1: game.court2Team1,
    court2Team2: game.court2Team2,
    court1Ref: game.court1Ref,
    court2Ref: game.court2Ref,
    week: parseInt(weekNum, 10) || 1,
  }), [])

  const fetchGames = useCallback(async () => {
    if (!selectedSheetId) return
    setLoading(true)
    setError(null)
    setCurrentGameIndex(0)
    try {
      const res = await fetch(
        `/api/schedules-live?sheetId=${selectedSheetId}&week=${selectedWeek}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch schedule')

      const csvData: string = data.csvData || ''
      const lines = csvData.split('\n').filter((l: string) => l.trim() !== '')
      const gameList: Game[] = []

      for (let i = 1; i < lines.length; i += 2) {
        const gameLine = lines[i]
        const refLine = lines[i + 1]
        if (!gameLine?.includes('Game ')) continue

        const gameData = splitCsvLine(gameLine)
        const refData = refLine ? splitCsvLine(refLine) : []

        const game: Game = {
          gameNumber: gameData[0]?.trim() || '',
          court1Team1: gameData[1]?.trim() || '',
          court1Team2: gameData[3]?.trim() || '',
          court1Ref: refData[1]?.replace(/Refs:\s*/g, '')?.trim() || '',
          court2Team1: gameData[6]?.trim() || '',
          court2Team2: gameData[8]?.trim() || '',
          court2Ref: refData[6]?.replace(/Refs:\s*/g, '')?.trim() || '',
        }
        if (game.gameNumber) gameList.push(game)
      }

      setGames(gameList.map((g) => convertToGameInfo(g, selectedWeek)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games')
    } finally {
      setLoading(false)
    }
  }, [selectedSheetId, selectedWeek, convertToGameInfo])

  useEffect(() => {
    if (selectedSheetId) fetchGames()
  }, [fetchGames, selectedSheetId])

  const currentGame = games[currentGameIndex]
  const nextGame: NextGameInfo | undefined = games[currentGameIndex + 1]
    ? { ...games[currentGameIndex + 1], timeUntilStart: 300 }
    : undefined

  const goToGame = (index: number) => {
    if (index >= 0 && index < games.length) setCurrentGameIndex(index)
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dodgeball League Timer</h1>
            </div>
            <Link
              href="/schedules"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Schedule
            </Link>
          </div>

          {/* League + Week selectors */}
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">League</label>
              {loadingSheets ? (
                <span className="text-sm text-gray-500">Loading…</span>
              ) : (
                <select
                  value={selectedSheetId}
                  onChange={(e) => setSelectedSheetId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md min-w-[200px]"
                >
                  {sheets.length === 0 && <option value="">No leagues found</option>}
                  {sheets.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                {WEEK_OPTIONS.map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchGames}
              disabled={loading || !selectedSheetId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load Games'}
            </button>
          </div>

          {/* Quick jump */}
          {games.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <label className="font-medium text-gray-700">Quick Jump:</label>
                <select
                  value={currentGameIndex}
                  onChange={(e) => goToGame(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  {games.map((game, index) => (
                    <option key={index} value={index}>{game.gameNumber}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading games…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchGames}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && games.length === 0 && selectedSheetId && (
          <p className="text-gray-500 text-center py-8">No games found for this week.</p>
        )}

        {!loading && currentGame && (
          <TimerComponent
            currentGame={currentGame}
            nextGame={nextGame}
            onTimerComplete={() => {}}
            onTimerStart={() => {}}
            onNextGame={currentGameIndex < games.length - 1 ? () => goToGame(currentGameIndex + 1) : undefined}
            onPreviousGame={currentGameIndex > 0 ? () => goToGame(currentGameIndex - 1) : undefined}
            canGoNext={currentGameIndex < games.length - 1}
            canGoPrevious={currentGameIndex > 0}
            currentGameIndex={currentGameIndex}
            totalGames={games.length}
            className="mb-6"
          />
        )}

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-bold text-blue-900 mb-4">Timer Instructions</h2>
          <div className="grid md:grid-cols-2 gap-6 text-blue-800">
            <div>
              <h3 className="font-semibold mb-2">Round Sequence:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Team names announced before each round</li>
                <li>• &ldquo;Side ready, side ready, dodgeball!&rdquo; announces round start</li>
                <li>• Time warnings at 2 min, 90s, 1 min, 30s, 20s until no blocking</li>
                <li>• &ldquo;No blocking in 10, 9, 8...&rdquo; countdown to end</li>
                <li>• Buzzer sounds at round completion</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Audio Features:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Start external music before beginning timer</li>
                <li>• Timer takes audio focus during announcements</li>
                <li>• Manually adjust music volume for best experience</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
