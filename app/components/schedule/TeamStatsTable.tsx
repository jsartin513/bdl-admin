import { TeamStats } from './types'

interface TeamStatsTableProps {
  teamStats: Record<string, TeamStats>
}

export default function TeamStatsTable({ teamStats }: TeamStatsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-300 rounded-lg shadow-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold border-b text-gray-900">Team</th>
            <th className="px-4 py-3 text-center font-semibold border-b text-gray-900">Games Played</th>
            <th className="px-4 py-3 text-center font-semibold border-b text-gray-900">Home Games</th>
            <th className="px-4 py-3 text-center font-semibold border-b text-gray-900">Away Games</th>
            <th className="px-4 py-3 text-center font-semibold border-b text-gray-900">Games Reffed</th>
            <th className="px-4 py-3 text-center font-semibold border-b text-gray-900">Total Commitments</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(teamStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([team, stats]) => (
              <tr key={team} className="hover:bg-gray-50">
                <td className="px-4 py-3 border-b font-medium text-gray-900">{team}</td>
                <td className="px-4 py-3 border-b text-center text-gray-900">{stats.gamesPlayed}</td>
                <td className="px-4 py-3 border-b text-center text-blue-600 font-medium">{stats.homeGames}</td>
                <td className="px-4 py-3 border-b text-center text-purple-600 font-medium">{stats.awayGames}</td>
                <td className="px-4 py-3 border-b text-center text-green-600 font-medium">{stats.gamesReffed}</td>
                <td className="px-4 py-3 border-b text-center font-semibold text-black">
                  {stats.gamesPlayed + stats.gamesReffed}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}