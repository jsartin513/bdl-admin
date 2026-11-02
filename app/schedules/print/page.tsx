import Link from 'next/link'
import { TeamSchedulePrintView } from '@/app/components/schedule/TeamSchedulePrintView'
import { withDevMode } from '@/app/lib/devMode'
import { loadLocalLeagueWorkbook } from '@/app/lib/league/load-local-workbook'
import { buildTeamPrintSchedulesFromWorkbook } from '@/app/lib/league/team-schedule'

type PrintSearchParams = {
  league?: string | string[]
  dev?: string | string[]
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function TeamSchedulesPrintPage({
  searchParams,
}: {
  searchParams: Promise<PrintSearchParams>
}) {
  const params = await searchParams
  const league = firstParam(params.league)
  const devMode = firstParam(params.dev) === '1' || firstParam(params.dev) === 'true'
  const backHref = withDevMode('/schedules', devMode)

  if (!league) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Link href={backHref} className="text-sm font-medium text-blue-700 underline">
          ← Back to schedules
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Print team schedules</h1>
        <p className="mt-2 text-sm text-gray-700">
          Choose a local league workbook on the schedules page, then use Print team schedules.
        </p>
      </div>
    )
  }

  let parsed
  try {
    parsed = loadLocalLeagueWorkbook(league)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read that workbook.'
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Link href={backHref} className="text-sm font-medium text-blue-700 underline">
          ← Back to schedules
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Print team schedules</h1>
        <p className="mt-2 text-sm text-red-700">{message}</p>
        <p className="mt-2 text-sm text-gray-700">
          Team handouts need a local team-ref workbook with a Teams sheet and Week N Schedule sheets.
        </p>
      </div>
    )
  }

  const schedules = buildTeamPrintSchedulesFromWorkbook(parsed)
  const filename = league.split(/[/\\]/).pop() || league

  return (
    <div className="team-schedule-print container mx-auto px-4 py-6 max-w-3xl">
      <TeamSchedulePrintView
        name={parsed.name}
        filename={filename}
        backHref={backHref}
        schedules={schedules}
        weeks={parsed.weeks}
      />
    </div>
  )
}
