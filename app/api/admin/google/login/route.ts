import { NextRequest, NextResponse } from 'next/server'
import {
  createOAuthState,
  isAdminAllowlistConfigured,
  setAdminOAuthStateCookie,
} from '@/app/lib/admin-auth'

function adminBaseUrl(request: NextRequest): URL {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) return new URL(appUrl)
  return new URL(request.url)
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV === 'production' && !isAdminAllowlistConfigured()) {
    return NextResponse.redirect(new URL('/login?error=allowlist_not_configured', request.url))
  }

  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    return NextResponse.json({ error: 'Google auth is not configured' }, { status: 500 })
  }

  const baseUrl = adminBaseUrl(request)
  const redirectUri = new URL('/api/admin/google/callback', baseUrl)
  const state = createOAuthState()

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri.toString())
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('prompt', 'select_account')

  const response = NextResponse.redirect(authUrl)
  setAdminOAuthStateCookie(response, state)
  return response
}
