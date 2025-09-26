import { TeamStatsWithTeam } from './types'

interface TeamStatsCardsProps {
  teamStats: TeamStatsWithTeam[]
  selectedWeek: string
}

export default function TeamStatsCards({ teamStats, selectedWeek }: TeamStatsCardsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {teamStats.map(stat => (
        <div key={stat.team} className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
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
            
            {selectedWeek === 'all' && Object.keys(stat.matchups).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Head-to-Head:</h4>
                <div className="space-y-1">
                  {Object.entries(stat.matchups)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([opponent, count]) => (
                      <div key={opponent} className="flex justify-between text-sm">
                        <span className="text-gray-900">vs {opponent}:</span>
                        <span className="font-medium text-blue-700">{count} games</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}