import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  readAdminSessionEdge,
} from '@/app/lib/admin-session-edge'

function isPublicPath(pathname: string): boolean {
  if (pathname === '/login') return true
  if (pathname === '/api/admin/google/login') return true
  if (pathname === '/api/admin/google/callback') return true
  // Allow session probe + logout without a valid cookie (401 / clear cookie).
  if (pathname === '/api/admin/session') return true
  if (pathname === '/api/admin/logout') return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  const session = await readAdminSessionEdge(token)

  if (session) {
    return NextResponse.next()
  }

  const isApi = pathname.startsWith('/api/')
  if (isApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  const nextPath = `${pathname}${request.nextUrl.search}`
  if (nextPath && nextPath !== '/') {
    loginUrl.searchParams.set('next', nextPath)
  }
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next internals and common static files.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
