'use client'

import { usePathname } from 'next/navigation'
import { useDevMode } from '@/app/hooks/useDevMode'
import { isDevOnlyRoute } from '@/app/lib/feature-maturity'
import { withDevMode } from '@/app/lib/devMode'

/**
 * Soft guard for developer-only routes. Does not 404; offers one-click Dev mode.
 */
export default function DevOnlyGate({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { devMode, setDevMode } = useDevMode()

  if (!isDevOnlyRoute(pathname) || devMode) {
    return <>{children}</>
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-foreground">Developer tool</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page is hidden from the main board navigation. Enable Dev mode to
        use it, or continue with the link below if you landed here on purpose.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setDevMode(true)}
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Enable Dev mode
        </button>
        <a
          href={withDevMode(pathname, true)}
          className="text-sm text-blue-600 underline dark:text-blue-400"
        >
          Open with ?dev=1
        </a>
      </div>
    </div>
  )
}
