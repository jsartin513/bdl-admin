import { TeamStats, TeamStatsWithTeam } from './types'

interface TeamsOffDisplayProps {
  game: {
    court1Team1: string
    court1Team2: string
    court2Team1: string
    court2Team2: string
    court1Ref: string
    court2Ref: string
  }
  // Support both formats from live and static pages
  teamStats: Record<string, TeamStats> | TeamStatsWithTeam[]
  /** When set, accent this team in the off list and highlight the panel if they are off */
  focusTeam?: string
}

export default function TeamsOffDisplay({ game, teamStats, focusTeam }: TeamsOffDisplayProps) {
  const playingTeams = new Set([
    game.court1Team1, game.court1Team2,
    game.court2Team1, game.court2Team2,
    game.court1Ref, game.court2Ref
  ].filter(team => team && team !== 'BYE' && team !== 'TBD'))

  // Handle both data formats
  const allTeams = Array.isArray(teamStats)
    ? teamStats.map(stat => stat.team).sort()
    : Object.keys(teamStats).sort()

  const offTeams = allTeams.filter(team => !playingTeams.has(team))
  const focusIsOff = !!(focusTeam && offTeams.includes(focusTeam))

  const containerClass = [
    'border rounded p-3 md:col-span-1',
    focusIsOff
      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
      : focusTeam && !focusIsOff
        ? 'border-gray-200 bg-gray-50 opacity-50'
        : 'border-gray-300 bg-gray-50',
  ].join(' ')

  return (
    <div className={containerClass}>
      <h4 className="font-bold mb-2 text-gray-900">Teams Off</h4>
      <div className="text-sm text-gray-700">
        {offTeams.length > 0
          ? offTeams.map(team => (
              <div
                key={team}
                className={
                  focusTeam && team === focusTeam
                    ? 'text-blue-800 font-bold text-xs mb-1'
                    : 'text-black font-medium text-xs mb-1'
                }
              >
                {team}
              </div>
            ))
          : <div className="text-gray-500 italic text-xs">All teams active</div>
        }
      </div>
    </div>
  )
}
