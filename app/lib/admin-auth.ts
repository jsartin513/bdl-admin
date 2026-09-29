import type { NextRequest } from 'next/server'
import {
  getAdminSessionFromRequest as getAdminSessionFromRequestBase,
  type AdminSessionPayload,
} from '@bdl/admin-auth'

export type { AdminSessionPayload } from '@bdl/admin-auth'
export {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_PREVIEW_COOKIE,
  ADMIN_OAUTH_STATE_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  adminUnauthorizedResponse,
  alertWatchedAdminLoginAttempt,
  clearAdminOAuthStateCookie,
  clearAdminSessionCookie,
  createAdminSessionToken,
  createOAuthState,
  getAdminSessionCookieDomain,
  getAdminSessionCookieName,
  isAdminAllowlistConfigured,
  isAllowedAdminEmail,
  isPreviewBoardHost,
  isWatchedAdminLoginEmail,
  readAdminOAuthState,
  readAdminSession,
  setAdminOAuthStateCookie,
  setAdminSessionCookie,
} from '@bdl/admin-auth'

const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12

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
    getDevBypassAdminSession() ?? getAdminSessionFromRequestBase(request)
  )
}

export function verifyAdminSession(request: NextRequest): boolean {
  return getAdminSessionFromRequest(request) !== null
}
