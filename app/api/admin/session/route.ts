import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  adminUnauthorizedResponse,
  readAdminSession,
} from '@/app/lib/admin-auth'

export async function GET(request: NextRequest) {
  const session = readAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
  if (!session) {
    return adminUnauthorizedResponse()
  }

  return NextResponse.json({ authenticated: true, email: session.email })
}
