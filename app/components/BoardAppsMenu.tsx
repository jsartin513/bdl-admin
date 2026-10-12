'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { getBoardAppLinks, type BoardAppId } from '@bdl/board-apps'
import { NavHintButton, NavHintLink } from '@/app/components/NavHintLink'

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300'

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
  linkClassName = 'block px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 focus-visible:bg-gray-700 focus-visible:outline-none',
  menuClassName = 'absolute right-0 mt-1 w-72 rounded-md bg-gray-800 py-1 shadow-lg ring-1 ring-gray-600 z-50',
  buttonClassName = 'hover:underline text-blue-100',
}: BoardAppsMenuProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
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
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
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
      <NavHintButton
        buttonRef={buttonRef}
        description="Jump to another board app (player site, website admin, and more)."
        onClick={() => setOpen((value) => !value)}
        className={`${buttonClassName} ${FOCUS_RING}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        aria-label="Switch application menu"
      >
        Switch Application
      </NavHintButton>
      {open ? (
        <div id={panelId} className={menuClassName}>
          {links.map((app) => (
            <NavHintLink
              key={app.id}
              href={app.href}
              className={linkClassName}
              description={app.description}
              onClick={() => setOpen(false)}
            >
              <span className="font-medium">{app.label}</span>
              <span className="mt-0.5 block text-xs font-normal text-gray-400">
                {app.description}
              </span>
            </NavHintLink>
          ))}
          <div className="mt-1 border-t border-gray-600 pt-1">
            <NavHintLink
              href="/whats-new"
              className={linkClassName}
              description="Release notes for recent admin changes."
              onClick={() => setOpen(false)}
            >
              What&apos;s New
            </NavHintLink>
            <NavHintLink
              href="/request-feature"
              className={linkClassName}
              description="Suggest an improvement; opens a GitHub issue or prefilled form."
              onClick={() => setOpen(false)}
            >
              Request a feature
            </NavHintLink>
            <NavHintLink
              href="/help"
              className={linkClassName}
              description="How-to guides and troubleshooting for admin tools."
              onClick={() => setOpen(false)}
            >
              Help
            </NavHintLink>
          </div>
        </div>
      ) : null}
    </div>
  )
}
