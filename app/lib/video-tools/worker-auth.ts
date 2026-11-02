import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export function getVideoWorkerSecret(): string | null {
  const secret = process.env.VIDEO_WORKER_SECRET?.trim()
  return secret ? secret : null
}

export function verifyVideoWorkerRequest(request: NextRequest): boolean {
  const secret = getVideoWorkerSecret()
  if (!secret) return false
  const header = request.headers.get('authorization')
  if (!header) return false
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return false
  return safeEqual(match[1].trim(), secret)
}

export function workerUnauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
