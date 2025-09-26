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
}

export default function TeamsOffDisplay({ game, teamStats }: TeamsOffDisplayProps) {
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
  
  return (
    <div className="border border-gray-300 rounded p-3 bg-gray-50 md:col-span-1">
      <h4 className="font-bold mb-2 text-gray-900">Teams Off</h4>
      <div className="text-sm text-gray-700">
        {offTeams.length > 0 
          ? offTeams.map(team => (
              <div key={team} className="text-black font-medium text-xs mb-1">{team}</div>
            ))
          : <div className="text-gray-500 italic text-xs">All teams active</div>
        }
      </div>
    </div>
  )
}