/**
 * Edge-safe admin session verification for middleware (Web Crypto HMAC).
 */

import {
  readAdminSessionEdge as readAdminSessionEdgeBase,
  type AdminSessionPayload,
} from '@bdl/admin-auth/edge'

export {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_PREVIEW_COOKIE,
  getAdminSessionCookieName,
} from '@bdl/admin-auth/edge'

export type { AdminSessionPayload }

function getDevBypassAdminSession(): AdminSessionPayload | null {
  if (process.env.NODE_ENV !== 'development') return null
  return {
    email: process.env.ADMIN_DEV_EMAIL?.trim().toLowerCase() || 'dev@localhost',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  }
}

export async function readAdminSessionEdge(
  token: string | null | undefined
): Promise<AdminSessionPayload | null> {
  const bypass = getDevBypassAdminSession()
  if (bypass) return bypass
  return readAdminSessionEdgeBase(token)
}
