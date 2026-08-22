'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import {
  BALL_TYPES,
  EVENT_FORMATS,
  EVENT_GENDERS,
  EVENT_TYPES,
  type EventListItem,
} from '@/app/lib/events/types'
import { Dialog, FieldHelp, LiveMessage, Tooltip } from '@/app/components/ui'

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

export default function EventsPage() {
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
      <EventsPageContent />
    </Suspense>
  )
}

function EventsPageContent() {
  const { devMode } = useDevMode()
  const [events, setEvents] = useState<EventListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventType, setEventType] = useState<string>('tournament')
  const [eventFormat, setEventFormat] = useState<string>('')
  const [ballType, setBallType] = useState<string>('foam')
  const [gender, setGender] = useState<string>('mixed')
  const [notes, setNotes] = useState('')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/events')
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

  async function createEvent() {
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          eventDate,
          eventType,
          eventFormat: eventFormat || null,
          ballType,
          gender,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')
      setCreateOpen(false)
      setName('')
      setEventDate('')
      setEventType('tournament')
      setEventFormat('')
      setBallType('foam')
      setGender('mixed')
      setNotes('')
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
          <h1 className="text-2xl font-semibold">Events</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track registrations per event for team-making and historical insights.
          </p>
          <FieldHelp>
            Create an event, import a TeamLinkt CSV, then use draft mode to build teams.
          </FieldHelp>
        </div>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          onClick={() => {
            setCreateOpen(true)
            setFormError(null)
          }}
        >
          New event
        </button>
      </div>

      {error ? (
        <LiveMessage variant="alert" className="text-sm text-red-600">
          {error}
        </LiveMessage>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-600" role="status" aria-live="polite" aria-busy="true">
          Loading…
        </p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-600">
          No events yet. Create one (e.g. August 8 tournament) to import TeamLinkt
          registrations.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Events list</caption>
            <thead className="bg-gray-50 text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Date</th>
                <th scope="col" className="px-3 py-2 font-medium">Name</th>
                <th scope="col" className="px-3 py-2 font-medium">Type</th>
                <th scope="col" className="px-3 py-2 font-medium">Format</th>
                <th scope="col" className="px-3 py-2 font-medium">Ball</th>
                <th scope="col" className="px-3 py-2 font-medium">Gender</th>
                <th scope="col" className="px-3 py-2 font-medium">Registrations</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDisplayDate(event.eventDate)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={withDevMode(`/events/${event.id}`, devMode)}
                      className="text-blue-700 hover:underline font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {event.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{event.eventTypeLabel}</td>
                  <td className="px-3 py-2">{event.eventFormatLabel ?? '—'}</td>
                  <td className="px-3 py-2">{event.ballTypeLabel}</td>
                  <td className="px-3 py-2">{event.genderLabel}</td>
                  <td className="px-3 py-2">{event.registrationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New event"
        className="max-w-md"
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-gray-600">Name</span>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="August 8 Tournament"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Date</span>
            <input
              type="date"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              Type
              <Tooltip
                label="About event type"
                content="Tournament, league, open gym, or other — used for filtering and history."
              />
            </span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {Object.entries(EVENT_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              Format
              <Tooltip
                label="About event format"
                content="BYOT, Remix, or Draft — labels how teams are formed. Does not change team-maker rules by itself."
              />
            </span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              value={eventFormat}
              onChange={(e) => setEventFormat(e.target.value)}
            >
              <option value="">Not set</option>
              {Object.entries(EVENT_FORMATS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              Ball
              <Tooltip
                label="About ball type"
                content="Foam or cloth — affects how you group historical comparisons."
              />
            </span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
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
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              Gender
              <Tooltip
                label="About event gender"
                content="Mixed, men, or women/NB/O — describes who the event is open to."
              />
            </span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              {Object.entries(EVENT_GENDERS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Notes (optional)</span>
            <textarea
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {formError ? (
            <LiveMessage variant="alert" className="text-sm text-red-600">
              {formError}
            </LiveMessage>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !name.trim() || !eventDate}
              className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              onClick={() => void createEvent()}
            >
              Create
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
