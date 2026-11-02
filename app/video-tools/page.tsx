'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import type { VideoUploadSetListItem } from '@/app/lib/video-tools/types'

function formatDisplayDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'complete':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'processing':
    case 'queued':
      return 'bg-amber-100 text-amber-900'
    case 'uploading':
    case 'ready':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export default function VideoToolsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="mx-auto max-w-5xl p-6 text-sm text-gray-600"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          Loading…
        </div>
      }
    >
      <VideoToolsPageContent />
    </Suspense>
  )
}

function VideoToolsPageContent() {
  const { devMode } = useDevMode()
  const [sets, setSets] = useState<VideoUploadSetListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSets = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/video-tools/sets')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load upload sets')
      setSets(data.sets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load upload sets')
    } finally {
      if (!opts?.quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSets()
  }, [loadSets])

  useEffect(() => {
    const hasActive = sets.some((s) =>
      ['uploading', 'queued', 'processing'].includes(s.status)
    )
    if (!hasActive) return
    const id = setInterval(() => {
      void loadSets({ quiet: true })
    }, 8000)
    return () => clearInterval(id)
  }, [sets, loadSets])

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Video Tools</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload GoPro clips per court or session, then merge into one untrimmed
            video. Turn on auto-start merge to set-and-forget after uploads; you
            will get an in-app notification when merge finishes.
          </p>
        </div>
        <Link
          href={withDevMode('/video-tools/new', devMode)}
          className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          New upload set
        </Link>
      </div>

      {error && (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-600" role="status" aria-live="polite">
          Loading…
        </p>
      ) : sets.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 px-4 py-10 text-center">
          <p className="text-sm text-gray-600">No upload sets yet.</p>
          <Link
            href={withDevMode('/video-tools/new', devMode)}
            className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
          >
            Create the first set
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {sets.map((set) => (
            <li key={set.id}>
              <Link
                href={withDevMode(`/video-tools/${set.id}`, devMode)}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
              >
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {set.displayTitle}
                  </div>
                  <div className="mt-0.5 text-sm text-gray-600">
                    {formatDisplayDate(set.eventDate)} · {set.clipCount} clip
                    {set.clipCount === 1 ? '' : 's'} · {set.createdByEmail}
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(set.status)}`}
                >
                  {set.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
