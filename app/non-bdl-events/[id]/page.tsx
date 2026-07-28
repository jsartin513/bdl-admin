'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import {
  BALL_TYPES,
  HOME_LEAGUES,
  type NonBdlEventAttendeeItem,
  type NonBdlEventPhotoItem,
  type NonBdlEventStoryItem,
  type NonBdlEventTeamItem,
} from '@/app/lib/non-bdl-events/types'

type EventDetail = {
  id: string
  name: string
  eventDate: string
  ballType: string
  ballTypeLabel: string
  division: string | null
  city: string | null
  hostOrgHomeLeague: string | null
  hostOrgName: string | null
  hostOrgLabel: string
  notes: string | null
}

type PlayerSearchHit = {
  id: string
  firstName: string
  lastName: string
  nickname: string
  rosterName: string
}

function TagChecklist({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  if (options.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No {label.toLowerCase()} to tag yet.
      </p>
    )
  }
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-medium text-gray-600">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.id)
          return (
            <label
              key={opt.id}
              className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  onChange(
                    checked
                      ? selected.filter((id) => id !== opt.id)
                      : [...selected, opt.id]
                  )
                }}
              />
              {opt.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function NonBdlEventDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl p-6 text-sm text-gray-600">Loading…</div>
      }
    >
      <NonBdlEventDetailContent />
    </Suspense>
  )
}

function NonBdlEventDetailContent() {
  const params = useParams()
  const eventId = String(params.id)
  const { devMode } = useDevMode()

  const [event, setEvent] = useState<EventDetail | null>(null)
  const [teams, setTeams] = useState<NonBdlEventTeamItem[]>([])
  const [attendees, setAttendees] = useState<NonBdlEventAttendeeItem[]>([])
  const [stories, setStories] = useState<NonBdlEventStoryItem[]>([])
  const [photos, setPhotos] = useState<NonBdlEventPhotoItem[]>([])
  const [goodLuckBlurb, setGoodLuckBlurb] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Event edit form
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [ballType, setBallType] = useState('foam')
  const [division, setDivision] = useState('')
  const [city, setCity] = useState('')
  const [hostOrgHomeLeague, setHostOrgHomeLeague] = useState('')
  const [hostOrgName, setHostOrgName] = useState('')
  const [notes, setNotes] = useState('')

  // Team form
  const [newTeamName, setNewTeamName] = useState('')

  // Player search
  const [playerQuery, setPlayerQuery] = useState('')
  const [playerHits, setPlayerHits] = useState<PlayerSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [addTeamId, setAddTeamId] = useState('')

  // Story form
  const [storyTitle, setStoryTitle] = useState('')
  const [storyBody, setStoryBody] = useState('')
  const [storyTeamIds, setStoryTeamIds] = useState<string[]>([])
  const [storyPlayerIds, setStoryPlayerIds] = useState<string[]>([])

  // Photo form
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoTeamIds, setPhotoTeamIds] = useState<string[]>([])
  const [photoPlayerIds, setPhotoPlayerIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/non-bdl-events/${eventId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load event')
      setEvent(data.event)
      setTeams(data.teams)
      setAttendees(data.attendees)
      setStories(data.stories)
      setPhotos(data.photos)
      setGoodLuckBlurb(data.goodLuckBlurb ?? '')
      setName(data.event.name)
      setEventDate(data.event.eventDate)
      setBallType(data.event.ballType)
      setDivision(data.event.division ?? '')
      setCity(data.event.city ?? '')
      setHostOrgHomeLeague(data.event.hostOrgHomeLeague ?? '')
      setHostOrgName(data.event.hostOrgName ?? '')
      setNotes(data.event.notes ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!playerQuery.trim()) {
      setPlayerHits([])
      return
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true)
        try {
          const res = await fetch(
            `/api/players?q=${encodeURIComponent(playerQuery.trim())}`
          )
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Search failed')
          const attending = new Set(attendees.map((a) => a.playerId))
          setPlayerHits(
            (data.players as PlayerSearchHit[])
              .filter((p) => !attending.has(p.id))
              .slice(0, 8)
          )
        } catch {
          setPlayerHits([])
        } finally {
          setSearching(false)
        }
      })()
    }, 250)
    return () => window.clearTimeout(handle)
  }, [playerQuery, attendees])

  const teamOptions = useMemo(
    () => teams.map((t) => ({ id: t.id, label: t.name })),
    [teams]
  )
  const playerOptions = useMemo(
    () => attendees.map((a) => ({ id: a.playerId, label: a.nickname })),
    [attendees]
  )

  async function saveEvent() {
    setSaving(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/non-bdl-events/${eventId}`, {
        method: 'PATCH',
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
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      await loadDetail()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent() {
    if (!window.confirm('Delete this travel event and all related content?')) {
      return
    }
    setSaving(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/non-bdl-events/${eventId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      window.location.href = withDevMode('/non-bdl-events', devMode)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete')
      setSaving(false)
    }
  }

  async function addTeam() {
    if (!newTeamName.trim()) return
    setActionError(null)
    try {
      const res = await fetch(`/api/non-bdl-events/${eventId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add team')
      setNewTeamName('')
      await loadDetail()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add team')
    }
  }

  async function saveTeam(
    teamId: string,
    patch: { name?: string; resultText?: string | null }
  ) {
    setActionError(null)
    try {
      const res = await fetch(`/api/non-bdl-events/${eventId}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update team')
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update team'
      )
    }
  }

  async function removeTeam(teamId: string) {
    if (!window.confirm('Delete this team? Players will be unassigned.')) return
    setActionError(null)
    try {
      const res = await fetch(`/api/non-bdl-events/${eventId}/teams/${teamId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete team')
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to delete team'
      )
    }
  }

  async function addPlayer(playerId: string) {
    setActionError(null)
    try {
      const res = await fetch(`/api/non-bdl-events/${eventId}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          teamId: addTeamId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add player')
      setPlayerQuery('')
      setPlayerHits([])
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to add player'
      )
    }
  }

  async function updateAttendee(
    attendeeId: string,
    patch: { teamId?: string | null; notes?: string | null }
  ) {
    setActionError(null)
    try {
      const res = await fetch(
        `/api/non-bdl-events/${eventId}/attendees/${attendeeId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update player')
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update player'
      )
    }
  }

  async function removeAttendee(attendeeId: string) {
    setActionError(null)
    try {
      const res = await fetch(
        `/api/non-bdl-events/${eventId}/attendees/${attendeeId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove player')
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to remove player'
      )
    }
  }

  async function copyGoodLuck() {
    try {
      await navigator.clipboard.writeText(goodLuckBlurb)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setActionError('Could not copy to clipboard')
    }
  }

  async function addStory() {
    if (!storyBody.trim()) return
    setActionError(null)
    try {
      const res = await fetch(`/api/non-bdl-events/${eventId}/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: storyTitle.trim() || null,
          body: storyBody,
          teamIds: storyTeamIds,
          playerIds: storyPlayerIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add story')
      setStoryTitle('')
      setStoryBody('')
      setStoryTeamIds([])
      setStoryPlayerIds([])
      await loadDetail()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add story')
    }
  }

  async function saveStory(
    storyId: string,
    patch: {
      title?: string | null
      body?: string
      teamIds?: string[]
      playerIds?: string[]
    }
  ) {
    setActionError(null)
    try {
      const res = await fetch(
        `/api/non-bdl-events/${eventId}/stories/${storyId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update story')
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update story'
      )
    }
  }

  async function removeStory(storyId: string) {
    if (!window.confirm('Delete this story?')) return
    setActionError(null)
    try {
      const res = await fetch(
        `/api/non-bdl-events/${eventId}/stories/${storyId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete story')
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to delete story'
      )
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    setActionError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      if (photoCaption.trim()) form.append('caption', photoCaption.trim())
      form.append('teamIds', JSON.stringify(photoTeamIds))
      form.append('playerIds', JSON.stringify(photoPlayerIds))
      const res = await fetch(`/api/non-bdl-events/${eventId}/photos/upload`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to upload photo')
      setPhotoCaption('')
      setPhotoTeamIds([])
      setPhotoPlayerIds([])
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to upload photo'
      )
    } finally {
      setUploading(false)
    }
  }

  async function savePhoto(
    photoId: string,
    patch: {
      caption?: string | null
      teamIds?: string[]
      playerIds?: string[]
    }
  ) {
    setActionError(null)
    try {
      const res = await fetch(
        `/api/non-bdl-events/${eventId}/photos/${photoId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update photo')
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update photo'
      )
    }
  }

  async function removePhoto(photoId: string) {
    if (!window.confirm('Delete this photo?')) return
    setActionError(null)
    try {
      const res = await fetch(
        `/api/non-bdl-events/${eventId}/photos/${photoId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete photo')
      await loadDetail()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to delete photo'
      )
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-sm text-gray-600">Loading…</div>
    )
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-3">
        <p className="text-sm text-red-600">{error || 'Event not found'}</p>
        <Link
          href={withDevMode('/non-bdl-events', devMode)}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Back to Non-BDL Events
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8 text-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={withDevMode('/non-bdl-events', devMode)}
            className="text-sm text-blue-700 hover:underline"
          >
            ← Non-BDL Events
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{event.name}</h1>
          <p className="text-sm text-gray-600">
            {event.hostOrgLabel}
            {event.city ? ` · ${event.city}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-red-300 px-3 py-2 text-sm text-red-700"
          onClick={() => void deleteEvent()}
          disabled={saving}
        >
          Delete event
        </button>
      </div>

      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

      {/* Event info */}
      <section className="space-y-3 rounded border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">Event info</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600">Name</span>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">City</span>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Host org (known league)</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={hostOrgHomeLeague}
              onChange={(e) => setHostOrgHomeLeague(e.target.value)}
            >
              <option value="">— None —</option>
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
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600">Notes</span>
            <textarea
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => void saveEvent()}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save event info'}
        </button>
      </section>

      {/* Teams */}
      <section className="space-y-3 rounded border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">Teams</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="External team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
            onClick={() => void addTeam()}
          >
            Add team
          </button>
        </div>
        {teams.length === 0 ? (
          <p className="text-sm text-gray-600">No teams yet.</p>
        ) : (
          <ul className="space-y-3">
            {teams.map((team) => (
              <li
                key={team.id}
                className="rounded border border-gray-100 p-3 space-y-2"
              >
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    className="rounded border border-gray-300 px-2 py-1 text-sm font-medium"
                    defaultValue={team.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== team.name) {
                        void saveTeam(team.id, { name: e.target.value })
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="text-xs text-red-700 hover:underline"
                    onClick={() => void removeTeam(team.id)}
                  >
                    Delete
                  </button>
                </div>
                <label className="block text-sm">
                  <span className="text-gray-600">How they did</span>
                  <textarea
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    rows={2}
                    defaultValue={team.resultText ?? ''}
                    onBlur={(e) => {
                      const next = e.target.value.trim() || null
                      if (next !== (team.resultText ?? null)) {
                        void saveTeam(team.id, { resultText: next })
                      }
                    }}
                    placeholder="Placement, notable wins…"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Players */}
      <section className="space-y-3 rounded border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">Players going</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block text-sm grow min-w-[200px]">
            <span className="text-gray-600">Search players</span>
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={playerQuery}
              onChange={(e) => setPlayerQuery(e.target.value)}
              placeholder="Name…"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Assign to team</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={addTeamId}
              onChange={(e) => setAddTeamId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {searching ? (
          <p className="text-xs text-gray-500">Searching…</p>
        ) : playerHits.length > 0 ? (
          <ul className="rounded border border-gray-200 divide-y">
            {playerHits.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span>
                  {p.nickname}{' '}
                  <span className="text-gray-500">
                    ({p.firstName} {p.lastName})
                  </span>
                </span>
                <button
                  type="button"
                  className="text-blue-700 hover:underline"
                  onClick={() => void addPlayer(p.id)}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {attendees.length === 0 ? (
          <p className="text-sm text-gray-600">No players added yet.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Player</th>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 whitespace-nowrap">{a.nickname}</td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border border-gray-300 px-2 py-1"
                        value={a.teamId ?? ''}
                        onChange={(e) =>
                          void updateAttendee(a.id, {
                            teamId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 min-w-[180px]">
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1"
                        defaultValue={a.notes ?? ''}
                        onBlur={(e) => {
                          const next = e.target.value.trim() || null
                          if (next !== (a.notes ?? null)) {
                            void updateAttendee(a.id, { notes: next })
                          }
                        }}
                        placeholder="Optional notes / story seed"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-700 hover:underline"
                        onClick={() => void removeAttendee(a.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Good luck */}
      <section className="space-y-3 rounded border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Good luck blurb</h2>
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={() => void copyGoodLuck()}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm border border-gray-100">
          {goodLuckBlurb}
        </pre>
      </section>

      {/* Stories */}
      <section className="space-y-3 rounded border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">Stories</h2>
        <div className="space-y-2 rounded border border-dashed border-gray-300 p-3">
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Title (optional)"
            value={storyTitle}
            onChange={(e) => setStoryTitle(e.target.value)}
          />
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            rows={4}
            placeholder="Story draft for the website…"
            value={storyBody}
            onChange={(e) => setStoryBody(e.target.value)}
          />
          <TagChecklist
            label="Tag teams"
            options={teamOptions}
            selected={storyTeamIds}
            onChange={setStoryTeamIds}
          />
          <TagChecklist
            label="Tag players"
            options={playerOptions}
            selected={storyPlayerIds}
            onChange={setStoryPlayerIds}
          />
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={!storyBody.trim()}
            onClick={() => void addStory()}
          >
            Add story
          </button>
        </div>
        {stories.length === 0 ? (
          <p className="text-sm text-gray-600">No stories yet.</p>
        ) : (
          <ul className="space-y-3">
            {stories.map((story) => (
              <li
                key={story.id}
                className="rounded border border-gray-100 p-3 space-y-2"
              >
                <input
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-medium"
                  defaultValue={story.title ?? ''}
                  placeholder="Untitled"
                  onBlur={(e) => {
                    const next = e.target.value.trim() || null
                    if (next !== (story.title ?? null)) {
                      void saveStory(story.id, { title: next })
                    }
                  }}
                />
                <textarea
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  rows={4}
                  defaultValue={story.body}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== story.body) {
                      void saveStory(story.id, { body: e.target.value })
                    }
                  }}
                />
                <TagChecklist
                  label="Tag teams"
                  options={teamOptions}
                  selected={story.teamIds}
                  onChange={(ids) => void saveStory(story.id, { teamIds: ids })}
                />
                <TagChecklist
                  label="Tag players"
                  options={playerOptions}
                  selected={story.playerIds}
                  onChange={(ids) =>
                    void saveStory(story.id, { playerIds: ids })
                  }
                />
                <button
                  type="button"
                  className="text-xs text-red-700 hover:underline"
                  onClick={() => void removeStory(story.id)}
                >
                  Delete story
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Photos */}
      <section className="space-y-3 rounded border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">Photos</h2>
        <div className="space-y-2 rounded border border-dashed border-gray-300 p-3">
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Caption (optional)"
            value={photoCaption}
            onChange={(e) => setPhotoCaption(e.target.value)}
          />
          <TagChecklist
            label="Tag teams"
            options={teamOptions}
            selected={photoTeamIds}
            onChange={setPhotoTeamIds}
          />
          <TagChecklist
            label="Tag players"
            options={playerOptions}
            selected={photoPlayerIds}
            onChange={setPhotoPlayerIds}
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="rounded bg-blue-600 px-3 py-2 text-white cursor-pointer">
              {uploading ? 'Uploading…' : 'Upload photo'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void uploadPhoto(file)
              }}
            />
          </label>
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-gray-600">No photos yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {photos.map((photo) => (
              <li
                key={photo.id}
                className="rounded border border-gray-100 p-3 space-y-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.blobUrl}
                  alt={photo.caption || 'Event photo'}
                  className="w-full max-h-56 object-cover rounded"
                />
                <input
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  defaultValue={photo.caption ?? ''}
                  placeholder="Caption"
                  onBlur={(e) => {
                    const next = e.target.value.trim() || null
                    if (next !== (photo.caption ?? null)) {
                      void savePhoto(photo.id, { caption: next })
                    }
                  }}
                />
                <TagChecklist
                  label="Tag teams"
                  options={teamOptions}
                  selected={photo.teamIds}
                  onChange={(ids) => void savePhoto(photo.id, { teamIds: ids })}
                />
                <TagChecklist
                  label="Tag players"
                  options={playerOptions}
                  selected={photo.playerIds}
                  onChange={(ids) =>
                    void savePhoto(photo.id, { playerIds: ids })
                  }
                />
                <button
                  type="button"
                  className="text-xs text-red-700 hover:underline"
                  onClick={() => void removePhoto(photo.id)}
                >
                  Delete photo
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
