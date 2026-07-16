'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getBoardAppLinks, type BoardAppId } from '@/app/lib/board-apps'

type BoardAppsMenuProps = {
  currentApp: BoardAppId
  className?: string
  linkClassName?: string
  menuClassName?: string
  buttonClassName?: string
}

function subscribeHostname() {
  return () => {}
}

function getHostnameSnapshot() {
  return window.location.hostname
}

function getHostnameServerSnapshot() {
  return ''
}

export default function BoardAppsMenu({
  currentApp,
  className = '',
  linkClassName = 'block px-3 py-2 text-sm text-gray-200 hover:bg-gray-700',
  menuClassName = 'absolute right-0 mt-1 w-48 rounded-md bg-gray-800 py-1 shadow-lg ring-1 ring-gray-600 z-50',
  buttonClassName = 'hover:underline text-blue-300',
}: BoardAppsMenuProps) {
  const [open, setOpen] = useState(false)
  const hostname = useSyncExternalStore(
    subscribeHostname,
    getHostnameSnapshot,
    getHostnameServerSnapshot
  )
  const links = getBoardAppLinks(currentApp, hostname)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (links.length === 0) return null

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Switch Application
      </button>
      {open ? (
        <div className={menuClassName}>
          {links.map((app) => (
            <a
              key={app.id}
              href={app.href}
              className={linkClassName}
              onClick={() => setOpen(false)}
            >
              {app.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}
