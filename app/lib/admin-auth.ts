import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const ADMIN_SESSION_COOKIE = 'admin_session'
const ADMIN_OAUTH_STATE_COOKIE = 'admin_oauth_state'
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12
const ADMIN_OAUTH_STATE_TTL_SECONDS = 60 * 10

export type AdminSessionPayload = {
  email: string
  exp: number
}

/** Local `next dev` only — never active when NODE_ENV is production. */
export function getDevBypassAdminSession(): AdminSessionPayload | null {
  if (process.env.NODE_ENV !== 'development') return null
  return {
    email: process.env.ADMIN_DEV_EMAIL?.trim().toLowerCase() || 'dev@localhost',
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  }
}

function getAdminSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim()
  return secret ? secret : null
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeSignatureMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export function createAdminSessionToken(email: string): string | null {
  const secret = getAdminSessionSecret()
  if (!secret) return null
  const payload: AdminSessionPayload = {
    email: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = signPayload(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export function readAdminSession(token: string | null | undefined): AdminSessionPayload | null {
  if (!token) return null
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const secret = getAdminSessionSecret()
  if (!secret) return null

  const expected = signPayload(encodedPayload, secret)
  if (!safeSignatureMatch(signature, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      email?: string
      exp?: number
    }
    if (typeof payload.email !== 'string') return null
    if (typeof payload.exp !== 'number') return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null
    if (!isAllowedAdminEmail(payload.email)) return null
    return { email: payload.email, exp: payload.exp }
  } catch {
    return null
  }
}

export function getAdminSessionFromRequest(request: NextRequest): AdminSessionPayload | null {
  return (
    getDevBypassAdminSession() ??
    readAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
  )
}

export function verifyAdminSession(request: NextRequest): boolean {
  return getAdminSessionFromRequest(request) !== null
}

const SHARED_ADMIN_COOKIE_DOMAIN = '.bostondodgeballleague.com'

function getAppHostname(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!appUrl) return ''
  try {
    return new URL(appUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function isPreviewBoardHost(hostname: string): boolean {
  return (
    hostname.includes('-preview.') ||
    hostname.startsWith('store-preview.') ||
    hostname === 'store-preview.bostondodgeballleague.com'
  )
}

export function getAdminSessionCookieDomain(hostname = getAppHostname()): string | undefined {
  if (hostname !== 'bostondodgeballleague.com' && !hostname.endsWith('.bostondodgeballleague.com')) {
    return undefined
  }
  // Keep preview host-only so preview/prod never share one parent-domain cookie.
  if (isPreviewBoardHost(hostname)) return undefined
  return SHARED_ADMIN_COOKIE_DOMAIN
}

function adminSessionCookieOptions(maxAge: number) {
  const domain = getAdminSessionCookieDomain()
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    ...(domain ? { domain } : {}),
  }
}

/** Next ResponseCookies is keyed by name, so a second same-name set must be appended. */
function appendClearHostOnlyAdminSessionCookie(response: NextResponse) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  response.headers.append('Set-Cookie', parts.join('; '))
}

export function setAdminSessionCookie(response: NextResponse, email: string): boolean {
  const token = createAdminSessionToken(email)
  if (!token) return false
  const domain = getAdminSessionCookieDomain()
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    ...adminSessionCookieOptions(ADMIN_SESSION_TTL_SECONDS),
  })
  // Drop any leftover host-only cookie when moving to the shared parent domain.
  if (domain) appendClearHostOnlyAdminSessionCookie(response)
  return true
}

export function clearAdminSessionCookie(response: NextResponse) {
  const domain = getAdminSessionCookieDomain()
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    ...adminSessionCookieOptions(0),
  })
  // Also clear a host-only cookie in case a pre-SSO session remains.
  if (domain) appendClearHostOnlyAdminSessionCookie(response)
}

export function createOAuthState(): string {
  return randomBytes(24).toString('base64url')
}

export function setAdminOAuthStateCookie(response: NextResponse, state: string) {
  response.cookies.set({
    name: ADMIN_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_OAUTH_STATE_TTL_SECONDS,
  })
}

export function readAdminOAuthState(request: NextRequest): string | null {
  return request.cookies.get(ADMIN_OAUTH_STATE_COOKIE)?.value ?? null
}

export function clearAdminOAuthStateCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_OAUTH_STATE_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

function adminEmailAllowlist(): Set<string> | null {
  const allowed = process.env.ADMIN_ALLOWED_EMAILS?.trim()
  if (!allowed) {
    if (process.env.VERCEL_ENV === 'production') return new Set()
    return null
  }
  return new Set(
    allowed
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isAdminAllowlistConfigured(): boolean {
  const whitelist = adminEmailAllowlist()
  return whitelist !== null && whitelist.size > 0
}

export function isAllowedAdminEmail(email: string): boolean {
  const whitelist = adminEmailAllowlist()
  if (whitelist === null) return true
  return whitelist.has(email.toLowerCase())
}

const DEFAULT_LOGIN_WATCH_EMAILS = ['lburleson@gmail.com']
const DEFAULT_LOGIN_ALERT_TO = 'jdoherty513@gmail.com'

function adminLoginWatchEmails(): Set<string> {
  const raw = process.env.ADMIN_LOGIN_WATCH_EMAILS?.trim()
  const list = raw
    ? raw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_LOGIN_WATCH_EMAILS
  return new Set(list)
}

export function isWatchedAdminLoginEmail(email: string): boolean {
  return adminLoginWatchEmails().has(email.trim().toLowerCase())
}

function adminLoginAlertFrom(): string | null {
  const from =
    process.env.ADMIN_LOGIN_ALERT_FROM?.trim() ||
    process.env.NOTIFY_FROM_EMAIL?.trim() ||
    process.env.ORDER_RECEIPT_FROM?.trim() ||
    process.env.CONTACT_EMAIL_FROM?.trim()
  return from || null
}

/** Log + email (Resend) when a watched address hits Google admin login. */
export async function alertWatchedAdminLoginAttempt(
  email: string,
  details: { app: string; allowed: boolean }
): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!isWatchedAdminLoginEmail(normalized)) return

  const to = process.env.ADMIN_LOGIN_ALERT_TO?.trim() || DEFAULT_LOGIN_ALERT_TO
  const host = process.env.NEXT_PUBLIC_APP_URL?.trim() || details.app
  const subject = `[BDL Admin] Login attempt by ${normalized}`
  const text = [
    'Watched admin login attempt',
    `Email: ${normalized}`,
    `App: ${details.app}`,
    `Host: ${host}`,
    `Allowed: ${details.allowed}`,
    `Time: ${new Date().toISOString()}`,
    `VERCEL_ENV: ${process.env.VERCEL_ENV ?? 'unknown'}`,
  ].join('\n')

  console.error('[admin-auth] WATCHED_LOGIN_ATTEMPT', {
    email: normalized,
    app: details.app,
    allowed: details.allowed,
    alertTo: to,
  })

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = adminLoginAlertFrom()
  if (!apiKey || !from) {
    console.error(
      '[admin-auth] WATCHED_LOGIN_ATTEMPT email skipped (RESEND_API_KEY or from address not configured)'
    )
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(
        '[admin-auth] WATCHED_LOGIN_ATTEMPT email failed',
        res.status,
        body.slice(0, 300)
      )
    }
  } catch (err) {
    console.error('[admin-auth] WATCHED_LOGIN_ATTEMPT email error', err)
  }
}

export function adminUnauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
