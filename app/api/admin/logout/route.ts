import { NextResponse } from 'next/server'
import { clearAdminSessionCookie } from '@/app/lib/admin-auth'

export async function POST() {
  const response = NextResponse.json({ success: true })
  clearAdminSessionCookie(response)
  return response
}
