'use client'

import type { TeamStats } from './types'

interface HeadToHeadMatrixProps {
  teamStats: Record<string, TeamStats>
  selectedWeek: string
}

function weekSubtitle(selectedWeek: string): string {
  if (selectedWeek === 'all') return 'Across all imported weeks.'
  return `Limited to Week ${selectedWeek} only — switch to All Weeks for full-season pairs.`
}

/**
 * Rows/columns are teams that play at least one matchup in the parsed scope (refs-only rows excluded).
 * Cells count scheduled meetings from that row team's perspective vs the column opponent — home vs away splits.
 */
export default function HeadToHeadMatrix({ teamStats, selectedWeek }: HeadToHeadMatrixProps) {
  const teams = Object.entries(teamStats)
    .filter(([, s]) => (s.gamesPlayed ?? 0) > 0)
    .map(([name]) => name)
    .sort()

  if (teams.length < 2) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Not enough team match data for a grid. Try selecting a league with full week CSV data.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{weekSubtitle(selectedWeek)}</p>
      <p className="text-xs text-gray-500">
        Counts reflect games on the schedule (not standings or scores). Rows are the perspective team —
        diagonal is empty.
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full border-collapse bg-white text-left text-sm text-gray-900">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-gray-200 bg-gray-50 px-2 py-2 font-semibold">
                vs →
              </th>
              {teams.map((t) => (
                <th
                  key={t}
                  scope="col"
                  className="max-w-[7rem] border-b border-l border-gray-200 bg-gray-50 px-1.5 py-2 text-center text-xs font-medium leading-tight"
                  title={t}
                >
                  <span className="line-clamp-2">{t}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((rowTeam) => (
              <tr key={rowTeam}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-gray-100 bg-gray-50 px-2 py-1.5 text-left text-xs font-medium text-gray-800"
                  title={rowTeam}
                >
                  <span className="line-clamp-3">{rowTeam}</span>
                </th>
                {teams.map((colTeam) => {
                  if (rowTeam === colTeam) {
                    return (
                      <td
                        key={colTeam}
                        className="border-b border-l border-gray-100 bg-gray-50/70 text-center text-gray-400"
                      >
                        —
                      </td>
                    )
                  }
                  const m = teamStats[rowTeam]?.matchups?.[colTeam]
                  if (!m || m.total === 0) {
                    return (
                      <td key={colTeam} className="border-b border-l border-gray-100 px-1 text-center text-xs text-gray-400">
                        —
                      </td>
                    )
                  }
                  return (
                    <td
                      key={colTeam}
                      className="border-b border-l border-gray-100 px-1 py-1 text-center text-xs tabular-nums"
                      title={`${rowTeam}: ${m.home} home slot(s), ${m.away} away slot(s) vs ${colTeam}; ${m.total} total`}
                    >
                      <span className="font-medium">{m.total}</span>
                      <span className="block text-[10px] leading-tight text-gray-500 md:inline md:before:mx-0.5 md:before:content-['·'] ">
                        <span>{m.home}H</span> <span>{m.away}A</span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
