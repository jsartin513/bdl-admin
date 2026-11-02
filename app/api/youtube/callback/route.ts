import { NextRequest, NextResponse } from 'next/server'
import {
  getAdminSessionFromRequest,
  isAllowedAdminEmail,
} from '@/app/lib/admin-auth'
import { YOUTUBE_OAUTH_STATE_COOKIE } from '@/app/lib/youtube/types'
import { saveYoutubeConnection } from '@/app/lib/youtube/connection'
import {
  clearYoutubeAccessTokenCache,
  fetchMineChannelWithAccessToken,
} from '@/app/lib/youtube/client'

function adminBaseUrl(request: NextRequest): URL {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) return new URL(appUrl)
  return new URL(request.url)
}

function redirectWithError(request: NextRequest, error: string) {
  const response = NextResponse.redirect(
    new URL(
      `/video-tools?youtube_error=${encodeURIComponent(error)}`,
      request.url
    )
  )
  response.cookies.set({
    name: YOUTUBE_OAUTH_STATE_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.redirect(new URL('/login?next=/video-tools', request.url))
  }

  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.ADMIN_GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return redirectWithError(request, 'google_not_configured')
  }

  const expectedState = request.cookies.get(YOUTUBE_OAUTH_STATE_COOKIE)?.value
  const state = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')
  const oauthError = request.nextUrl.searchParams.get('error')

  if (oauthError) {
    return redirectWithError(request, oauthError)
  }

  if (!expectedState || !state || expectedState !== state || !code) {
    return redirectWithError(request, 'invalid_state')
  }

  const baseUrl = adminBaseUrl(request)
  const redirectUri = new URL('/api/youtube/callback', baseUrl)

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
    return redirectWithError(request, 'token_exchange_failed')
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string
    refresh_token?: string
    id_token?: string
  }

  if (!tokenData.access_token) {
    return redirectWithError(request, 'missing_access_token')
  }
  if (!tokenData.refresh_token) {
    return redirectWithError(request, 'missing_refresh_token')
  }

  // Prefer email from session (already allowlisted). Optionally verify id_token.
  const email = session.email.toLowerCase()
  if (!isAllowedAdminEmail(email)) {
    return redirectWithError(request, 'email_not_allowed')
  }

  try {
    const channel = await fetchMineChannelWithAccessToken(tokenData.access_token)
    await saveYoutubeConnection({
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      refreshToken: tokenData.refresh_token,
      connectedByEmail: email,
    })
    clearYoutubeAccessTokenCache()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'channel_lookup_failed'
    return redirectWithError(request, message.slice(0, 80))
  }

  const response = NextResponse.redirect(
    new URL('/video-tools?youtube_connected=1', request.url)
  )
  response.cookies.set({
    name: YOUTUBE_OAUTH_STATE_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
