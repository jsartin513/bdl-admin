'use client'

import { useState } from 'react'
import { TeamStatsWithTeam } from './types'
import type { Game } from './types'

interface TeamStatsCardsProps {
  teamStats: TeamStatsWithTeam[]
  selectedWeek: string
  /** When viewing a single week (1-6), pass games so each card can show "View this week's schedule" */
  games?: Game[]
}

/** Matches scheduleParser: both courts have a real matchup (not BYE/TBD/empty). */
function validMatchupSide(home: string, away: string): boolean {
  return !!(
    home &&
    away &&
    home !== 'BYE' &&
    away !== 'BYE' &&
    home !== 'TBD' &&
    away !== 'TBD'
  )
}

function roundHasTwoCourts(game: Game): boolean {
  return validMatchupSide(game.court1Team1, game.court1Team2) && validMatchupSide(game.court2Team1, game.court2Team2)
}

type TeamWeekRow = {
  gameNumber: string
  activity: string
  opponent?: string
  homeAway?: 'vs' | '@'
  /** Only one court has a game; idle-streak warnings skip these rows (see note in UI). */
  partialRound: boolean
}

function getTeamScheduleForWeek(team: string, games: Game[]): TeamWeekRow[] {
  return games.map((game) => {
    const partialRound = !roundHasTwoCourts(game)
    let activity = 'Off'
    let opponent: string | undefined
    let homeAway: 'vs' | '@' | undefined
    if (game.court1Team1 === team || game.court1Team2 === team) {
      activity = 'Playing Court 1'
      opponent = game.court1Team1 === team ? game.court1Team2 : game.court1Team1
      homeAway = game.court1Team1 === team ? 'vs' : '@'
    } else if (game.court2Team1 === team || game.court2Team2 === team) {
      activity = 'Playing Court 2'
      opponent = game.court2Team1 === team ? game.court2Team2 : game.court2Team1
      homeAway = game.court2Team1 === team ? 'vs' : '@'
    } else if (game.court1Ref === team) activity = 'Reffing Court 1'
    else if (game.court2Ref === team) activity = 'Reffing Court 2'
    return { gameNumber: game.gameNumber, activity, opponent, homeAway, partialRound }
  })
}

const isSingleWeek = (w: string) => w !== 'all' && w !== 'weeks5-6'

export default function TeamStatsCards({ teamStats, selectedWeek, games = [] }: TeamStatsCardsProps) {
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const showWeekSchedule = isSingleWeek(selectedWeek) && games.length > 0
  const allTeamNames = teamStats.map((s) => s.team)
  const allExpanded = allTeamNames.length > 0 && allTeamNames.every((t) => expandedTeams.has(t))

  const toggleTeam = (team: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev)
      if (next.has(team)) next.delete(team)
      else next.add(team)
      return next
    })
  }
  const expandAll = () => setExpandedTeams(new Set(allTeamNames))
  const collapseAll = () => setExpandedTeams(new Set())

  return (
    <div>
      {showWeekSchedule && allTeamNames.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={allExpanded ? collapseAll : expandAll}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {teamStats.map((stat) => {
        const isExpanded = expandedTeams.has(stat.team)
        const weekSchedule = showWeekSchedule ? getTeamScheduleForWeek(stat.team, games) : []

        return (
          <div
            key={stat.team}
            className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm"
          >
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

              {Object.keys(stat.matchups || {}).length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Head-to-Head:</h4>
                  <div className="space-y-1">
                    {Object.entries(stat.matchups)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([opponent, matchup]) => (
                        <div key={opponent} className="text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-900 font-medium">vs {opponent}:</span>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-green-600">{matchup.total} games</span>
                              <span className="text-xs text-gray-600">
                                <span className="text-blue-600">H:{matchup.home}</span>
                                <span className="mx-1">•</span>
                                <span className="text-purple-600">A:{matchup.away}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {showWeekSchedule && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => toggleTeam(stat.team)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {isExpanded ? 'Hide ↑' : "View this week's schedule ↓"}
                  </button>
                  {isExpanded && weekSchedule.length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm">
                      {weekSchedule.map(({ gameNumber, activity, opponent, homeAway, partialRound }) => (
                        <li key={gameNumber} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-gray-700 shrink-0">{gameNumber}</span>
                            <span
                              className={
                                activity === 'Off'
                                  ? 'text-gray-500 italic'
                                  : activity.startsWith('Playing')
                                    ? 'text-blue-700 font-medium'
                                    : 'text-green-700 font-medium'
                              }
                            >
                              {activity}
                              {opponent && homeAway && (
                                <span className="text-gray-800"> {homeAway} {opponent}</span>
                              )}
                            </span>
                          </div>
                          {partialRound && activity === 'Off' && (
                            <p className="text-xs text-gray-500 mt-1.5 pl-0 leading-snug">
                              One-court round only. “Consecutive rounds without playing” alerts only
                              count back-to-back <span className="italic">full two-court</span> rounds,
                              so this row is fine next to a ref or off slot on a normal round.
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}