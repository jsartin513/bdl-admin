import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  getOutboundSummaryLast7Days,
  listOutboundMessages,
  parseOutboxLimit,
} from '@/app/lib/outbound/queries'
import type {
  OutboundChannel,
  OutboundKind,
  OutboundStatus,
} from '@/app/lib/outbound/types'

function parseStatus(
  raw: string | null
): OutboundStatus | 'sent_group' | null {
  if (!raw?.trim()) return null
  const value = raw.trim().toLowerCase()
  if (value === 'sent') return 'sent_group'
  if (
    value === 'failed' ||
    value === 'skipped' ||
    value === 'delivered' ||
    value === 'opted_out'
  ) {
    return value as OutboundStatus
  }
  return null
}

function parseChannel(raw: string | null): OutboundChannel | null {
  if (!raw?.trim()) return null
  const value = raw.trim().toLowerCase()
  if (value === 'email' || value === 'sms' || value === 'whatsapp') {
    return value
  }
  return null
}

function parseKind(raw: string | null): OutboundKind | null {
  if (!raw?.trim()) return null
  const value = raw.trim().toLowerCase()
  if (
    value === 'contact' ||
    value === 'video_notify' ||
    value === 'login_alert'
  ) {
    return value
  }
  return null
}

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const { searchParams } = request.nextUrl
  const status = parseStatus(searchParams.get('status'))
  const channel = parseChannel(searchParams.get('channel'))
  const kind = parseKind(searchParams.get('kind'))
  const q = searchParams.get('q')
  const limit = parseOutboxLimit(searchParams.get('limit'))

  try {
    const [messages, summary] = await Promise.all([
      listOutboundMessages({ status, channel, kind, q, limit }),
      getOutboundSummaryLast7Days(),
    ])
    return NextResponse.json({ messages, summary })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load outbox'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
