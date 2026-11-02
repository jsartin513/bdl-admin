import { NextRequest, NextResponse } from 'next/server'
import {
  isInternalAuthError,
  readInternalPlayerIdentity,
} from '@/app/lib/events/live-draft-internal-auth'
import { listCaptainLiveDraftEvents } from '@/app/lib/events/live-draft'

export async function GET(request: NextRequest) {
  const identity = readInternalPlayerIdentity(request)
  if (isInternalAuthError(identity)) return identity

  const events = await listCaptainLiveDraftEvents(identity.email)
  return NextResponse.json({ version: 1, events })
}
