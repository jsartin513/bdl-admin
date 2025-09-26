import CourtDisplay from './CourtDisplay'
import TeamsOffDisplay from './TeamsOffDisplay'
import { Game, TeamStats, TeamStatsWithTeam } from './types'

interface GameCardProps {
  game: Game
  // Support both formats from live and static pages
  teamStats: Record<string, TeamStats> | TeamStatsWithTeam[]
}

export default function GameCard({ game, teamStats }: GameCardProps) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      <h3 className="font-bold text-xl mb-3 text-gray-900">{game.gameNumber}</h3>
      <div className="grid md:grid-cols-3 gap-4">
        <CourtDisplay 
          courtNumber={1}
          team1={game.court1Team1}
          team2={game.court1Team2}
          ref={game.court1Ref}
        />
        <CourtDisplay 
          courtNumber={2}
          team1={game.court2Team1}
          team2={game.court2Team2}
          ref={game.court2Ref}
        />
        <TeamsOffDisplay 
          game={{
            court1Team1: game.court1Team1,
            court1Team2: game.court1Team2,
            court2Team1: game.court2Team1,
            court2Team2: game.court2Team2,
            court1Ref: game.court1Ref,
            court2Ref: game.court2Ref
          }}
          teamStats={teamStats}
        />
      </div>
    </div>
  )
}