'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'
import { fetchAdminSession, logoutAdminSession } from '@/app/lib/admin-client-auth'
import BoardAppsMenu from '@/app/components/BoardAppsMenu'
import { Tooltip } from '@/app/components/ui'
import type { AdminNotificationRecord } from '@/app/lib/video-tools/types'

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

function NotificationsBell({
  enabled,
  devMode,
}: {
  enabled: boolean
  devMode: boolean
}) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotificationRecord[]>(
    []
  )
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch('/api/admin/notifications?limit=15')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(Number(data.unreadCount) || 0)
    } catch {
      // ignore poll errors
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void load()
    const id = setInterval(() => void load(), 30000)
    return () => clearInterval(id)
  }, [enabled, load])

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

  async function markRead(id: string) {
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' }),
      })
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(Number(data.unreadCount) || 0)
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: data.notification?.readAt ?? new Date() } : n
        )
      )
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(Number(data.unreadCount) || 0)
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() }))
      )
    } catch {
      // ignore
    }
  }

  if (!enabled) return null

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void load()
        }}
        className="relative rounded px-2 py-1 hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
      >
        <span aria-hidden="true">Alerts</span>
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-gray-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute right-0 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-md bg-gray-700 py-1 shadow-lg ring-1 ring-gray-600 z-50"
          role="menu"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-600 px-3 py-2">
            <span className="text-sm font-medium text-gray-100">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-blue-200 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-300">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((n) => {
                const href = n.href
                  ? withDevMode(n.href, devMode)
                  : null
                const unread = !n.readAt
                const content = (
                  <>
                    <div
                      className={`text-sm ${unread ? 'font-semibold text-white' : 'text-gray-100'}`}
                    >
                      {n.title}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-300 line-clamp-2">
                      {n.body}
                    </div>
                  </>
                )
                return (
                  <li key={n.id} className="border-b border-gray-600 last:border-0">
                    {href ? (
                      <Link
                        href={href}
                        className="block px-3 py-2 hover:bg-gray-600"
                        onClick={() => {
                          if (unread) void markRead(n.id)
                          setOpen(false)
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-600"
                        onClick={() => {
                          if (unread) void markRead(n.id)
                        }}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
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
        <NotificationsBell enabled={Boolean(email)} devMode={devMode} />
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
