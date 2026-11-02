'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'
import { getChangelogEntriesNewestFirst } from '@/app/changelog/entries'

export default function WhatsNewPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <WhatsNewContent />
    </Suspense>
  )
}

function WhatsNewContent() {
  const { devMode } = useDevMode()
  const entries = getChangelogEntriesNewestFirst()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">What&apos;s New</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Board-facing changes in League Admin. Incomplete tools stay labeled in
            the nav; developer-only tools appear when Dev mode is on.
          </p>
        </div>
        <Link
          href={withDevMode('/request-feature', devMode)}
          className="text-sm font-medium text-blue-600 underline dark:text-blue-400"
        >
          Request a feature
        </Link>
      </div>

      <ol className="mt-8 space-y-6">
        {entries.map((entry) => (
          <li
            key={`${entry.date}-${entry.title}`}
            className="border-b border-border pb-6 last:border-0"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <time dateTime={entry.date}>{entry.date}</time>
              {entry.version ? (
                <span className="ml-2 normal-case tracking-normal">
                  · {entry.version}
                </span>
              ) : null}
            </p>
            <h2 className="mt-1 text-lg font-medium text-foreground">
              {entry.href ? (
                <Link
                  href={withDevMode(entry.href, devMode)}
                  className="hover:underline"
                >
                  {entry.title}
                </Link>
              ) : (
                entry.title
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{entry.summary}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
