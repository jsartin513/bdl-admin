'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'
import { fetchAdminSession, logoutAdminSession } from '@/app/lib/admin-client-auth'
import BoardAppsMenu from '@/app/components/BoardAppsMenu'

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { devMode, setDevMode } = useDevMode()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (pathname === '/login') return
    void fetchAdminSession().then((session) => {
      setEmail(session?.email ?? null)
    })
  }, [pathname])

  if (pathname === '/login') {
    return null
  }

  async function handleLogout() {
    await logoutAdminSession()
    setEmail(null)
    router.replace('/login')
  }

  return (
    <nav className="bg-gray-800 text-blue-300 p-4 flex flex-wrap justify-between items-center gap-3">
      <div className="flex flex-wrap space-x-4 items-center">
        <Link href={withDevMode('/schedules', devMode)} className="hover:underline">
          League Schedules
        </Link>
        <Link href={withDevMode('/create-league', devMode)} className="hover:underline">
          Create League
        </Link>
        <Link href={withDevMode('/open-gym', devMode)} className="hover:underline">
          Open Gym
        </Link>
        <Link href={withDevMode('/players', devMode)} className="hover:underline">
          Players
        </Link>
        {devMode && (
          <>
            <Link href={withDevMode('/tournament', devMode)} className="hover:underline">
              Tournament Audio
            </Link>
            <Link
              href={withDevMode('/tournament/team-schedules', devMode)}
              className="hover:underline"
            >
              Team Schedules
            </Link>
            <Link href={withDevMode('/tournament/scoresheets', devMode)} className="hover:underline">
              Scoresheets
            </Link>
          </>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <BoardAppsMenu currentApp="admin" />
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span>Dev mode</span>
          <input
            type="checkbox"
            checked={devMode}
            onChange={(e) => setDevMode(e.target.checked)}
            className="rounded border-gray-500"
          />
        </label>
        {email ? (
          <>
            <span className="text-gray-300 truncate max-w-[200px]" title={email}>
              {email}
            </span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="hover:underline text-blue-300"
            >
              Log out
            </button>
          </>
        ) : null}
      </div>
    </nav>
  )
}
