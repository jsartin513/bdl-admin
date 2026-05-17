'use client'

import { useState, useEffect, useRef } from 'react'
import {
  type Schedule,
  SCHEDULE_2TEAM,
  SCHEDULE_3TEAM,
  SCHEDULE_4TEAM_SHORT,
  SCHEDULE_4TEAM_LONG,
  SCHEDULE_5TEAM_SHORT,
  SCHEDULE_5TEAM_LONG,
  SCHEDULE_6TEAM_WAVES,
  SCHEDULE_6TEAM_BY_SECTION,
} from './schedule-data'

// ── All available schedules ────────────────────────────────────────────────

const ALL_SCHEDULES: Schedule[] = [
  SCHEDULE_2TEAM,
  SCHEDULE_3TEAM,
  SCHEDULE_4TEAM_SHORT,
  SCHEDULE_4TEAM_LONG,
  SCHEDULE_5TEAM_SHORT,
  SCHEDULE_5TEAM_LONG,
  SCHEDULE_6TEAM_WAVES,
  SCHEDULE_6TEAM_BY_SECTION,
]

// ── Flatten schedule into a game list ─────────────────────────────────────

interface FlatGame {
  overall: number
  sectionLabel: string
  round: string
  home: string
  away: string
}

function flattenSchedule(schedule: Schedule): FlatGame[] {
  let overall = 1
  const games: FlatGame[] = []
  for (const section of schedule.sections) {
    for (const game of section.games) {
      games.push({
        overall: overall++,
        sectionLabel: section.label,
        round: game.round,
        home: game.home,
        away: game.away,
      })
    }
  }
  return games
}

// ── Persistence ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'open-gym-tracker-v1'

interface TrackerState {
  scheduleKey: string
  currentIdx: number
  results: Array<{ homeScore: string; awayScore: string }>
}

function loadState(): TrackerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TrackerState) : null
  } catch {
    return null
  }
}

function saveState(state: TrackerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage errors (private browsing, quota)
  }
}

function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// ── Schedule picker ────────────────────────────────────────────────────────

function SchedulePicker({ onSelect }: { onSelect: (key: string) => void }) {
  const groups = [
    { label: '2-Team', schedules: [SCHEDULE_2TEAM] },
    { label: '3-Team', schedules: [SCHEDULE_3TEAM] },
    { label: '4-Team', schedules: [SCHEDULE_4TEAM_SHORT, SCHEDULE_4TEAM_LONG] },
    { label: '5-Team', schedules: [SCHEDULE_5TEAM_SHORT, SCHEDULE_5TEAM_LONG] },
    { label: '6-Team', schedules: [SCHEDULE_6TEAM_WAVES, SCHEDULE_6TEAM_BY_SECTION] },
  ]

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Pick tonight&apos;s schedule</h2>
      <p className="text-gray-500 mb-8">
        Choose the rotation you&apos;re running. Scores will be saved automatically.
      </p>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-3">
              {group.schedules.map((s) => {
                const games = flattenSchedule(s)
                const sublabel = s.label.replace(/^\d+-Team — ?/, '')
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onSelect(s.key)}
                    className="flex-1 min-w-[140px] text-left border-2 border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-semibold text-gray-900">
                      {sublabel || group.label}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">{games.length} games</div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Score entry for the current game ──────────────────────────────────────

function ScoreEntry({
  game,
  total,
  homeScore,
  awayScore,
  onHomeScore,
  onAwayScore,
  onNext,
  onPrev,
  isLast,
  canGoBack,
}: {
  game: FlatGame
  total: number
  homeScore: string
  awayScore: string
  onHomeScore: (v: string) => void
  onAwayScore: (v: string) => void
  onNext: () => void
  onPrev: () => void
  isLast: boolean
  canGoBack: boolean
}) {
  const awayRef = useRef<HTMLInputElement>(null)
  const homeRef = useRef<HTMLInputElement>(null)

  const homeNum = parseInt(homeScore, 10)
  const awayNum = parseInt(awayScore, 10)
  const scoresValid =
    homeScore !== '' && awayScore !== '' && !isNaN(homeNum) && !isNaN(awayNum)

  const winner =
    scoresValid ? (homeNum > awayNum ? game.home : homeNum < awayNum ? game.away : 'Tie') : null

  return (
    <div className="flex flex-col items-center gap-6 py-6 px-4">
      {/* Progress */}
      <div className="w-full max-w-md">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>{game.sectionLabel} · {game.round}</span>
          <span>Game {game.overall} of {total}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((game.overall - 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Matchup card */}
      <div className="w-full max-w-md bg-white border-2 border-blue-200 rounded-2xl p-6 shadow-sm">
        <div className="text-center text-xs text-blue-600 font-semibold uppercase tracking-wider mb-4">
          Now Playing
        </div>

        <div className="flex items-center gap-4">
          {/* Home team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="text-lg font-bold text-gray-900">{game.home}</div>
            <div className="text-xs text-gray-400 font-medium">HOME</div>
            <input
              ref={homeRef}
              id="home-score"
              type="number"
              inputMode="numeric"
              min={0}
              value={homeScore}
              onChange={(e) => onHomeScore(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && awayRef.current?.focus()}
              placeholder="—"
              className="w-24 h-16 text-3xl font-bold text-center border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="text-2xl font-light text-gray-300 pb-4">vs</div>

          {/* Away team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="text-lg font-bold text-gray-900">{game.away}</div>
            <div className="text-xs text-gray-400 font-medium">AWAY</div>
            <input
              ref={awayRef}
              id="away-score"
              type="number"
              inputMode="numeric"
              min={0}
              value={awayScore}
              onChange={(e) => onAwayScore(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && scoresValid && onNext()}
              placeholder="—"
              className="w-24 h-16 text-3xl font-bold text-center border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Winner hint */}
        <div className="mt-4 h-7 text-center">
          {winner && (
            <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">
              {winner === 'Tie' ? 'Tie game' : `${winner} wins`}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-md flex gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoBack}
          className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium disabled:opacity-30 hover:bg-gray-50 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className={`flex-1 py-3 rounded-xl font-semibold text-white transition-colors ${
            scoresValid
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isLast ? 'Finish' : scoresValid ? 'Next Game →' : 'Enter scores to continue'}
        </button>
      </div>
    </div>
  )
}

// ── Completed games scoreboard ─────────────────────────────────────────────

function Scoreboard({
  games,
  results,
  currentIdx,
  onJump,
}: {
  games: FlatGame[]
  results: Array<{ homeScore: string; awayScore: string }>
  currentIdx: number
  onJump: (idx: number) => void
}) {
  const played = games.slice(0, currentIdx).filter((_, i) => {
    const r = results[i]
    return r && r.homeScore !== '' && r.awayScore !== ''
  })

  if (played.length === 0) return null

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Completed games
      </div>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 font-medium w-10">#</th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">Matchup</th>
              <th className="px-3 py-2 text-center text-gray-500 font-medium w-16">Score</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game, idx) => {
              const result = results[idx]
              if (!result || result.homeScore === '' || result.awayScore === '') return null
              const hNum = parseInt(result.homeScore, 10)
              const aNum = parseInt(result.awayScore, 10)
              return (
                <tr
                  key={idx}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => onJump(idx)}
                >
                  <td className="px-3 py-2 text-gray-400 tabular-nums">{game.overall}</td>
                  <td className="px-3 py-2">
                    <span className={hNum > aNum ? 'font-semibold text-gray-900' : 'text-gray-500'}>
                      {game.home}
                    </span>
                    <span className="text-gray-300 mx-1">vs</span>
                    <span className={aNum > hNum ? 'font-semibold text-gray-900' : 'text-gray-500'}>
                      {game.away}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center font-mono tabular-nums text-gray-700">
                    {result.homeScore}–{result.awayScore}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Done screen ────────────────────────────────────────────────────────────

function DoneScreen({
  games,
  results,
  onReset,
}: {
  games: FlatGame[]
  results: Array<{ homeScore: string; awayScore: string }>
  onReset: () => void
}) {
  // Tally wins per team
  const wins: Record<string, number> = {}
  const losses: Record<string, number> = {}
  const ties: Record<string, number> = {}

  for (let i = 0; i < games.length; i++) {
    const r = results[i]
    if (!r || r.homeScore === '' || r.awayScore === '') continue
    const g = games[i]
    const h = parseInt(r.homeScore, 10)
    const a = parseInt(r.awayScore, 10)
    wins[g.home] = (wins[g.home] ?? 0) + (h > a ? 1 : 0)
    wins[g.away] = (wins[g.away] ?? 0) + (a > h ? 1 : 0)
    losses[g.home] = (losses[g.home] ?? 0) + (h < a ? 1 : 0)
    losses[g.away] = (losses[g.away] ?? 0) + (a < h ? 1 : 0)
    ties[g.home] = (ties[g.home] ?? 0) + (h === a ? 1 : 0)
    ties[g.away] = (ties[g.away] ?? 0) + (a === h ? 1 : 0)
  }

  const teams = [...new Set(games.flatMap((g) => [g.home, g.away]))].sort()
  const standings = teams
    .map((t) => ({ team: t, w: wins[t] ?? 0, l: losses[t] ?? 0, t: ties[t] ?? 0 }))
    .sort((a, b) => b.w - a.w || a.l - b.l)

  return (
    <div className="max-w-md mx-auto py-8 px-4 text-center">
      <div className="text-5xl mb-4">🏆</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">That&apos;s a wrap!</h2>
      <p className="text-gray-500 mb-8">All games complete.</p>

      <div className="border border-gray-200 rounded-xl overflow-hidden mb-8 text-left">
        <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Final Standings
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-gray-100">
              <th className="px-4 py-2 text-left text-gray-500 font-medium">Team</th>
              <th className="px-4 py-2 text-center text-gray-500 font-medium w-10">W</th>
              <th className="px-4 py-2 text-center text-gray-500 font-medium w-10">L</th>
              <th className="px-4 py-2 text-center text-gray-500 font-medium w-10">T</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr key={row.team} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-900">
                  {i === 0 && row.w > 0 ? '🥇 ' : ''}{row.team}
                </td>
                <td className="px-4 py-2 text-center font-semibold text-green-700">{row.w}</td>
                <td className="px-4 py-2 text-center text-gray-500">{row.l}</td>
                <td className="px-4 py-2 text-center text-gray-400">{row.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
      >
        Start a new night
      </button>
    </div>
  )
}

// ── Main tracker component ─────────────────────────────────────────────────

export function TrackTonight() {
  const [trackerState, setTrackerState] = useState<TrackerState | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Load from localStorage after mount
  useEffect(() => {
    setTrackerState(loadState())
    setHydrated(true)
  }, [])

  // Persist whenever state changes
  useEffect(() => {
    if (!hydrated) return
    if (trackerState) saveState(trackerState)
  }, [trackerState, hydrated])

  const schedule = trackerState
    ? ALL_SCHEDULES.find((s) => s.key === trackerState.scheduleKey) ?? null
    : null
  const games = schedule ? flattenSchedule(schedule) : []

  // Ensure results array is long enough
  const results: Array<{ homeScore: string; awayScore: string }> = trackerState
    ? [
        ...trackerState.results,
        ...Array.from({ length: Math.max(0, games.length - trackerState.results.length) }, () => ({
          homeScore: '',
          awayScore: '',
        })),
      ]
    : []

  const currentIdx = trackerState?.currentIdx ?? 0
  const currentGame = games[currentIdx] ?? null

  function selectSchedule(key: string) {
    const s = ALL_SCHEDULES.find((sc) => sc.key === key)!
    const total = flattenSchedule(s).length
    const state: TrackerState = {
      scheduleKey: key,
      currentIdx: 0,
      results: Array.from({ length: total }, () => ({ homeScore: '', awayScore: '' })),
    }
    setTrackerState(state)
    saveState(state)
  }

  function updateScore(field: 'homeScore' | 'awayScore', value: string) {
    if (!trackerState) return
    const newResults = [...results]
    newResults[currentIdx] = { ...newResults[currentIdx], [field]: value }
    setTrackerState({ ...trackerState, results: newResults })
  }

  function goNext() {
    if (!trackerState) return
    if (currentIdx < games.length - 1) {
      setTrackerState({ ...trackerState, currentIdx: currentIdx + 1 })
    } else {
      // All done — advance past last game to trigger done screen
      setTrackerState({ ...trackerState, currentIdx: games.length })
    }
  }

  function goPrev() {
    if (!trackerState || currentIdx === 0) return
    setTrackerState({ ...trackerState, currentIdx: currentIdx - 1 })
  }

  function jumpTo(idx: number) {
    if (!trackerState) return
    setTrackerState({ ...trackerState, currentIdx: idx })
  }

  function reset() {
    clearState()
    setTrackerState(null)
  }

  if (!hydrated) {
    return <div className="py-12 text-center text-gray-400">Loading…</div>
  }

  // No schedule chosen yet
  if (!trackerState || !schedule) {
    return <SchedulePicker onSelect={selectSchedule} />
  }

  // All games done
  if (currentIdx >= games.length) {
    return (
      <div>
        <div className="flex justify-end px-4 pt-4 print:hidden">
          <button
            type="button"
            onClick={reset}
            className="text-sm text-gray-400 hover:text-gray-700 underline"
          >
            Change schedule
          </button>
        </div>
        <DoneScreen games={games} results={results} onReset={reset} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 pt-2 print:hidden">
        <div className="text-sm text-gray-500">
          <span className="font-medium text-gray-900">{schedule.label}</span>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-sm text-gray-400 hover:text-gray-700 underline"
        >
          Change schedule
        </button>
      </div>

      {/* Scoreboard (past games) */}
      <Scoreboard games={games} results={results} currentIdx={currentIdx} onJump={jumpTo} />

      {/* Current game entry */}
      {currentGame && (
        <ScoreEntry
          game={currentGame}
          total={games.length}
          homeScore={results[currentIdx]?.homeScore ?? ''}
          awayScore={results[currentIdx]?.awayScore ?? ''}
          onHomeScore={(v) => updateScore('homeScore', v)}
          onAwayScore={(v) => updateScore('awayScore', v)}
          onNext={goNext}
          onPrev={goPrev}
          isLast={currentIdx === games.length - 1}
          canGoBack={currentIdx > 0}
        />
      )}
    </div>
  )
}
