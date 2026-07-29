'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'
import { fetchAdminSession, logoutAdminSession } from '@/app/lib/admin-client-auth'
import BoardAppsMenu from '@/app/components/BoardAppsMenu'
import { Tooltip } from '@/app/components/ui'

function NavDropdown({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        aria-label={`${label} menu`}
      >
        {label} ▾
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute left-0 mt-1 w-52 rounded-md bg-gray-700 py-1 shadow-lg ring-1 ring-gray-600 z-50"
        >
          {children}
        </div>
      )}
    </div>
  )
}

function menuItemClassName() {
  return 'block px-3 py-2 text-sm text-gray-100 hover:bg-gray-600 focus-visible:bg-gray-600 focus-visible:outline-none'
}

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
    <nav
      aria-label="Main"
      className="bg-gray-800 text-blue-100 p-4 flex flex-wrap justify-between items-center gap-3"
    >
      <div className="flex flex-wrap space-x-4 items-center">
        <NavDropdown label="Leagues">
          <Link
            href={withDevMode('/schedules', devMode)}
            className={menuItemClassName()}
          >
            View Schedule
          </Link>
          <Link
            href={withDevMode('/create-league', devMode)}
            className={menuItemClassName()}
          >
            Create New Schedule
          </Link>
        </NavDropdown>
        <Link
          href={withDevMode('/open-gym', devMode)}
          className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Open Gym
        </Link>
        <Link
          href={withDevMode('/players', devMode)}
          className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Player Management
        </Link>
        <Link
          href={withDevMode('/events', devMode)}
          className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Events
        </Link>
        <Link
          href={withDevMode('/video-tools', devMode)}
          className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Video Tools
        </Link>
        <Link
          href={withDevMode('/non-bdl-events', devMode)}
          className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Non-BDL Events
        </Link>
        {devMode && (
          <NavDropdown label="Developer">
            <Link
              href={withDevMode('/tournament', devMode)}
              className={menuItemClassName()}
            >
              Tournament Audio
            </Link>
            <Link
              href={withDevMode('/tournament/team-schedules', devMode)}
              className={menuItemClassName()}
            >
              Team Schedules
            </Link>
            <Link
              href={withDevMode('/tournament/scoresheets', devMode)}
              className={menuItemClassName()}
            >
              Scoresheets
            </Link>
          </NavDropdown>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <BoardAppsMenu currentApp="admin" />
        {email ? (
          <>
            <span className="text-gray-200 truncate max-w-[200px]" title={email}>
              {email}
            </span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="inline-flex items-center gap-1">
                Dev mode
                <Tooltip
                  label="About Dev mode"
                  content="Shows developer-only tools such as tournament audio and scoresheet generators."
                />
              </span>
              <input
                type="checkbox"
                checked={devMode}
                onChange={(e) => setDevMode(e.target.checked)}
                className="rounded border-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="hover:underline text-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Log out
            </button>
          </>
        ) : null}
      </div>
    </nav>
  )
}
