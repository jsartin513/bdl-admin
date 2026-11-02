'use client'

import { usePathname } from 'next/navigation'
import { incompleteFeatureForPath } from '@/app/lib/feature-maturity'

/**
 * Amber banner for routes registered as incomplete in the feature maturity registry.
 */
export default function IncompleteBanner() {
  const pathname = usePathname()
  const feature = incompleteFeatureForPath(pathname)
  if (!feature) return null

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <span className="font-medium">Incomplete:</span>{' '}
      {feature.note ??
        `${feature.label} is still evolving. Expect rough edges or missing ops setup.`}
    </div>
  )
}
