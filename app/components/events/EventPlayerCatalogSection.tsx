'use client'

import { useEffect, useState } from 'react'
import { Button, FieldHelp, FOCUS_RING } from '@/app/components/ui'

export type EventPlayerCatalogFields = {
  publishedToPlayerApp: boolean
  publicDescription: string | null
  location: string | null
  sessionTimeLabel: string | null
  priceCents: number | null
  capacity: number | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  eventEndDate: string | null
}

type Props = {
  eventId: string
  fields: EventPlayerCatalogFields
  onSaved: (fields: EventPlayerCatalogFields) => void
  onError: (message: string) => void
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function datetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) {
    throw new Error('Registration time is not a valid date')
  }
  return d.toISOString()
}

function centsToDollarsInput(cents: number | null): string {
  if (cents == null) return ''
  return (cents / 100).toFixed(2)
}

function dollarsInputToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number.parseFloat(trimmed)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Price must be a non-negative number')
  }
  return Math.round(n * 100)
}

const inputClass = `mt-1 block w-full rounded border border-[var(--tm-border,#d1d5db)] bg-[var(--tm-surface,#fff)] px-2 py-1.5 text-sm ${FOCUS_RING}`

export function EventPlayerCatalogSection({
  eventId,
  fields,
  onSaved,
  onError,
}: Props) {
  const [published, setPublished] = useState(fields.publishedToPlayerApp)
  const [publicDescription, setPublicDescription] = useState(
    fields.publicDescription ?? ''
  )
  const [location, setLocation] = useState(fields.location ?? '')
  const [sessionTimeLabel, setSessionTimeLabel] = useState(
    fields.sessionTimeLabel ?? ''
  )
  const [priceDollars, setPriceDollars] = useState(
    centsToDollarsInput(fields.priceCents)
  )
  const [capacity, setCapacity] = useState(
    fields.capacity != null ? String(fields.capacity) : ''
  )
  const [registrationOpensAt, setRegistrationOpensAt] = useState(
    toDatetimeLocalValue(fields.registrationOpensAt)
  )
  const [registrationClosesAt, setRegistrationClosesAt] = useState(
    toDatetimeLocalValue(fields.registrationClosesAt)
  )
  const [eventEndDate, setEventEndDate] = useState(fields.eventEndDate ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPublished(fields.publishedToPlayerApp)
    setPublicDescription(fields.publicDescription ?? '')
    setLocation(fields.location ?? '')
    setSessionTimeLabel(fields.sessionTimeLabel ?? '')
    setPriceDollars(centsToDollarsInput(fields.priceCents))
    setCapacity(fields.capacity != null ? String(fields.capacity) : '')
    setRegistrationOpensAt(toDatetimeLocalValue(fields.registrationOpensAt))
    setRegistrationClosesAt(toDatetimeLocalValue(fields.registrationClosesAt))
    setEventEndDate(fields.eventEndDate ?? '')
  }, [fields])

  async function save() {
    setSaving(true)
    onError('')
    try {
      const priceCents = dollarsInputToCents(priceDollars)
      const capacityParsed =
        capacity.trim() === ''
          ? null
          : Number.parseInt(capacity, 10)
      if (
        capacityParsed != null &&
        (!Number.isInteger(capacityParsed) || capacityParsed < 1)
      ) {
        throw new Error('Capacity must be a positive whole number or empty')
      }

      const body = {
        publishedToPlayerApp: published,
        publicDescription: publicDescription.trim() || null,
        location: location.trim() || null,
        sessionTimeLabel: sessionTimeLabel.trim() || null,
        priceCents,
        capacity: capacityParsed,
        registrationOpensAt: datetimeLocalToIso(registrationOpensAt),
        registrationClosesAt: datetimeLocalToIso(registrationClosesAt),
        eventEndDate: eventEndDate.trim() || null,
      }

      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save player catalog')

      const event = data.event as Record<string, unknown>
      const next: EventPlayerCatalogFields = {
        publishedToPlayerApp: Boolean(event.publishedToPlayerApp),
        publicDescription:
          typeof event.publicDescription === 'string'
            ? event.publicDescription
            : null,
        location: typeof event.location === 'string' ? event.location : null,
        sessionTimeLabel:
          typeof event.sessionTimeLabel === 'string'
            ? event.sessionTimeLabel
            : null,
        priceCents:
          typeof event.priceCents === 'number' ? event.priceCents : null,
        capacity: typeof event.capacity === 'number' ? event.capacity : null,
        registrationOpensAt:
          typeof event.registrationOpensAt === 'string'
            ? event.registrationOpensAt
            : event.registrationOpensAt instanceof Date
              ? event.registrationOpensAt.toISOString()
              : null,
        registrationClosesAt:
          typeof event.registrationClosesAt === 'string'
            ? event.registrationClosesAt
            : event.registrationClosesAt instanceof Date
              ? event.registrationClosesAt.toISOString()
              : null,
        eventEndDate:
          typeof event.eventEndDate === 'string' ? event.eventEndDate : null,
      }
      onSaved(next)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save player catalog')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-[var(--tm-border,#e5e7eb)] bg-[var(--tm-surface,#fff)] p-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--tm-fg,#111827)]">
          Player app catalog
        </h2>
        <FieldHelp>
          Shown on the public leagues API when published. Board notes above are
          never exposed to players.
        </FieldHelp>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className={`mt-0.5 ${FOCUS_RING}`}
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        <span>Publish to player app</span>
      </label>

      <label className="block text-sm">
        <span className="text-[var(--tm-muted,#4b5563)]">Public description</span>
        <textarea
          className={`${inputClass} min-h-[4rem]`}
          value={publicDescription}
          onChange={(e) => setPublicDescription(e.target.value)}
          placeholder="Player-facing summary (not board notes)"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[var(--tm-muted,#4b5563)]">Location</span>
          <input
            type="text"
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Venue or address"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--tm-muted,#4b5563)]">Session time label</span>
          <input
            type="text"
            className={inputClass}
            value={sessionTimeLabel}
            onChange={(e) => setSessionTimeLabel(e.target.value)}
            placeholder="e.g. Tuesdays 6:30–9:00 PM"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--tm-muted,#4b5563)]">End date</span>
          <input
            type="date"
            className={inputClass}
            value={eventEndDate}
            onChange={(e) => setEventEndDate(e.target.value)}
          />
          <FieldHelp>Optional for multi-week leagues</FieldHelp>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--tm-muted,#4b5563)]">Price (USD)</span>
          <input
            type="number"
            min={0}
            step={0.01}
            className={inputClass}
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            placeholder="Leave blank for TBD"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--tm-muted,#4b5563)]">Capacity</span>
          <input
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Unlimited if empty"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--tm-muted,#4b5563)]">Registration opens</span>
          <input
            type="datetime-local"
            className={inputClass}
            value={registrationOpensAt}
            onChange={(e) => setRegistrationOpensAt(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--tm-muted,#4b5563)]">Registration closes</span>
          <input
            type="datetime-local"
            className={inputClass}
            value={registrationClosesAt}
            onChange={(e) => setRegistrationClosesAt(e.target.value)}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save catalog settings'}
        </Button>
      </div>
    </section>
  )
}
