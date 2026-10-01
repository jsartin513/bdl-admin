'use client'

import { useSyncExternalStore } from 'react'
import { getBoardAppCatalog, type BoardAppId } from '@bdl/board-apps'

const CURRENT_APP: BoardAppId = 'admin'

function subscribeHostname() {
  return () => {}
}

function getHostnameSnapshot() {
  return window.location.hostname
}

function getHostnameServerSnapshot() {
  return ''
}

export default function BoardAppsHelpPage() {
  const hostname = useSyncExternalStore(
    subscribeHostname,
    getHostnameSnapshot,
    getHostnameServerSnapshot
  )
  const catalog = getBoardAppCatalog(hostname)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">Board applications</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        BDL tools for league operations, commerce, and the public website. Open another app or stay here.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        In League Admin:{' '}
        <a href="/whats-new" className="text-blue-600 underline dark:text-blue-400">
          What&apos;s New
        </a>
        {' · '}
        <a
          href="/request-feature"
          className="text-blue-600 underline dark:text-blue-400"
        >
          Request a feature
        </a>
        . Incomplete tools are labeled in the nav; enable Dev mode for developer-only tools.
      </p>
      <ul className="mt-8 space-y-4">
        {catalog.map((app) => {
          const isCurrent = app.id === CURRENT_APP
          return (
            <li
              key={app.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              {isCurrent ? (
                <div>
                  <p className="font-medium text-foreground">
                    {app.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(this app)</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
                </div>
              ) : (
                <a href={app.href} className="block hover:opacity-90">
                  <p className="font-medium text-blue-600 dark:text-blue-400">{app.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
