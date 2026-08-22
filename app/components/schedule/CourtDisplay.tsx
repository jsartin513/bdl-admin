interface CourtDisplayProps {
  courtNumber: 1 | 2
  team1: string
  team2: string
  ref: string
  /** When set with focus highlighting, emphasize this court's involvement */
  highlighted?: boolean
  /** Dim this court when another court holds the focused team */
  muted?: boolean
  /** Which roles match the focused team */
  focusRoles?: {
    team1?: boolean
    team2?: boolean
    ref?: boolean
  }
}

export default function CourtDisplay({
  courtNumber,
  team1,
  team2,
  ref,
  highlighted = false,
  muted = false,
  focusRoles,
}: CourtDisplayProps) {
  const containerClass = [
    'border rounded p-3',
    highlighted
      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
      : muted
        ? 'border-gray-200 bg-gray-50 opacity-50'
        : 'border-gray-300 bg-gray-50',
  ].join(' ')

  return (
    <div className={containerClass}>
      <h4 className="font-bold mb-2 text-gray-900">Court {courtNumber}</h4>
      {team1 || team2 ? (
        <>
          <div className="flex justify-between items-center mb-2">
            <div className="text-center">
              <span
                className={
                  focusRoles?.team1
                    ? 'font-bold text-blue-800'
                    : 'font-semibold text-gray-900'
                }
              >
                {team1 || 'BYE'}
              </span>
              <div className="text-xs text-blue-600 font-medium">HOME</div>
            </div>
            <span className="text-gray-800 font-bold">vs</span>
            <div className="text-center">
              <span
                className={
                  focusRoles?.team2
                    ? 'font-bold text-blue-800'
                    : 'font-semibold text-gray-900'
                }
              >
                {team2 || 'BYE'}
              </span>
              <div className="text-xs text-purple-600 font-medium">AWAY</div>
            </div>
          </div>
          <div
            className={
              focusRoles?.ref
                ? 'text-sm text-green-700 font-bold'
                : 'text-sm text-green-600 font-medium'
            }
          >
            Ref: {ref || 'TBD'}
          </div>
        </>
      ) : (
        <div className="text-gray-600 italic">No game scheduled</div>
      )}
    </div>
  )
}
