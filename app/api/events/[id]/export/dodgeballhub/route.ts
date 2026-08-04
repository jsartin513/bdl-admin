import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  buildDodgeballHubRosterCsv,
  buildDodgeballHubRosterRows,
} from '@/app/lib/events/dodgeballhub-export'
import { getEvent, listEventRegistrations } from '@/app/lib/events/queries'

type RouteContext = { params: Promise<{ id: string }> }

function slugifyFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'event'
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    if (event.teamsFinalizedAt == null) {
      return NextResponse.json(
        { error: 'Finalize teams before exporting for DodgeballHub' },
        { status: 400 }
      )
    }

    const registrations = await listEventRegistrations(id)
    const rows = buildDodgeballHubRosterRows({
      teamNames: event.teamNames,
      registrations,
    })
    const csv = buildDodgeballHubRosterCsv(rows)
    const filename = `${slugifyFilename(event.name)}-dodgeballhub-roster.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to export DodgeballHub roster'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
