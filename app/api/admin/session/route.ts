import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) {
    return adminUnauthorizedResponse()
  }

  return NextResponse.json({ authenticated: true, email: session.email })
}
