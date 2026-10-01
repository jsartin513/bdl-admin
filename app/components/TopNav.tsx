'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'
import { fetchAdminSession, logoutAdminSession } from '@/app/lib/admin-client-auth'
import BoardAppsMenu from '@/app/components/BoardAppsMenu'
import { ThemeToggle } from '@/app/components/ThemeToggle'
import { Tooltip } from '@/app/components/ui'
import type { AdminNotificationRecord } from '@/app/lib/video-tools/types'
import {
  navEntriesForGroup,
  type FeatureEntry,
} from '@/app/lib/feature-maturity'

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
          className="absolute left-0 mt-1 w-56 rounded-md bg-gray-700 py-1 shadow-lg ring-1 ring-gray-600 z-50"
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

function IncompleteBadge({ note }: { note?: string }) {
  return (
    <Tooltip
      label="Incomplete feature"
      content={
        note ??
        'This feature is still evolving. Expect rough edges or missing ops setup.'
      }
    >
      <span className="ml-1 rounded border border-amber-400/70 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
        Incomplete
      </span>
    </Tooltip>
  )
}

function FeatureNavLink({
  entry,
  devMode,
  className,
}: {
  entry: FeatureEntry
  devMode: boolean
  className: string
}) {
  return (
    <Link href={withDevMode(entry.href, devMode)} className={className}>
      <span className="inline-flex items-center">
        {entry.label}
        {entry.maturity === 'incomplete' ? (
          <IncompleteBadge note={entry.note} />
        ) : null}
      </span>
    </Link>
  )
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
      await fetch(`/api/admin/notifications/${id}/read`, { method: 'POST' })
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      )
      setUnreadCount((c) => Math.max(0, c - 1))
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
        className="relative hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
      >
        Notifications
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto rounded-md bg-gray-700 py-1 shadow-lg ring-1 ring-gray-600 z-50"
        >
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-300">No notifications</p>
          ) : (
            <ul>
              {notifications.map((n) => {
                const unread = !n.readAt
                const href = n.href
                  ? withDevMode(n.href, devMode)
                  : null
                const content = (
                  <>
                    <span
                      className={`block text-sm ${unread ? 'font-semibold text-white' : 'text-gray-200'}`}
                    >
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="mt-0.5 block text-xs text-gray-400">
                        {n.body}
                      </span>
                    ) : null}
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

  const leagueLinks = navEntriesForGroup('leagues', devMode)
  const mainLinks = navEntriesForGroup('main', devMode)
  const developerLinks = navEntriesForGroup('developer', devMode)

  const topLinkClass =
    'hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

  return (
    <nav
      aria-label="Main"
      className="admin-chrome bg-gray-800 text-blue-100 p-4 flex flex-wrap justify-between items-center gap-3"
    >
      <div className="flex flex-wrap space-x-4 items-center">
        {leagueLinks.length > 0 ? (
          <NavDropdown label="Leagues">
            {leagueLinks.map((entry) => (
              <FeatureNavLink
                key={entry.id}
                entry={entry}
                devMode={devMode}
                className={menuItemClassName()}
              />
            ))}
          </NavDropdown>
        ) : null}
        {mainLinks.map((entry) => (
          <FeatureNavLink
            key={entry.id}
            entry={entry}
            devMode={devMode}
            className={topLinkClass}
          />
        ))}
        {developerLinks.length > 0 ? (
          <NavDropdown label="Developer">
            {developerLinks.map((entry) => (
              <FeatureNavLink
                key={entry.id}
                entry={entry}
                devMode={devMode}
                className={menuItemClassName()}
              />
            ))}
          </NavDropdown>
        ) : null}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <ThemeToggle />
        <NotificationsBell enabled={Boolean(email)} devMode={devMode} />
        <Link
          href={withDevMode('/whats-new', devMode)}
          className={`${topLinkClass} text-blue-100`}
        >
          What&apos;s New
        </Link>
        <Link
          href={withDevMode('/request-feature', devMode)}
          className={`${topLinkClass} text-blue-100`}
        >
          Request a feature
        </Link>
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
                  content="Shows developer-only tools (tournament audio, scoresheets, game timer) and keeps incomplete board tools labeled in the nav."
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
