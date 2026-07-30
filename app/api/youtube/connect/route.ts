import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  createOAuthState,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  YOUTUBE_OAUTH_SCOPES,
  YOUTUBE_OAUTH_STATE_COOKIE,
} from '@/app/lib/youtube/types'

function adminBaseUrl(request: NextRequest): URL {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) return new URL(appUrl)
  return new URL(request.url)
}

/** Start YouTube OAuth connect (separate from admin login scopes). */
export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured' },
      { status: 500 }
    )
  }

  const baseUrl = adminBaseUrl(request)
  const redirectUri = new URL('/api/youtube/callback', baseUrl)
  const state = createOAuthState()

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri.toString())
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', YOUTUBE_OAUTH_SCOPES)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('include_granted_scopes', 'true')

  const response = NextResponse.redirect(authUrl)
  response.cookies.set({
    name: YOUTUBE_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })
  return response
}
