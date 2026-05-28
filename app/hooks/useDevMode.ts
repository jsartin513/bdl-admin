'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DEV_MODE_PARAM, isDevMode } from '@/app/lib/devMode'

export function useDevMode() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const devMode = isDevMode(searchParams)

  const setDevMode = useCallback(
    (on: boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      if (on) params.set(DEV_MODE_PARAM, '1')
      else params.delete(DEV_MODE_PARAM)
      const q = params.toString()
      router.replace(q ? `${pathname}?${q}` : pathname)
    },
    [pathname, router, searchParams]
  )

  return { devMode, setDevMode }
}
