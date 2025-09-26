interface CourtDisplayProps {
  courtNumber: 1 | 2
  team1: string
  team2: string
  ref: string
}

export default function CourtDisplay({ courtNumber, team1, team2, ref }: CourtDisplayProps) {
  return (
    <div className="border border-gray-300 rounded p-3 bg-gray-50">
      <h4 className="font-bold mb-2 text-gray-900">Court {courtNumber}</h4>
      {team1 || team2 ? (
        <>
          <div className="flex justify-between items-center mb-2">
            <div className="text-center">
              <span className="font-semibold text-gray-900">{team1 || 'BYE'}</span>
              <div className="text-xs text-blue-600 font-medium">HOME</div>
            </div>
            <span className="text-gray-800 font-bold">vs</span>
            <div className="text-center">
              <span className="font-semibold text-gray-900">{team2 || 'BYE'}</span>
              <div className="text-xs text-purple-600 font-medium">AWAY</div>
            </div>
          </div>
          <div className="text-sm text-green-600 font-medium">
            Ref: {ref || 'TBD'}
          </div>
        </>
      ) : (
        <div className="text-gray-600 italic">No game scheduled</div>
      )}
    </div>
  )
}