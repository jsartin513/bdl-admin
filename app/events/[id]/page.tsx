'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import { genderGroup } from '@/app/lib/players/gender'
import { SKILL_LEVELS, skillLevelLabel } from '@/app/lib/players/skill'
import type { EventRegistrationListItem } from '@/app/lib/events/types'

type EventDetail = {
  id: string
  name: string
  eventDate: string
  eventType: string
  eventTypeLabel: string
  notes: string | null
}

type ImportAction = {
  action: 'create' | 'update' | 'skip' | 'ambiguous'
  row: {
    rowNumber: number
    firstName: string
    lastName: string
    email: string | null
    jerseyNumber: number | null
    skillLevel: number | null
  }
  notes?: string[]
  reason?: string
  playerId?: string
}

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

function SkillStyledText(props: {
  skillLevel: number | null
  children: ReactNode
}) {
  const { skillLevel, children } = props
  if (skillLevel === 1) {
    return <span className="italic">({children})</span>
  }
  if (skillLevel === 3) {
    return <span className="font-bold">{children}</span>
  }
  if (skillLevel === 4) {
    return <span className="font-bold underline">{children}</span>
  }
  return <span>{children}</span>
}

function genderRowClass(gender: string | null): string {
  const group = genderGroup(gender)
  if (group === 'w_nb_o') return 'bg-rose-50/70 text-gray-900'
  if (group === 'men') return 'bg-sky-50/70 text-gray-900'
  return 'text-gray-900'
}

export default function EventTrackerPage() {
  const params = useParams()
  const eventId = String(params.id ?? '')
  const { devMode } = useDevMode()

  const [event, setEvent] = useState<EventDetail | null>(null)
  const [registrations, setRegistrations] = useState<EventRegistrationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [draftFilter, setDraftFilter] = useState<'all' | 'unassigned' | number>('all')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [maxGroup, setMaxGroup] = useState(4)

  const [importOpen, setImportOpen] = useState(false)
  const [importCsv, setImportCsv] = useState('')
  const [importFilename, setImportFilename] = useState('teamlinkt.csv')
  const [importProfileFields, setImportProfileFields] = useState<
    'skip' | 'fill_blank' | 'overwrite'
  >('skip')
  const [importPreview, setImportPreview] = useState<{
    actions: ImportAction[]
    summary: Record<string, number>
  } | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError(null)
    try {
      const [eventRes, regRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/events/${eventId}/registrations`),
      ])
      const eventData = await eventRes.json()
      const regData = await regRes.json()
      if (!eventRes.ok) throw new Error(eventData.error || 'Failed to load event')
      if (!regRes.ok) throw new Error(regData.error || 'Failed to load roster')
      setEvent(eventData.event)
      setRegistrations(regData.registrations)
      const groups = (regData.registrations as EventRegistrationListItem[])
        .map((r) => r.draftGroup)
        .filter((g): g is number => g != null)
      if (groups.length > 0) {
        setMaxGroup((prev) => Math.max(prev, ...groups))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const bySkill: Record<string, number> = { unset: 0 }
    for (const level of Object.keys(SKILL_LEVELS)) {
      bySkill[level] = 0
    }
    let wNbO = 0
    let men = 0
    let genderUnset = 0
    let unassigned = 0
    let assigned = 0
    const byGroup = new Map<number, number>()

    for (const r of registrations) {
      if (r.skillLevel == null) bySkill.unset++
      else bySkill[String(r.skillLevel)] = (bySkill[String(r.skillLevel)] ?? 0) + 1

      const g = genderGroup(r.gender)
      if (g === 'w_nb_o') wNbO++
      else if (g === 'men') men++
      else genderUnset++

      if (r.draftGroup == null) unassigned++
      else {
        assigned++
        byGroup.set(r.draftGroup, (byGroup.get(r.draftGroup) ?? 0) + 1)
      }
    }

    return {
      total: registrations.length,
      bySkill,
      wNbO,
      men,
      genderUnset,
      unassigned,
      assigned,
      byGroup,
    }
  }, [registrations])

  const groupOptions = useMemo(() => {
    const fromData = registrations
      .map((r) => r.draftGroup)
      .filter((g): g is number => g != null)
    const max = Math.max(maxGroup, ...(fromData.length ? fromData : [0]))
    return Array.from({ length: max }, (_, i) => i + 1)
  }, [registrations, maxGroup])

  const filtered = useMemo(() => {
    if (draftFilter === 'all') return registrations
    if (draftFilter === 'unassigned') {
      return registrations.filter((r) => r.draftGroup == null)
    }
    return registrations.filter((r) => r.draftGroup === draftFilter)
  }, [registrations, draftFilter])

  async function setDraftGroup(registrationId: string, draftGroup: number | null) {
    setSavingId(registrationId)
    setFormError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/registrations/${registrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftGroup }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update draft group')
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === registrationId
            ? { ...r, draftGroup: data.registration.draftGroup }
            : r
        )
      )
      if (draftGroup != null) {
        setMaxGroup((prev) => Math.max(prev, draftGroup))
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update draft group')
    } finally {
      setSavingId(null)
    }
  }

  async function previewImport() {
    setImportBusy(true)
    setFormError(null)
    try {
      const res = await fetch('/api/players/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: importCsv,
          filename: importFilename,
          dryRun: true,
          profileFields: importProfileFields,
          eventId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setImportPreview({
        actions: data.actions as ImportAction[],
        summary: data.summary as Record<string, number>,
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setImportBusy(false)
    }
  }

  async function commitImport() {
    setImportBusy(true)
    setFormError(null)
    try {
      const res = await fetch('/api/players/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: importCsv,
          filename: importFilename,
          dryRun: false,
          profileFields: importProfileFields,
          eventId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(String(data.error || 'Import failed'))
      const summary = data.summary as Record<string, number>
      setImportOpen(false)
      setImportCsv('')
      setImportPreview(null)
      setImportProfileFields('skip')
      setMessage(
        `Import done: ${summary.created ?? 0} created, ${summary.updated ?? 0} updated, ${summary.register ?? 0} registered, ${summary.alreadyRegistered ?? 0} already registered`
      )
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImportBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-sm text-gray-600">Loading…</div>
    )
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-6xl p-6 space-y-3">
        <p className="text-sm text-red-600">{error || 'Event not found'}</p>
        <Link
          href={withDevMode('/events', devMode)}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Events
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6 text-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={withDevMode('/events', devMode)}
            className="text-sm text-blue-700 hover:underline"
          >
            ← Events
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{event.name}</h1>
          <p className="text-sm text-gray-600">
            {formatDisplayDate(event.eventDate)} · {event.eventTypeLabel}
          </p>
          {event.notes ? (
            <p className="text-sm text-gray-600 mt-1">{event.notes}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
          onClick={() => {
            setImportOpen(true)
            setImportPreview(null)
            setImportProfileFields('skip')
            setFormError(null)
          }}
        >
          Import TeamLinkt CSV
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {formError && !importOpen ? (
        <p className="text-sm text-red-600">{formError}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded border border-gray-200 px-3 py-2">
          <div className="text-gray-500">Total</div>
          <div className="text-xl font-semibold">{counts.total}</div>
        </div>
        <div className="rounded border border-gray-200 px-3 py-2">
          <div className="text-gray-500">Gender</div>
          <div>
            W/NB/O {counts.wNbO} · M {counts.men}
            {counts.genderUnset ? ` · — ${counts.genderUnset}` : ''}
          </div>
        </div>
        <div className="rounded border border-gray-200 px-3 py-2">
          <div className="text-gray-500">Skill</div>
          <div className="text-xs space-y-0.5">
            {Object.entries(SKILL_LEVELS).map(([level, label]) => (
              <div key={level}>
                {label}: {counts.bySkill[level] ?? 0}
              </div>
            ))}
            <div>Unset: {counts.bySkill.unset}</div>
          </div>
        </div>
        <div className="rounded border border-gray-200 px-3 py-2">
          <div className="text-gray-500">Draft buckets</div>
          <div>
            Unassigned {counts.unassigned} · Assigned {counts.assigned}
          </div>
          {groupOptions.length > 0 ? (
            <div className="text-xs mt-1 text-gray-600">
              {groupOptions
                .map((g) => `G${g}: ${counts.byGroup.get(g) ?? 0}`)
                .join(' · ')}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm flex items-center gap-2">
          <span className="text-gray-600">Filter</span>
          <select
            className="rounded border border-gray-300 px-2 py-1"
            value={
              draftFilter === 'all' || draftFilter === 'unassigned'
                ? draftFilter
                : String(draftFilter)
            }
            onChange={(e) => {
              const v = e.target.value
              if (v === 'all' || v === 'unassigned') setDraftFilter(v)
              else setDraftFilter(Number.parseInt(v, 10))
            }}
          >
            <option value="all">All</option>
            <option value="unassigned">Unassigned</option>
            {groupOptions.map((g) => (
              <option key={g} value={g}>
                Group {g}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded border px-2 py-1 text-sm"
          onClick={() => setMaxGroup((n) => n + 1)}
        >
          Add group {maxGroup + 1}
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Skill</th>
              <th className="px-3 py-2 font-medium">Gender</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Draft group</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  {registrations.length === 0
                    ? 'No registrations yet. Import a TeamLinkt CSV for this event.'
                    : 'No players match this filter.'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className={`border-t border-gray-100 ${genderRowClass(r.gender)}`}>
                  <td className="px-3 py-2">
                    <SkillStyledText skillLevel={r.skillLevel}>
                      {r.nickname || `${r.firstName} ${r.lastName}`}
                    </SkillStyledText>
                    <div className="text-xs text-gray-500">
                      {r.firstName} {r.lastName}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {r.skillLevel != null ? skillLevelLabel(r.skillLevel) : '—'}
                  </td>
                  <td className="px-3 py-2">{r.genderGroupLabel}</td>
                  <td className="px-3 py-2 text-xs">{r.primaryEmail ?? '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
                      disabled={savingId === r.id}
                      value={r.draftGroup == null ? '' : String(r.draftGroup)}
                      onChange={(e) => {
                        const v = e.target.value
                        void setDraftGroup(r.id, v === '' ? null : Number.parseInt(v, 10))
                      }}
                    >
                      <option value="">Unassigned</option>
                      {groupOptions.map((g) => (
                        <option key={g} value={g}>
                          Group {g}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {importOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 text-gray-900">
            <h2 className="text-lg font-semibold text-gray-900">
              Import TeamLinkt CSV for {event.name}
            </h2>
            <p className="text-sm text-gray-600">
              Players are upserted as usual, and each matched/created player is
              registered for this event. Re-imports keep draft group assignments.
            </p>
            <label className="block text-sm">
              <span className="text-gray-600">Existing players: skill / gender / jersey</span>
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={importProfileFields}
                onChange={(e) => {
                  setImportProfileFields(
                    e.target.value as 'skip' | 'fill_blank' | 'overwrite'
                  )
                  setImportPreview(null)
                }}
              >
                <option value="skip">Skip (keep current values)</option>
                <option value="fill_blank">Fill blanks only</option>
                <option value="overwrite">Overwrite from CSV</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Filename</span>
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={importFilename}
                onChange={(e) => setImportFilename(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="mt-1 block w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImportFilename(file.name)
                  void file.text().then((text) => {
                    setImportCsv(text)
                    setImportPreview(null)
                  })
                }}
              />
            </label>
            <textarea
              className="w-full h-40 rounded border border-gray-300 px-3 py-2 font-mono text-xs"
              value={importCsv}
              onChange={(e) => {
                setImportCsv(e.target.value)
                setImportPreview(null)
              }}
              placeholder="Or paste CSV contents here…"
            />
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            {importPreview ? (
              <div className="space-y-2 text-sm">
                <p>
                  Preview: {importPreview.summary.create} create,{' '}
                  {importPreview.summary.update} update, {importPreview.summary.skip} skip,{' '}
                  {importPreview.summary.ambiguous} ambiguous
                  {typeof importPreview.summary.register === 'number' ? (
                    <>
                      ; {importPreview.summary.register} will register,{' '}
                      {importPreview.summary.alreadyRegistered ?? 0} already registered
                    </>
                  ) : null}
                </p>
                <div className="max-h-48 overflow-y-auto border rounded">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left">Row</th>
                        <th className="px-2 py-1 text-left">Action</th>
                        <th className="px-2 py-1 text-left">Name</th>
                        <th className="px-2 py-1 text-left">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.actions.map((a, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1">{a.row.rowNumber}</td>
                          <td className="px-2 py-1">{a.action}</td>
                          <td className="px-2 py-1">
                            {a.row.firstName} {a.row.lastName}
                          </td>
                          <td className="px-2 py-1">
                            {a.notes?.join('; ') || a.reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => setImportOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                disabled={importBusy || !importCsv.trim()}
                className="rounded border px-3 py-2 text-sm disabled:opacity-40"
                onClick={() => void previewImport()}
              >
                Dry run
              </button>
              <button
                type="button"
                disabled={importBusy || !importPreview}
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40"
                onClick={() => void commitImport()}
              >
                Commit import
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
