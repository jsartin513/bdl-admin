import { NextRequest } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  readAdminSession,
  isPreviewBoardHost,
  getAdminSessionCookieDomain,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  createOAuthState,
  setAdminOAuthStateCookie,
  readAdminOAuthState,
  clearAdminOAuthStateCookie,
  isAdminAllowlistConfigured,
  isAllowedAdminEmail,
  adminUnauthorizedResponse,
  type AdminSessionPayload,
} from '@bdl/admin-auth'

export {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  readAdminSession,
  isPreviewBoardHost,
  getAdminSessionCookieDomain,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  createOAuthState,
  setAdminOAuthStateCookie,
  readAdminOAuthState,
  clearAdminOAuthStateCookie,
  isAdminAllowlistConfigured,
  isAllowedAdminEmail,
  adminUnauthorizedResponse,
}

export type { AdminSessionPayload }

/** Local `next dev` only — never active when NODE_ENV is production. */
export function getDevBypassAdminSession(): AdminSessionPayload | null {
  if (process.env.NODE_ENV !== 'development') return null
  return {
    email: process.env.ADMIN_DEV_EMAIL?.trim().toLowerCase() || 'dev@localhost',
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
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
