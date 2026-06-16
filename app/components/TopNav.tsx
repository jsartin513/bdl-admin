'use client'

import Link from 'next/link'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'

export default function TopNav() {
  const { devMode, setDevMode } = useDevMode()

  return (
    <nav className="bg-gray-800 text-blue-300 p-4 flex justify-between items-center">
      <div className="flex space-x-4 items-center">
        <Link href={withDevMode('/schedules', devMode)} className="hover:underline">
          League Schedules
        </Link>
        <Link href={withDevMode('/create-league', devMode)} className="hover:underline">
          Create League
        </Link>
        <Link href={withDevMode('/open-gym', devMode)} className="hover:underline">
          Open Gym
        </Link>
        {devMode && (
          <>
            <Link href={withDevMode('/tournament', devMode)} className="hover:underline">
              Tournament Audio
            </Link>
            <Link href={withDevMode('/tournament/team-schedules', devMode)} className="hover:underline">
              Team Schedules
            </Link>
            <Link href={withDevMode('/tournament/scoresheets', devMode)} className="hover:underline">
              Scoresheets
            </Link>
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
