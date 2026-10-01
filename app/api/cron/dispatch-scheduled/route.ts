import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/app/lib/db'
import { dispatchDueScheduledActions } from '@/app/lib/schedule/mutations'
import { authorizeCron } from '@/app/lib/schedule/cron-auth'

export const runtime = 'nodejs'
/** Hobby plan caps serverless functions at 60s (see Vercel limits). */
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const auth = authorizeCron(request)
  if (auth) return auth

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'no database' })
  }

  const result = await dispatchDueScheduledActions({ limit: 5 })
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  return GET(request)
}
