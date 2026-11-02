import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { createNonBdlEvent } from '@/app/lib/non-bdl-events/mutations'
import { listNonBdlEvents } from '@/app/lib/non-bdl-events/queries'
import { isValidBallType } from '@/app/lib/non-bdl-events/types'
import { isValidHomeLeague } from '@/app/lib/players/home-league'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const events = await listNonBdlEvents()
    return NextResponse.json({ events })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to list non-BDL events'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = (await request.json()) as {
      name?: string
      eventDate?: string
      ballType?: string | null
      division?: string | null
      city?: string | null
      hostOrgHomeLeague?: string | null
      hostOrgName?: string | null
      notes?: string | null
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!body.eventDate?.trim()) {
      return NextResponse.json(
        { error: 'eventDate is required' },
        { status: 400 }
      )
    }
    if (
      body.ballType != null &&
      body.ballType !== '' &&
      !isValidBallType(body.ballType)
    ) {
      return NextResponse.json({ error: 'Invalid ballType' }, { status: 400 })
    }
    if (
      body.hostOrgHomeLeague != null &&
      body.hostOrgHomeLeague !== '' &&
      !isValidHomeLeague(body.hostOrgHomeLeague)
    ) {
      return NextResponse.json(
        { error: 'Invalid hostOrgHomeLeague' },
        { status: 400 }
      )
    }

    const event = await createNonBdlEvent({
      name: body.name,
      eventDate: body.eventDate,
      ballType: body.ballType,
      division: body.division,
      city: body.city,
      hostOrgHomeLeague: body.hostOrgHomeLeague,
      hostOrgName: body.hostOrgName,
      notes: body.notes,
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create non-BDL event'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
