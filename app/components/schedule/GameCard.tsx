import CourtDisplay from './CourtDisplay'
import TeamsOffDisplay from './TeamsOffDisplay'
import { Game, TeamStats, TeamStatsWithTeam } from './types'

interface GameCardProps {
  game: Game
  // Support both formats from live and static pages
  teamStats: Record<string, TeamStats> | TeamStatsWithTeam[]
  /** When set, highlight this team's role on the card */
  focusTeam?: string
}

type FocusRole =
  | { action: 'PLAY'; court: 1 | 2; side: 'HOME' | 'AWAY'; opponent: string }
  | { action: 'REF'; court: 1 | 2 }
  | { action: 'OFF' }

function getFocusRole(team: string, game: Game): FocusRole {
  if (game.court1Team1 === team) {
    return { action: 'PLAY', court: 1, side: 'HOME', opponent: game.court1Team2 || 'BYE' }
  }
  if (game.court1Team2 === team) {
    return { action: 'PLAY', court: 1, side: 'AWAY', opponent: game.court1Team1 || 'BYE' }
  }
  if (game.court2Team1 === team) {
    return { action: 'PLAY', court: 2, side: 'HOME', opponent: game.court2Team2 || 'BYE' }
  }
  if (game.court2Team2 === team) {
    return { action: 'PLAY', court: 2, side: 'AWAY', opponent: game.court2Team1 || 'BYE' }
  }
  if (game.court1Ref === team) return { action: 'REF', court: 1 }
  if (game.court2Ref === team) return { action: 'REF', court: 2 }
  return { action: 'OFF' }
}

function FocusRoleBanner({ role }: { role: FocusRole }) {
  const actionClass =
    role.action === 'PLAY'
      ? 'bg-blue-600 text-white'
      : role.action === 'REF'
        ? 'bg-green-600 text-white'
        : 'bg-gray-500 text-white'

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center px-3 py-1 rounded-md text-lg font-bold tracking-wide ${actionClass}`}>
        {role.action}
      </span>
      {(role.action === 'PLAY' || role.action === 'REF') && (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold bg-gray-100 text-gray-900 border border-gray-300">
          Court {role.court}
        </span>
      )}
      {role.action === 'PLAY' && (
        <>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold border ${
              role.side === 'HOME'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-purple-50 text-purple-800 border-purple-200'
            }`}
          >
            {role.side}
          </span>
          <span className="text-sm text-gray-700">
            {role.side === 'HOME' ? 'vs' : '@'} {role.opponent}
          </span>
        </>
      )}
    </div>
  )
}

export default function GameCard({ game, teamStats, focusTeam }: GameCardProps) {
  const focusRole = focusTeam ? getFocusRole(focusTeam, game) : null

  if (focusRole) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-4">
        <h3 className="font-bold text-xl mb-3 text-gray-900">{game.gameNumber}</h3>
        <FocusRoleBanner role={focusRole} />
      </div>
    )
  }

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
