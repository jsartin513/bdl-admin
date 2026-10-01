'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { EventLiveDraftSection } from '@/app/components/events/EventLiveDraftSection'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'
import type { EventRecord } from '@/app/lib/events/types'

export default function EventLiveDraftPage() {
  const params = useParams<{ id: string }>()
  const eventId = params.id
  const { devMode } = useDevMode()
  const [event, setEvent] = useState<EventRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}`)
        if (!res.ok) throw new Error('Event not found')
        const body = (await res.json()) as { event: EventRecord }
        setEvent(body.event)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load event')
      }
    })()
  }, [eventId])

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-red-700">{error}</div>
    )
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-gray-600">Loading…</div>
    )
  }

  if (event.eventFormat !== 'draft') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-gray-700">
          Captain live draft is only for events with format <strong>Draft</strong>.
        </p>
        <Link
          href={withDevMode(`/events/${eventId}`, devMode)}
          className="mt-4 inline-block text-sm text-blue-600 underline"
        >
          Back to event
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href={withDevMode(`/events/${eventId}`, devMode)}
        className="text-sm text-blue-600 underline"
      >
        ← {event.name}
      </Link>
      <EventLiveDraftSection eventId={eventId} eventFormat={event.eventFormat} devMode={devMode} />
    </div>
  )
}
