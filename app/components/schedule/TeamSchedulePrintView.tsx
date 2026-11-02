'use client'

import Link from 'next/link'
import type { ParsedLeagueWeek } from '@/app/lib/league/parse-workbook'
import type { TeamPrintSchedule, TeamScheduleSlot } from '@/app/lib/league/team-schedule'

function groupSlotsByWeek(slots: TeamScheduleSlot[]): { weekNumber: number; slots: TeamScheduleSlot[] }[] {
  const byWeek = new Map<number, TeamScheduleSlot[]>()
  for (const slot of slots) {
    const list = byWeek.get(slot.weekNumber) ?? []
    list.push(slot)
    byWeek.set(slot.weekNumber, list)
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekNumber, weekSlots]) => ({
      weekNumber,
      slots: weekSlots.sort((a, b) => a.gameNumber - b.gameNumber),
    }))
}

function formatGameNumber(gameNumber: number): string {
  return String(gameNumber).padStart(2, '0')
}

type Props = {
  name: string
  filename: string
  backHref: string
  schedules: TeamPrintSchedule[]
  weeks: ParsedLeagueWeek[]
}

export function TeamSchedulePrintView({ name, filename, backHref, schedules, weeks }: Props) {
  return (
    <div>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.4in; }
        }
      `}</style>
      <div className="team-schedule-print-toolbar mb-6 flex flex-wrap items-center gap-3">
        <Link href={backHref} className="text-sm font-medium text-blue-700 underline">
          ← Back to schedules
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Print
        </button>
        <p className="text-sm text-gray-600">
          {schedules.length} teams · one page per team · from {filename}
        </p>
      </div>

      <div className="space-y-8 print:space-y-0">
        {schedules.map((teamSchedule) => {
          const teamWeeks = groupSlotsByWeek(teamSchedule.slots)
          return (
            <section
              key={teamSchedule.teamName}
              className="team-schedule-sheet rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 print:rounded-none print:p-0 print:shadow-none print:ring-0"
              aria-label={`Schedule for ${teamSchedule.teamName}`}
            >
              <header className="border-b border-gray-200 pb-4 print:pb-1">
                <p className="text-sm font-medium uppercase tracking-wide text-gray-500 print:text-[9pt] print:leading-tight print:tracking-normal">
                  {name}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-gray-900 print:mt-0 print:text-[16pt] print:leading-tight">
                  {teamSchedule.teamName}
                </h1>
                <p className="mt-1 text-sm text-gray-600 print:hidden">Season schedule</p>
              </header>

              <div className="team-schedule-weeks mt-6 space-y-5 print:mt-2 print:space-y-0">
                {teamWeeks.map(({ weekNumber, slots }) => (
                  <div key={weekNumber} className="team-schedule-week">
                    <h2 className="text-lg font-semibold text-gray-900 print:text-[10pt] print:leading-tight">
                      Week {weekNumber}
                    </h2>
                    <ul className="mt-2 space-y-1 text-sm text-gray-900 print:mt-0.5 print:space-y-0 print:text-[8pt] print:leading-tight">
                      {slots.map((slot) => (
                        <li key={`${weekNumber}-${slot.gameNumber}`} className="tabular-nums">
                          {slot.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <section className="team-schedule-source mt-10 border-t border-gray-300 pt-8" aria-label="Source week schedules">
        <h2 className="text-2xl font-semibold text-gray-900">Source week schedules</h2>
        <p className="mt-1 mb-6 text-sm text-gray-600">
          Court view from the same workbook, for checking the handouts. Hidden when printing.
        </p>
        <div className="space-y-8">
          {weeks.map((week) => (
            <div key={week.weekNumber}>
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                {name} — Week {week.weekNumber}
              </h3>
              <div className="space-y-3">
                {week.games.map((game) => (
                  <div
                    key={game.gameNumber}
                    className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm"
                  >
                    <p className="font-semibold text-gray-900">Game {formatGameNumber(game.gameNumber)}</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Court 1</p>
                        <p className="mt-1 font-medium text-gray-900">
                          {game.court1TeamA} vs {game.court1TeamB}
                        </p>
                        {game.court1Refs ? (
                          <p className="mt-1 text-gray-600">Refs: {game.court1Refs}</p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Court 2</p>
                        <p className="mt-1 font-medium text-gray-900">
                          {game.court2TeamA} vs {game.court2TeamB}
                        </p>
                        {game.court2Refs ? (
                          <p className="mt-1 text-gray-600">Refs: {game.court2Refs}</p>
                        ) : null}
                      </div>
                    </div>
                    {game.teamsOff ? <p className="mt-2 text-gray-600">Off: {game.teamsOff}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
