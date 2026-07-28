'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import {
  BALL_TYPES,
  HOME_LEAGUES,
  type NonBdlEventListItem,
} from '@/app/lib/non-bdl-events/types'

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

export default function NonBdlEventsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl p-6 text-sm text-gray-600">Loading…</div>
      }
    >
      <NonBdlEventsPageContent />
    </Suspense>
  )
}

function NonBdlEventsPageContent() {
  const { devMode } = useDevMode()
  const [events, setEvents] = useState<NonBdlEventListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [ballType, setBallType] = useState('foam')
  const [division, setDivision] = useState('')
  const [city, setCity] = useState('')
  const [hostOrgHomeLeague, setHostOrgHomeLeague] = useState('')
  const [hostOrgName, setHostOrgName] = useState('')
  const [notes, setNotes] = useState('')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/non-bdl-events')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load events')
      setEvents(data.events)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  function resetForm() {
    setName('')
    setEventDate('')
    setBallType('foam')
    setDivision('')
    setCity('')
    setHostOrgHomeLeague('')
    setHostOrgName('')
    setNotes('')
  }

  async function createEvent() {
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/non-bdl-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          eventDate,
          ballType,
          division: division.trim() || null,
          city: city.trim() || null,
          hostOrgHomeLeague: hostOrgHomeLeague || null,
          hostOrgName: hostOrgName.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')
      setCreateOpen(false)
      resetForm()
      await loadEvents()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6 text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Non-BDL Events</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track travel tournaments — who&apos;s going, which teams, results, and
            website story drafts.
          </p>
        </div>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
          onClick={() => {
            setCreateOpen(true)
            setFormError(null)
          }}
        >
          New travel event
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-600">
          No travel events yet. Add one to track players heading to another
          league&apos;s tournament.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">Host</th>
                <th className="px-3 py-2 font-medium">Ball</th>
                <th className="px-3 py-2 font-medium">Players</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDisplayDate(event.eventDate)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={withDevMode(`/non-bdl-events/${event.id}`, devMode)}
                      className="text-blue-700 hover:underline font-medium"
                    >
                      {event.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{event.city || '—'}</td>
                  <td className="px-3 py-2">{event.hostOrgLabel}</td>
                  <td className="px-3 py-2">{event.ballTypeLabel}</td>
                  <td className="px-3 py-2">{event.attendeeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">New travel event</h2>
            <label className="block text-sm">
              <span className="text-gray-600">Name</span>
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Philly Foam Classic"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Date</span>
              <input
                type="date"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-600">Ball</span>
                <select
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  value={ballType}
                  onChange={(e) => setBallType(e.target.value)}
                >
                  {Object.entries(BALL_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">Division</span>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  placeholder="Open, Mixed…"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-gray-600">City</span>
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Philadelphia"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Host org (known league)</span>
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={hostOrgHomeLeague}
                onChange={(e) => setHostOrgHomeLeague(e.target.value)}
              >
                <option value="">— None / use free text —</option>
                {Object.entries(HOME_LEAGUES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Host org (free text)</span>
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={hostOrgName}
                onChange={(e) => setHostOrgName(e.target.value)}
                placeholder="Required if no known league selected"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Notes (optional)</span>
              <textarea
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => setCreateOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => void createEvent()}
                disabled={saving || !name.trim() || !eventDate}
              >
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
