import { Conflict } from './types'

interface ConflictsAlertProps {
  conflicts: Conflict[]
}

export default function ConflictsAlert({ conflicts }: ConflictsAlertProps) {
  if (conflicts.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4 text-red-600">⚠️ Schedule Conflicts</h2>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        {conflicts.map((conflict, index) => (
          <div key={index} className="mb-2">
            <span className="font-semibold">{conflict.gameNumber}</span> - 
            <span className="font-medium text-red-700"> {conflict.team}</span>: 
            <span className="text-red-600"> {conflict.conflicts.join(', ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}