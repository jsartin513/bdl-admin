import { NextRequest, NextResponse } from 'next/server'
import { clearAdminSessionCookie } from '@/app/lib/admin-auth'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  clearAdminSessionCookie(response, request.nextUrl.hostname)
  return response
}
