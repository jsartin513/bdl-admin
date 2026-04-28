import { useMemo } from 'react'
import { Conflict, ConflictType } from './types'

interface ConflictsAlertProps {
  conflicts: Conflict[]
}

const GROUP_ORDER: { type: ConflictType; title: string }[] = [
  { type: 'double-court', title: 'Same team on both courts' },
  { type: 'ref-and-play', title: 'Referee also playing in the same game' },
  { type: 'consecutive-ref', title: 'Consecutive referee games' },
  {
    type: 'consecutive-without-playing',
    title: 'Consecutive two-court rounds without playing',
  },
  { type: 'consecutive-matchup', title: 'Same matchup in consecutive games' },
  {
    type: 'duplicate-orientation-same-night',
    title: 'Same matchup & home/away twice in one night',
  },
  { type: 'home-away-imbalance', title: 'Home / away imbalance' },
  { type: 'unknown', title: 'Other' },
]

function inferConflictType(c: Conflict): ConflictType {
  if (c.conflictType) return c.conflictType
  const text = c.conflicts.join(' ')
  if (text.includes('Playing on both Court')) return 'double-court'
  if (text.includes('Playing and reffing')) return 'ref-and-play'
  if (text.includes('Refed in consecutive games')) return 'consecutive-ref'
  if (
    text.includes('consecutive two-court rounds') ||
    text.includes('consecutive games without playing')
  )
    return 'consecutive-without-playing'
  if (text.includes('Played each other in consecutive games')) return 'consecutive-matchup'
  if (text.includes('Same home/away matchup') && text.includes('one night'))
    return 'duplicate-orientation-same-night'
  if (text.includes('Home/away imbalance')) return 'home-away-imbalance'
  return 'unknown'
}

function severityStyles(severity: Conflict['severity']) {
  if (!severity || severity === 'error') {
    return {
      border: 'border-red-200',
      bg: 'bg-red-50',
      text: 'text-red-700',
      accent: 'text-red-800',
      detailBorder: 'border-red-300',
      detailText: 'text-red-800',
      muted: 'text-red-600',
    }
  }
  if (severity === 'warning') {
    return {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      accent: 'text-amber-800',
      detailBorder: 'border-amber-300',
      detailText: 'text-amber-800',
      muted: 'text-amber-600',
    }
  }
  return {
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    accent: 'text-blue-800',
    detailBorder: 'border-blue-300',
    detailText: 'text-blue-800',
    muted: 'text-blue-600',
  }
}

export default function ConflictsAlert({ conflicts }: ConflictsAlertProps) {
  const grouped = useMemo(() => {
    const map = new Map<ConflictType, Conflict[]>()
    for (const c of conflicts) {
      const t = inferConflictType(c)
      if (!map.has(t)) map.set(t, [])
      map.get(t)!.push(c)
    }
    return map
  }, [conflicts])

  if (conflicts.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-900">Schedule checks</h2>
      <p className="text-sm text-gray-600 mb-4">
        Issues are grouped by type. Expand a section to see details.
      </p>
      <div className="space-y-3">
        {GROUP_ORDER.map(({ type, title }) => {
          const items = grouped.get(type)
          if (!items?.length) return null
          return (
            <details
              key={type}
              className="group rounded-lg border border-gray-200 bg-white shadow-sm open:shadow"
            >
              <summary className="cursor-pointer list-none select-none px-4 py-3 font-semibold text-gray-900 hover:bg-gray-50 rounded-lg [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
                <span>
                  {title}{' '}
                  <span className="font-normal text-gray-500">({items.length})</span>
                </span>
                <span className="text-gray-400 text-sm shrink-0 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="px-4 pb-4 pt-0 space-y-4 border-t border-gray-100">
                {items.map((conflict, index) => {
                  const st = severityStyles(conflict.severity)
                  return (
                    <div
                      key={`${type}-${index}`}
                      className={`rounded-md border ${st.border} ${st.bg} p-3 text-sm`}
                    >
                      <div className="mb-1">
                        {conflict.gameNumber ? (
                          <span className={`font-semibold ${st.accent}`}>{conflict.gameNumber}</span>
                        ) : null}
                        {conflict.gameNumber && conflict.team ? (
                          <span className={st.muted}> — </span>
                        ) : null}
                        <span className={`font-medium ${st.accent}`}>{conflict.team}</span>
                        <span className={st.text}>: {conflict.conflicts.join(', ')}</span>
                      </div>
                      {conflict.idleStreakRounds && conflict.idleStreakRounds.length > 0 ? (
                        <div className={`ml-1 mt-3 space-y-4 border-l-2 ${st.detailBorder} pl-3`}>
                          {conflict.idleStreakRounds.map((round, rIdx) => (
                            <div key={rIdx} className={st.detailText}>
                              <div className="font-semibold text-gray-900">
                                {round.gameNumber}
                                <span className={`font-normal ${st.muted}`}>
                                  {' '}
                                  — <span className="text-gray-800">{round.offTeam}</span>:{' '}
                                  {round.offTeamStatus}
                                </span>
                              </div>
                              <div className="mt-2 ml-1 space-y-1.5 text-xs sm:text-sm">
                                <div>
                                  <span className="font-medium text-gray-700">Court 1</span>
                                  <span className="ml-2">
                                    <span className="text-blue-600">Home: {round.court1.home}</span>
                                    <span className="mx-1.5">·</span>
                                    <span className="text-purple-600">Away: {round.court1.away}</span>
                                    <span className="mx-1.5">·</span>
                                    <span className="text-green-600">Ref: {round.court1.ref}</span>
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Court 2</span>
                                  <span className="ml-2">
                                    <span className="text-blue-600">Home: {round.court2.home}</span>
                                    <span className="mx-1.5">·</span>
                                    <span className="text-purple-600">Away: {round.court2.away}</span>
                                    <span className="mx-1.5">·</span>
                                    <span className="text-green-600">Ref: {round.court2.ref}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        conflict.courtDetails &&
                        conflict.courtDetails.length > 0 && (
                          <div className={`ml-1 mt-2 space-y-2 border-l-2 ${st.detailBorder} pl-3`}>
                            {conflict.courtDetails.map((detail, dIdx) => (
                              <div key={dIdx} className={st.detailText}>
                                <span className="font-medium">{detail.gameNumber}</span>
                                <span className={st.muted}> Court {detail.court}</span>
                                <span className="ml-2">
                                  <span className="text-blue-600">Home: {detail.home}</span>
                                  <span className="mx-1.5">·</span>
                                  <span className="text-purple-600">Away: {detail.away}</span>
                                  <span className="mx-1.5">·</span>
                                  <span className="text-green-600">Ref: {detail.ref}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
