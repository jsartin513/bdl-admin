interface WeekSelectorProps {
  selectedWeek: string
  onWeekChange: (week: string) => void
  showAllWeeks?: boolean
}

export default function WeekSelector({ selectedWeek, onWeekChange, showAllWeeks = true }: WeekSelectorProps) {
  return (
    <div className="mb-6">
      <div className="bg-white border border-gray-300 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <label htmlFor="week-select" className="font-semibold text-gray-900">
            Select Week:
          </label>
          <select
            id="week-select"
            value={selectedWeek}
            onChange={(e) => onWeekChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            {showAllWeeks && <option value="all">All Weeks (Totals)</option>}
            <option value="1">Week 1 (9/30)</option>
            <option value="2">Week 2</option>
            <option value="3">Week 3</option>
            <option value="4">Week 4</option>
            <option value="5">Week 5</option>
            <option value="6">Week 6</option>
          </select>
        </div>
      </div>
    </div>
  )
}