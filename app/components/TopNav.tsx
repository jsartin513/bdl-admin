'use client'

import Link from 'next/link'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'

export default function TopNav() {
  const { devMode, setDevMode } = useDevMode()

  const link = (href: string, label: string) => (
    <Link href={withDevMode(href, devMode)} className="hover:underline">
      {label}
    </Link>
  )

  return (
    <nav className="bg-gray-800 text-blue-300 p-4 flex justify-between items-center">
      <div className="flex space-x-4 items-center">
        {link('/schedules', 'League Schedules')}
        {link('/create-league', 'Create League')}
        {link('/open-gym', 'Open Gym')}
        {devMode && (
          <>
            {link('/tournament', 'Tournament Audio')}
            {link('/tournament/team-schedules', 'Team Schedules')}
          </>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <span>Dev mode</span>
        <input
          type="checkbox"
          checked={devMode}
          onChange={(e) => setDevMode(e.target.checked)}
          className="rounded border-gray-500"
        />
      </label>
    </nav>
  )
}
