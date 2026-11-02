'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'

export default function NewVideoUploadSetPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg p-6 text-sm text-gray-600">Loading…</div>
      }
    >
      <NewVideoUploadSetContent />
    </Suspense>
  )
}

function NewVideoUploadSetContent() {
  const router = useRouter()
  const { devMode } = useDevMode()
  const [eventName, setEventName] = useState('')
  const [label, setLabel] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/video-tools/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName, label, eventDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create upload set')
      router.push(withDevMode(`/video-tools/${data.set.id}`, devMode))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create upload set')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="mb-6">
        <Link
          href={withDevMode('/video-tools', devMode)}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Video Tools
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">New upload set</h1>
        <p className="mt-1 text-sm text-gray-600">
          One set = one court or camera session (for example Court 1). Create
          another set for Court 2 so both can upload at the same time.
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <div>
          <label htmlFor="eventName" className="block text-sm font-medium text-gray-800">
            Event name
          </label>
          <input
            id="eventName"
            type="text"
            required
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="BDL Season 7: Summer Remix"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div>
          <label htmlFor="label" className="block text-sm font-medium text-gray-800">
            Label (court / session)
          </label>
          <input
            id="label"
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Court 1"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div>
          <label htmlFor="eventDate" className="block text-sm font-medium text-gray-800">
            Event date
          </label>
          <input
            id="eventDate"
            type="date"
            required
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {error && (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {saving ? 'Creating…' : 'Create set'}
          </button>
          <Link
            href={withDevMode('/video-tools', devMode)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
