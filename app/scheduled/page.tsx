'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import type { ScheduledActionRecord } from '@/app/lib/schedule/types'

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York' })
  } catch {
    return iso
  }
}

export default function ScheduledPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-6 text-sm text-gray-600">Loading…</div>}>
      <ScheduledPageContent />
    </Suspense>
  )
}

function ScheduledPageContent() {
  const { devMode } = useDevMode()
  const [actions, setActions] = useState<ScheduledActionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/scheduled?status=scheduled')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setActions(data.actions ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function cancel(id: string) {
    setCancelling(id)
    try {
      const res = await fetch(`/api/scheduled/${id}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Cancel failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="text-sm">
        <Link href={withDevMode('/', devMode)} className="text-teal-800 underline">
          ← Home
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-gray-900">Scheduled communications</h1>
      <p className="mt-1 text-sm text-gray-600">
        Player contact and website publishes waiting to run (Eastern time). Dispatched every 5
        minutes on Vercel when <code className="text-xs">CRON_SECRET</code> is set.
      </p>

      {error ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-gray-600">Loading…</p>
      ) : actions.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600">Nothing scheduled.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {actions.map((action) => (
            <li
              key={action.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">
                    {action.actionType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-gray-600">Runs {formatWhen(action.runAt)} ET</p>
                  <p className="text-xs text-gray-500">By {action.createdByAdminEmail}</p>
                  {action.actionType === 'publish_post' &&
                  typeof action.payload.publishPostId === 'string' ? (
                    <Link
                      href={withDevMode(
                        `/publish/${action.payload.publishPostId}`,
                        devMode
                      )}
                      className="text-sm text-teal-800 underline"
                    >
                      View publish post
                    </Link>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={cancelling === action.id}
                  onClick={() => void cancel(action.id)}
                >
                  {cancelling === action.id ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
