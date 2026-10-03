import { NextRequest, NextResponse } from 'next/server'
import { DEV_MODE_PARAM, isDevMode } from '@/app/lib/devMode'

/** Commissioner live-draft tools are Dev-mode-only on admin. */
export function isAdminDevModeRequest(request: NextRequest): boolean {
  return isDevMode(request.nextUrl.searchParams)
}

export function adminDevModeRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        'Captain live draft requires Dev mode. Enable Dev mode in the nav or open with ?dev=1.',
    },
    { status: 403 }
  )
}

export function devModeQuerySuffix(devMode: boolean): string {
  if (!devMode) return ''
  return `?${DEV_MODE_PARAM}=1`
}
