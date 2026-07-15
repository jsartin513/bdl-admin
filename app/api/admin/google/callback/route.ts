import { NextRequest, NextResponse } from 'next/server'
import {
  clearAdminOAuthStateCookie,
  isAllowedAdminEmail,
  readAdminOAuthState,
  setAdminSessionCookie,
} from '@/app/lib/admin-auth'

function adminBaseUrl(request: NextRequest): URL {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) return new URL(appUrl)
  return new URL(request.url)
}

function adminErrorRedirect(request: NextRequest, error: string) {
  const response = NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(error)}`, request.url)
  )
  clearAdminOAuthStateCookie(response)
  return response
}

export async function GET(request: NextRequest) {
  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.ADMIN_GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return adminErrorRedirect(request, 'google_not_configured')
  }

  const expectedState = readAdminOAuthState(request)
  const state = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')

  if (!expectedState || !state || expectedState !== state || !code) {
    return adminErrorRedirect(request, 'invalid_state')
  }

  const baseUrl = adminBaseUrl(request)
  const redirectUri = new URL('/api/admin/google/callback', baseUrl)

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri.toString(),
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    return adminErrorRedirect(request, 'token_exchange_failed')
  }

  const tokenData = (await tokenResponse.json()) as { id_token?: string }
  const idToken = tokenData.id_token
  if (!idToken) {
    return adminErrorRedirect(request, 'missing_id_token')
  }

  const verifyResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  )
  if (!verifyResponse.ok) {
    return adminErrorRedirect(request, 'token_verify_failed')
  }

  const profile = (await verifyResponse.json()) as {
    aud?: string
    email?: string
    email_verified?: string
  }

  const email = profile.email?.toLowerCase()
  if (!email || profile.email_verified !== 'true' || profile.aud !== clientId) {
    return adminErrorRedirect(request, 'invalid_google_identity')
  }

  if (!isAllowedAdminEmail(email)) {
    return adminErrorRedirect(request, 'email_not_allowed')
  }

  const nextParam = request.cookies.get('admin_oauth_next')?.value
  const destination =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/schedules'

  const response = NextResponse.redirect(new URL(destination, request.url))
  clearAdminOAuthStateCookie(response)
  response.cookies.set({
    name: 'admin_oauth_next',
    value: '',
    path: '/',
    maxAge: 0,
  })
  if (!setAdminSessionCookie(response, email)) {
    return adminErrorRedirect(request, 'session_not_configured')
  }

  return response
}
