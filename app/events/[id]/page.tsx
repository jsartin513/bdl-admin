'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { EventDraftBoard } from '@/app/components/events/EventDraftBoard'
import {
  EventDraftSetup,
  type DraftSeedMode,
} from '@/app/components/events/EventDraftSetup'
import { EventTeamsSection } from '@/app/components/events/EventTeamsSection'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import {
  autoSeedDraftGroups,
  copyExistingDraftGroups,
  defaultTeamCount,
  emptySeedDraftGroups,
} from '@/app/lib/events/draft-seed'
import { resolveTeamName } from '@/app/lib/events/dodgeballhub-export'
import type {
  EventDraftSnapshotListItem,
  EventRegistrationListItem,
} from '@/app/lib/events/types'
import { EVENT_FORMATS, EVENT_TYPES } from '@/app/lib/events/types'
import { genderGroup } from '@/app/lib/players/gender'
import {
  HOME_LEAGUES,
  HOME_LEAGUE_CODES,
  type HomeLeague,
} from '@/app/lib/players/home-league'
import {
  effectiveSkillLabel,
  effectiveSkillScore,
  skillMatrixBucketKey,
  skillMatrixColLabel,
  skillMatrixColumns,
} from '@/app/lib/players/skill'
import type { PlayerListItem } from '@/app/lib/players/types'
import { SkillStyledText } from '@/app/components/SkillStyledText'
import {
  SkillViewModeToggle,
  useSkillViewMode,
} from '@/app/hooks/useSkillViewMode'
import {
  Button,
  ConfirmDialog,
  Dialog,
  FieldHelp,
  FOCUS_RING,
  LiveMessage,
  Tooltip,
} from '@/app/components/ui'
import { ContactPlayersDialog } from '@/app/components/contact/ContactPlayersDialog'

const DEFAULT_REACH_OUT_LEAGUE: HomeLeague = 'boston_dodgeball_league'

type EventDetail = {
  id: string
  name: string
  eventDate: string
  eventType: string
  eventTypeLabel: string
  eventFormat: string | null
  eventFormatLabel: string | null
  ballType: string
  ballTypeLabel: string
  gender: string
  genderLabel: string
  notes: string | null
  pairingEnabled: boolean
  teamNames: string[]
  teamsLocked: boolean
  teamsFinalizedAt: string | null
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

type DraftPhase = 'off' | 'setup' | 'board'

const GENDER_ROWS = ['w_nb_o', 'men', 'unset'] as const

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

function genderRowClass(gender: string | null): string {
  const group = genderGroup(gender)
  if (group === 'w_nb_o') return 'bg-rose-50/70 text-gray-900'
  if (group === 'men') return 'bg-sky-50/70 text-gray-900'
  return 'text-gray-900'
}

function genderRowLabel(row: (typeof GENDER_ROWS)[number]): string {
  if (row === 'w_nb_o') return 'W/NB/O'
  if (row === 'men') return 'Men'
  return 'Unset'
}

/** (C) for sole captain on a team; (CC) when the team has multiple captains. */
function captainBadge(
  registration: EventRegistrationListItem,
  all: EventRegistrationListItem[]
): '(C)' | '(CC)' | null {
  if (!registration.isCaptain || registration.draftGroup == null) return null
  const captainsOnTeam = all.filter(
    (r) => r.draftGroup === registration.draftGroup && r.isCaptain
  )
  return captainsOnTeam.length > 1 ? '(CC)' : '(C)'
}

export default function EventTrackerPage() {
  return (
    <Suspense
      fallback={
        <div className="team-maker mx-auto max-w-6xl p-6 text-sm text-[var(--tm-muted,#4b5563)]">
          Loading…
        </div>
      }
    >
      <EventTrackerPageContent />
    </Suspense>
  )
}

function EventTrackerPageContent() {
  const params = useParams()
  const router = useRouter()
  const eventId = String(params.id ?? '')
  const { devMode } = useDevMode()
  const [skillViewMode, setSkillViewMode] = useSkillViewMode()

  const [event, setEvent] = useState<EventDetail | null>(null)
  const [registrations, setRegistrations] = useState<EventRegistrationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [draftFilter, setDraftFilter] = useState<'all' | 'unassigned' | number>('all')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [maxGroup, setMaxGroup] = useState(4)

  const [importOpen, setImportOpen] = useState(false)
  const [importCsv, setImportCsv] = useState('')
  const [importFilename, setImportFilename] = useState('pasted.csv')
  const [importProfileFields, setImportProfileFields] = useState<
    'skip' | 'fill_blank' | 'overwrite'
  >('skip')
  const [importPreview, setImportPreview] = useState<{
    actions: ImportAction[]
    summary: Record<string, number>
  } | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(false)

  const [draftPhase, setDraftPhase] = useState<DraftPhase>('off')
  const [draftTeamCount, setDraftTeamCount] = useState(1)
  const [draftSeedMode, setDraftSeedMode] = useState<DraftSeedMode>('auto')
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<{
    id: string
    label: string
  } | null>(null)
  const [confirmImportCommit, setConfirmImportCommit] = useState(false)
  const [draftAssignments, setDraftAssignments] = useState<Map<string, number | null>>(
    () => new Map()
  )
  const [draftApplying, setDraftApplying] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<EventDraftSnapshotListItem[]>([])
  const [snapshotsBusy, setSnapshotsBusy] = useState(false)
  const [teamNamesDraft, setTeamNamesDraft] = useState<string[]>([])
  const [teamNamesSaving, setTeamNamesSaving] = useState(false)
  const [teamsActionBusy, setTeamsActionBusy] = useState(false)

  const [reachOutLeagues, setReachOutLeagues] = useState<HomeLeague[]>([
    DEFAULT_REACH_OUT_LEAGUE,
  ])
  const [reachOutIncludeOthers, setReachOutIncludeOthers] = useState(false)
  const [reachOutPlayers, setReachOutPlayers] = useState<PlayerListItem[]>([])
  const [reachOutLoading, setReachOutLoading] = useState(false)
  const [reachOutError, setReachOutError] = useState<string | null>(null)
  const [reachOutCopyMessage, setReachOutCopyMessage] = useState<string | null>(
    null
  )

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError(null)
    try {
      const [eventRes, regRes, snapRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/events/${eventId}/registrations`),
        fetch(`/api/events/${eventId}/draft-snapshots`),
      ])
      const eventData = await eventRes.json()
      const regData = await regRes.json()
      const snapData = await snapRes.json()
      if (!eventRes.ok) throw new Error(eventData.error || 'Failed to load event')
      if (!regRes.ok) throw new Error(regData.error || 'Failed to load roster')
      setEvent(eventData.event)
      setTeamNamesDraft(
        Array.isArray(eventData.event.teamNames)
          ? eventData.event.teamNames.map((n: unknown) => String(n ?? ''))
          : []
      )
      setRegistrations(regData.registrations)
      if (snapRes.ok) {
        setSnapshots(snapData.snapshots ?? [])
      }
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

  const loadReachOut = useCallback(async () => {
    if (!eventId || reachOutLeagues.length === 0) {
      setReachOutPlayers([])
      return
    }
    setReachOutLoading(true)
    setReachOutError(null)
    try {
      const params = new URLSearchParams({
        eventId,
        eventMatch: 'not_registered',
        homeLeagues: reachOutLeagues.join(','),
      })
      const res = await fetch(`/api/players?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load prospects')
      setReachOutPlayers(data.players as PlayerListItem[])
    } catch (err) {
      setReachOutError(
        err instanceof Error ? err.message : 'Failed to load prospects'
      )
    } finally {
      setReachOutLoading(false)
    }
  }, [eventId, reachOutLeagues])

  useEffect(() => {
    void loadReachOut()
  }, [loadReachOut, registrations.length])

  function toggleReachOutLeague(code: HomeLeague) {
    setReachOutLeagues((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code)
        return next.length > 0 ? next : [DEFAULT_REACH_OUT_LEAGUE]
      }
      return [...prev, code]
    })
  }

  async function copyReachOutEmails() {
    const emails = reachOutPlayers
      .map((p) => p.primaryEmail)
      .filter((e): e is string => Boolean(e?.trim()))
    if (emails.length === 0) {
      setReachOutCopyMessage('No emails to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      setReachOutCopyMessage(
        `Copied ${emails.length} email${emails.length === 1 ? '' : 's'}`
      )
    } catch {
      setReachOutCopyMessage('Could not copy to clipboard')
    }
  }

  const hasExistingGroups = useMemo(
    () => registrations.some((r) => r.draftGroup != null),
    [registrations]
  )

  const hasByotLocked = useMemo(
    () => registrations.some((r) => r.teamLocked),
    [registrations]
  )

  /** Draft groups (1-based) that have ≥1 locked BYOT signup player. */
  const byotTeamIndexes = useMemo(() => {
    const set = new Set<number>()
    for (const r of registrations) {
      if (r.teamLocked && r.draftGroup != null) set.add(r.draftGroup)
    }
    return set
  }, [registrations])

  const freeAgents = useMemo(() => {
    return registrations
      .filter((r) => r.draftGroup == null)
      .slice()
      .sort((a, b) => {
        const an = `${a.firstName} ${a.lastName}`.trim() || a.nickname
        const bn = `${b.firstName} ${b.lastName}`.trim() || b.nickname
        return an.localeCompare(bn, undefined, { sensitivity: 'base' })
      })
  }, [registrations])

  const showFreeAgentTeamLabel =
    hasByotLocked || event?.eventFormat === 'byot'

  /** Team count must cover every locked BYOT signup group so seats stay visible. */
  const minDraftTeamCount = useMemo(() => {
    let maxLocked = 1
    for (const r of registrations) {
      if (r.teamLocked && r.draftGroup != null && r.draftGroup > maxLocked) {
        maxLocked = r.draftGroup
      }
    }
    return maxLocked
  }, [registrations])

  const counts = useMemo(() => {
    let unassigned = 0
    let assigned = 0
    const byGroup = new Map<number, number>()
    const skillCols = skillMatrixColumns(skillViewMode)

    const matrix: Record<string, Record<string, number>> = {}
    for (const row of GENDER_ROWS) {
      matrix[row] = { unset: 0 }
      for (const level of skillCols) {
        if (level == null) continue
        matrix[row][String(level)] = 0
      }
    }

    for (const r of registrations) {
      const g = genderGroup(r.gender)
      const score = effectiveSkillScore(r, skillViewMode)
      const skillKey = skillMatrixBucketKey(score, skillViewMode)
      matrix[g][skillKey] = (matrix[g][skillKey] ?? 0) + 1

      if (r.draftGroup == null) unassigned++
      else {
        assigned++
        byGroup.set(r.draftGroup, (byGroup.get(r.draftGroup) ?? 0) + 1)
      }
    }

    const colTotals: Record<string, number> = { unset: 0 }
    for (const level of skillCols) {
      if (level == null) continue
      colTotals[String(level)] = 0
    }
    const rowTotals: Record<string, number> = {
      w_nb_o: 0,
      men: 0,
      unset: 0,
    }
    for (const row of GENDER_ROWS) {
      for (const [skill, n] of Object.entries(matrix[row])) {
        rowTotals[row] += n
        colTotals[skill] = (colTotals[skill] ?? 0) + n
      }
    }

    return {
      total: registrations.length,
      unassigned,
      assigned,
      byGroup,
      matrix,
      colTotals,
      rowTotals,
      skillCols,
    }
  }, [registrations, skillViewMode])

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
            ? {
                ...r,
                draftGroup: data.registration.draftGroup,
                isCaptain:
                  typeof data.registration.isCaptain === 'boolean'
                    ? data.registration.isCaptain
                    : draftGroup == null
                      ? false
                      : r.isCaptain,
              }
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

  async function togglePairingEnabled(pairingEnabled: boolean) {
    if (!event) return
    setFormError(null)
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingEnabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update pairing')
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              pairingEnabled: Boolean(data.event.pairingEnabled),
            }
          : prev
      )
      setMessage(
        pairingEnabled ? 'Pairing enabled for this event' : 'Pairing disabled for this event'
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update pairing')
    }
  }

  async function updateEventMeta(patch: {
    eventType?: string
    eventFormat?: string | null
  }) {
    if (!event) return
    setFormError(null)
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update event')
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              eventType: data.event.eventType,
              eventTypeLabel: data.event.eventTypeLabel,
              eventFormat: data.event.eventFormat ?? null,
              eventFormatLabel: data.event.eventFormatLabel ?? null,
            }
          : prev
      )
      setMessage('Event updated')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update event')
    }
  }

  function applyEventTeamsPatch(data: { event: EventDetail }) {
    setEvent((prev) =>
      prev
        ? {
            ...prev,
            teamNames: Array.isArray(data.event.teamNames) ? data.event.teamNames : [],
            teamsLocked: Boolean(data.event.teamsLocked),
            teamsFinalizedAt: data.event.teamsFinalizedAt ?? null,
          }
        : prev
    )
    if (Array.isArray(data.event.teamNames)) {
      setTeamNamesDraft(data.event.teamNames.map((n) => String(n ?? '')))
    }
  }

  async function saveTeamNames() {
    if (!event) return
    setTeamNamesSaving(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamNames: teamNamesDraft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save team names')
      applyEventTeamsPatch(data)
      setMessage('Team names saved')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save team names')
    } finally {
      setTeamNamesSaving(false)
    }
  }

  async function finalizeTeams() {
    if (!event) return
    setTeamsActionBusy(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalizeTeams: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to finalize teams')
      applyEventTeamsPatch(data)
      setMessage('Teams finalized and locked')
      setConfirmFinalize(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to finalize teams')
    } finally {
      setTeamsActionBusy(false)
    }
  }

  async function setTeamsLocked(teamsLocked: boolean) {
    if (!event) return
    setTeamsActionBusy(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamsLocked }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update lock')
      applyEventTeamsPatch(data)
      setMessage(teamsLocked ? 'Teams locked' : 'Teams unlocked — you can edit assignments')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update lock')
    } finally {
      setTeamsActionBusy(false)
    }
  }

  function exportDodgeballHub() {
    window.location.href = `/api/events/${eventId}/export/dodgeballhub`
  }

  async function toggleCaptain(registrationId: string, isCaptain: boolean) {
    setSavingId(registrationId)
    setFormError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/registrations/${registrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isCaptain }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update captain status')
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === registrationId
            ? { ...r, isCaptain: data.registration.isCaptain }
            : r
        )
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update captain status')
    } finally {
      setSavingId(null)
    }
  }

  async function pairWith(registrationId: string, partnerRegistrationId: string) {
    setSavingId(registrationId)
    setFormError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/registrations/${registrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairWithRegistrationId: partnerRegistrationId }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to group')
      await load()
      setMessage('Group updated')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to group')
    } finally {
      setSavingId(null)
    }
  }

  async function leaveGroup(registrationId: string) {
    setSavingId(registrationId)
    setFormError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/registrations/${registrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leaveGroup: true }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to leave group')
      await load()
      setMessage('Left group')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to leave group')
    } finally {
      setSavingId(null)
    }
  }

  async function dissolveGroup(registrationId: string) {
    setSavingId(registrationId)
    setFormError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/registrations/${registrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dissolveGroup: true }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to dissolve group')
      await load()
      setMessage('Group dissolved')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to dissolve group')
    } finally {
      setSavingId(null)
    }
  }

  async function setSignupOverride(
    registrationId: string,
    patch: { draftGroup?: number | null; teamLocked?: boolean }
  ) {
    setSavingId(registrationId)
    setFormError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/registrations/${registrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signupOverride: true, ...patch }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update signup team')
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === registrationId
            ? {
                ...r,
                draftGroup: data.registration.draftGroup,
                teamLocked: data.registration.teamLocked,
                isCaptain:
                  data.registration.draftGroup == null ? false : r.isCaptain,
              }
            : r
        )
      )
      if (data.registration.draftGroup != null) {
        setMaxGroup((prev) => Math.max(prev, data.registration.draftGroup))
      }
      setMessage(
        patch.teamLocked === false
          ? 'Unlocked from signup team'
          : patch.teamLocked === true
            ? 'Locked to signup team'
            : 'Signup team updated'
      )
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to update signup team'
      )
    } finally {
      setSavingId(null)
    }
  }

  function seedPlayersFromRegistrations() {
    const pairingOn = event?.pairingEnabled !== false
    return registrations.map((r) => ({
      id: r.id,
      skillLevel: effectiveSkillScore(r, skillViewMode),
      gender: r.gender,
      pairId: pairingOn ? r.pairId : null,
      draftGroup: r.draftGroup,
      teamLocked: r.teamLocked,
    }))
  }

  function openDraftSetup() {
    setDraftError(null)
    setDraftTeamCount(
      Math.max(
        defaultTeamCount(registrations.length),
        event?.teamNames?.length ?? 0,
        ...registrations.map((r) => r.draftGroup ?? 0)
      ) || 1
    )
    setDraftSeedMode(
      hasByotLocked || hasExistingGroups ? 'existing' : 'auto'
    )
    setDraftPhase('setup')
  }

  function startDraftBoard() {
    const seeds = seedPlayersFromRegistrations()
    const n = Math.max(minDraftTeamCount, Math.floor(draftTeamCount) || 1)
    let next: Map<string, number | null>
    if (draftSeedMode === 'auto') {
      const seeded = autoSeedDraftGroups(seeds, n)
      next = new Map()
      for (const r of registrations) {
        next.set(r.id, seeded.get(r.id) ?? null)
      }
    } else if (draftSeedMode === 'existing') {
      next = copyExistingDraftGroups(seeds)
    } else {
      next = emptySeedDraftGroups(seeds)
    }
    setDraftAssignments(next)
    setDraftTeamCount(n)
    setMaxGroup((prev) => Math.max(prev, n))
    setDraftPhase('board')
  }

  function reshuffleDraft() {
    const seeds = seedPlayersFromRegistrations()
    const n = Math.max(minDraftTeamCount, Math.floor(draftTeamCount) || 1)
    const seeded = autoSeedDraftGroups(seeds, n, { shuffle: true })
    const next = new Map<string, number | null>()
    for (const r of registrations) {
      next.set(r.id, seeded.get(r.id) ?? null)
    }
    setDraftAssignments(next)
    setDraftTeamCount(n)
  }

  function discardDraft() {
    setDraftPhase('off')
    setDraftAssignments(new Map())
    setDraftError(null)
  }

  async function applyDraft() {
    setDraftApplying(true)
    setDraftError(null)
    try {
      const assignments = registrations
        .filter((r) => !r.teamLocked)
        .map((r) => ({
          registrationId: r.id,
          draftGroup: draftAssignments.get(r.id) ?? null,
        }))
      const res = await fetch(`/api/events/${eventId}/registrations/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to apply draft')
      setRegistrations((prev) =>
        prev.map((r) => {
          if (r.teamLocked) return r
          const draftGroup = draftAssignments.get(r.id) ?? null
          return {
            ...r,
            draftGroup,
            isCaptain: draftGroup == null ? false : r.isCaptain,
          }
        })
      )
      const maxAssigned = Math.max(
        0,
        ...[...draftAssignments.values()].filter((g): g is number => g != null)
      )
      if (maxAssigned > 0) setMaxGroup((prev) => Math.max(prev, maxAssigned))
      setDraftPhase('off')
      setDraftAssignments(new Map())
      setMessage('Draft applied to event')
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Failed to apply draft')
    } finally {
      setDraftApplying(false)
    }
  }

  function assignmentsObjectFromMap(
    map: Map<string, number | null>
  ): Record<string, number | null> {
    const obj: Record<string, number | null> = {}
    for (const r of registrations) {
      obj[r.id] = map.get(r.id) ?? null
    }
    return obj
  }

  async function saveSnapshot(name: string) {
    setSnapshotsBusy(true)
    setDraftError(null)
    try {
      const res = await fetch(`/api/events/${eventId}/draft-snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          assignments: assignmentsObjectFromMap(draftAssignments),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save snapshot')
      setSnapshots((prev) => [...prev, data.snapshot])
      setMessage(`Saved draft “${data.snapshot.name}”`)
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Failed to save snapshot')
    } finally {
      setSnapshotsBusy(false)
    }
  }

  function loadSnapshot(snapshotId: string) {
    const snap = snapshots.find((s) => s.id === snapshotId)
    if (!snap) return
    const next = new Map<string, number | null>()
    for (const r of registrations) {
      if (r.teamLocked) {
        next.set(r.id, r.draftGroup)
      } else {
        next.set(r.id, snap.assignments[r.id] ?? null)
      }
    }
    const maxAssigned = Math.max(
      0,
      ...Object.values(snap.assignments).filter((g): g is number => g != null)
    )
    if (maxAssigned > 0) {
      setDraftTeamCount((prev) => Math.max(prev, maxAssigned))
      setMaxGroup((prev) => Math.max(prev, maxAssigned))
    }
    setDraftAssignments(next)
    setMessage(`Loaded draft “${snap.name}” into workspace`)
  }

  async function renameSnapshot(snapshotId: string, name: string) {
    setSnapshotsBusy(true)
    setDraftError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/draft-snapshots/${snapshotId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to rename snapshot')
      setSnapshots((prev) =>
        prev.map((s) => (s.id === snapshotId ? data.snapshot : s))
      )
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Failed to rename snapshot')
      throw err
    } finally {
      setSnapshotsBusy(false)
    }
  }

  async function deleteSnapshot(snapshotId: string) {
    setSnapshotsBusy(true)
    setDraftError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/draft-snapshots/${snapshotId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete snapshot')
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId))
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Failed to delete snapshot')
      throw err
    } finally {
      setSnapshotsBusy(false)
    }
  }

  async function promoteSnapshot(snapshotId: string) {
    setSnapshotsBusy(true)
    setDraftError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/draft-snapshots/${snapshotId}/promote`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to promote snapshot')
      await load()
      setDraftPhase('off')
      setDraftAssignments(new Map())
      setMessage('Snapshot promoted to live roster')
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Failed to promote snapshot')
      throw err
    } finally {
      setSnapshotsBusy(false)
    }
  }

  async function removeRegistration(registrationId: string, label: string) {
    setRemovingId(registrationId)
    setFormError(null)
    try {
      const res = await fetch(
        `/api/events/${eventId}/registrations/${registrationId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove player')
      setRegistrations((prev) => prev.filter((r) => r.id !== registrationId))
      setMessage(`Removed ${label} from event`)
      setConfirmRemove(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to remove player')
    } finally {
      setRemovingId(null)
    }
  }

  async function deleteEvent() {
    setDeletingEvent(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete event')
      router.push(withDevMode('/events', devMode))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete event')
      setDeletingEvent(false)
      setConfirmDeleteEvent(false)
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
          filename: importFilename.trim() || 'pasted.csv',
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
    if (!importPreview) {
      setConfirmImportCommit(true)
      return
    }
    await runImportCommit()
  }

  async function runImportCommit() {
    setImportBusy(true)
    setFormError(null)
    setConfirmImportCommit(false)
    try {
      const res = await fetch('/api/players/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: importCsv,
          filename: importFilename.trim() || 'pasted.csv',
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
      setImportFilename('pasted.csv')
      setImportPreview(null)
      setImportProfileFields('skip')
      setMessage(
        `Import done: ${summary.created ?? 0} created, ${summary.updated ?? 0} updated, ${summary.register ?? 0} registered, ${summary.alreadyRegistered ?? 0} already registered${
          typeof summary.byotRegistered === 'number'
            ? `, ${summary.byotRegistered} BYOT / ${summary.freeAgentRegistered ?? 0} free agents`
            : ''
        }`
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
      <div className="team-maker mx-auto max-w-6xl p-6 text-sm text-[var(--tm-muted,#4b5563)]">
        Loading…
      </div>
    )
  }

  if (!event) {
    return (
      <div className="team-maker mx-auto max-w-6xl space-y-3 p-6">
        <LiveMessage variant="alert" className="text-sm text-red-600">
          {error || 'Event not found'}
        </LiveMessage>
        <Link
          href={withDevMode('/events', devMode)}
          className="text-sm text-[var(--tm-link,#1d4ed8)] hover:underline"
        >
          ← Events
        </Link>
      </div>
    )
  }

  return (
    <div className="team-maker mx-auto max-w-6xl space-y-6 p-6 text-[var(--tm-fg,#111827)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={withDevMode('/events', devMode)}
            className="text-sm text-[var(--tm-link,#1d4ed8)] hover:underline"
          >
            ← Events
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-[var(--tm-muted,#4b5563)]">
            {formatDisplayDate(event.eventDate)} · {event.eventTypeLabel}
            {event.eventFormatLabel ? ` · ${event.eventFormatLabel}` : ''} ·{' '}
            {event.ballTypeLabel} · {event.genderLabel}
          </p>
          {event.notes ? (
            <p className="mt-1 text-sm text-[var(--tm-muted,#4b5563)]">{event.notes}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="block text-sm">
              <span className="text-[var(--tm-muted,#4b5563)]">Type</span>
              <select
                className={`mt-1 block rounded border border-[var(--tm-border,#d1d5db)] bg-[var(--tm-surface,#fff)] px-2 py-1.5 ${FOCUS_RING}`}
                value={event.eventType}
                onChange={(e) => void updateEventMeta({ eventType: e.target.value })}
              >
                {Object.entries(EVENT_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--tm-muted,#4b5563)]">Format</span>
              <select
                className={`mt-1 block rounded border border-[var(--tm-border,#d1d5db)] bg-[var(--tm-surface,#fff)] px-2 py-1.5 ${FOCUS_RING}`}
                value={event.eventFormat ?? ''}
                onChange={(e) =>
                  void updateEventMeta({
                    eventFormat: e.target.value === '' ? null : e.target.value,
                  })
                }
              >
                <option value="">Not set</option>
                {Object.entries(EVENT_FORMATS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3">
            <SkillViewModeToggle mode={skillViewMode} onChange={setSkillViewMode} />
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-[var(--tm-fg,#1f2937)]">
            <input
              type="checkbox"
              className={`mt-0.5 ${FOCUS_RING}`}
              checked={event.pairingEnabled !== false}
              onChange={(e) => void togglePairingEnabled(e.target.checked)}
            />
            <span>
              <span className="inline-flex items-center gap-1.5">
                Allow free-agent grouping
                  <Tooltip
                  label="About grouping"
                  content="When enabled, you can group unassigned free agents so they stay together when placed on a team. Players already on a team cannot be grouped."
                />
              </span>
              <FieldHelp>
                Only unassigned free agents can be grouped; groups move together when
                you place them on teams.
              </FieldHelp>
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {draftPhase === 'off' ? (
            <Button
              variant="outline"
              disabled={registrations.length === 0 || event.teamsLocked}
              title={
                event.teamsLocked
                  ? hasByotLocked
                    ? 'Unlock teams to assign free agents'
                    : 'Unlock teams to enter draft mode'
                  : undefined
              }
              onClick={openDraftSetup}
            >
              {hasByotLocked ? 'Assign free agents' : 'Enter draft mode'}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            className="border-teal-600 text-teal-800"
            disabled={registrations.length === 0}
            onClick={() => setContactOpen(true)}
          >
            Contact registered players
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setImportOpen(true)
              setImportPreview(null)
              setImportProfileFields('skip')
              setFormError(null)
            }}
          >
            Import TeamLinkt CSV
          </Button>
          <Button
            variant="danger"
            disabled={deletingEvent}
            onClick={() => setConfirmDeleteEvent(true)}
          >
            {deletingEvent ? 'Deleting…' : 'Delete event'}
          </Button>
        </div>
      </div>

      {error ? (
        <LiveMessage variant="alert" className="text-sm text-red-600">
          {error}
        </LiveMessage>
      ) : null}
      {message ? (
        <LiveMessage variant="status" className="text-sm text-green-700">
          {message}
        </LiveMessage>
      ) : null}
      {formError && !importOpen ? (
        <LiveMessage variant="alert" className="text-sm text-red-600">
          {formError}
        </LiveMessage>
      ) : null}

      <EventTeamsSection
        hasByotLocked={hasByotLocked}
        teamsLocked={event.teamsLocked}
        teamsFinalizedAt={event.teamsFinalizedAt}
        teamNamesDraft={teamNamesDraft}
        onTeamNamesDraftChange={setTeamNamesDraft}
        byotTeamIndexes={byotTeamIndexes}
        showFreeAgentTeamLabel={showFreeAgentTeamLabel}
        freeAgents={freeAgents}
        teamsActionBusy={teamsActionBusy}
        teamNamesSaving={teamNamesSaving}
        hasExistingGroups={hasExistingGroups}
        onFinalize={() => setConfirmFinalize(true)}
        onSetLocked={(locked) => void setTeamsLocked(locked)}
        onExport={exportDodgeballHub}
        onSaveTeamNames={() => void saveTeamNames()}
      />

      {draftPhase !== 'board' && counts.unassigned > 0 ? (
        <div
          className="rounded-lg border border-[var(--tm-amber-border,#fcd34d)] bg-[var(--tm-amber-bg,#fffbeb)] px-4 py-3 text-sm text-[var(--tm-amber-fg,#78350f)]"
          role="status"
        >
          <p className="font-medium">
            {counts.unassigned} registered{' '}
            {counts.unassigned === 1 ? 'player is' : 'players are'} not on a team
          </p>
        </div>
      ) : null}

      {draftPhase === 'setup' ? (
        <EventDraftSetup
          hasByotLocked={hasByotLocked}
          minDraftTeamCount={minDraftTeamCount}
          registrationCount={registrations.length}
          draftTeamCount={draftTeamCount}
          onDraftTeamCountChange={setDraftTeamCount}
          draftSeedMode={draftSeedMode}
          onDraftSeedModeChange={setDraftSeedMode}
          hasExistingGroups={hasExistingGroups}
          onCancel={discardDraft}
          onStart={startDraftBoard}
        />
      ) : null}

      {draftPhase === 'board' ? (
        <EventDraftBoard
          registrations={registrations}
          teamCount={draftTeamCount}
          assignments={draftAssignments}
          onAssignmentsChange={setDraftAssignments}
          onReshuffle={reshuffleDraft}
          onApply={() => void applyDraft()}
          onDiscard={discardDraft}
          applying={draftApplying}
          error={draftError}
          pairingEnabled={event.pairingEnabled !== false}
          skillViewMode={skillViewMode}
          teamNames={event.teamNames ?? []}
          teamsLocked={event.teamsLocked}
          byotMode={hasByotLocked}
          snapshots={snapshots}
          snapshotsBusy={snapshotsBusy}
          onSaveSnapshot={saveSnapshot}
          onLoadSnapshot={loadSnapshot}
          onRenameSnapshot={renameSnapshot}
          onDeleteSnapshot={deleteSnapshot}
          onPromoteSnapshot={promoteSnapshot}
        />
      ) : null}

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded border border-[var(--tm-border,#e5e7eb)] px-3 py-2">
          <div className="text-[var(--tm-muted,#6b7280)]">Total</div>
          <div className="text-xl font-semibold">{counts.total}</div>
        </div>
        <div
          className={`rounded border px-3 py-2 ${
            counts.unassigned > 0
              ? 'border-[var(--tm-amber-border,#fcd34d)] bg-[var(--tm-amber-bg,#fffbeb)]'
              : 'border-[var(--tm-border,#e5e7eb)]'
          }`}
        >
          <div className="text-[var(--tm-muted,#6b7280)]">Draft buckets</div>
          <div>
            <span
              className={
                counts.unassigned > 0 ? 'font-semibold text-amber-800' : undefined
              }
            >
              Unassigned {counts.unassigned}
            </span>
            {' · '}
            Assigned {counts.assigned}
          </div>
          {groupOptions.length > 0 ? (
            <div className="text-xs mt-1 text-gray-600">
              {groupOptions
                .map(
                  (g) =>
                    `${resolveTeamName(g, event.teamNames)}: ${counts.byGroup.get(g) ?? 0}`
                )
                .join(' · ')}
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Gender by skill matrix</caption>
          <thead className="bg-gray-50 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Gender \\ Skill</th>
              {counts.skillCols.map((level) => (
                <th
                  key={String(level)}
                  scope="col"
                  className="px-3 py-2 font-medium whitespace-nowrap"
                >
                  {skillMatrixColLabel(level, skillViewMode)}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {GENDER_ROWS.map((row) => (
              <tr key={row} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium">{genderRowLabel(row)}</td>
                {counts.skillCols.map((level) => {
                  const key = level == null ? 'unset' : String(level)
                  return (
                    <td key={key} className="px-3 py-2 tabular-nums">
                      {counts.matrix[row][key] ?? 0}
                    </td>
                  )
                })}
                <td className="px-3 py-2 font-medium tabular-nums">
                  {counts.rowTotals[row]}
                </td>
              </tr>
            ))}
            <tr className="border-t border-gray-200 bg-gray-50">
              <td className="px-3 py-2 font-medium">Total</td>
              {counts.skillCols.map((level) => {
                const key = level == null ? 'unset' : String(level)
                return (
                  <td key={key} className="px-3 py-2 font-medium tabular-nums">
                    {counts.colTotals[key] ?? 0}
                  </td>
                )
              })}
              <td className="px-3 py-2 font-semibold tabular-nums">{counts.total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {draftPhase === 'off' ? (
        <>
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
                    {resolveTeamName(g, event.teamNames)}
                  </option>
                ))}
              </select>
            </label>
            {counts.unassigned > 0 && draftFilter !== 'unassigned' ? (
              <button
                type="button"
                className={`rounded border border-amber-400 bg-amber-50 px-2 py-1 text-sm text-amber-950 ${FOCUS_RING}`}
                onClick={() => setDraftFilter('unassigned')}
              >
                Show unassigned ({counts.unassigned})
              </button>
            ) : null}
            {draftFilter !== 'all' ? (
              <span className="inline-flex flex-wrap items-center gap-2 text-sm text-gray-700">
                <span>
                  Showing{' '}
                  {draftFilter === 'unassigned'
                    ? 'unassigned'
                    : resolveTeamName(draftFilter, event.teamNames)}{' '}
                  ({filtered.length})
                </span>
                <button
                  type="button"
                  className={`text-xs text-blue-700 hover:underline ${FOCUS_RING}`}
                  onClick={() => setDraftFilter('all')}
                >
                  Clear filter
                </button>
              </span>
            ) : null}
            <button
              type="button"
              className={`rounded border px-2 py-1 text-sm ${FOCUS_RING}`}
              onClick={() => setMaxGroup((n) => n + 1)}
              disabled={event.teamsLocked}
            >
              Add group {maxGroup + 1}
            </button>
          </div>

          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Event registrations</caption>
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium">Skill</th>
                  <th scope="col" className="px-3 py-2 font-medium">Gender</th>
                  <th scope="col" className="px-3 py-2 font-medium">Email</th>
                  <th scope="col" className="px-3 py-2 font-medium">Draft group</th>
                  <th scope="col" className="px-3 py-2 font-medium">Captain</th>
                  {event.pairingEnabled !== false ? (
                    <th scope="col" className="px-3 py-2 font-medium">Group</th>
                  ) : null}
                  <th scope="col" className="px-3 py-2 font-medium">Lock</th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={event.pairingEnabled !== false ? 9 : 8}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      {registrations.length === 0
                        ? 'No registrations yet. Import a TeamLinkt CSV for this event.'
                        : 'No players match this filter.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const label =
                      r.nickname || `${r.firstName} ${r.lastName}`
                    const badge = captainBadge(r, registrations)
                    const onTeam = r.draftGroup != null
                    const canGroup = !r.teamLocked && r.draftGroup == null
                    const addableOptions = canGroup
                      ? registrations.filter(
                          (other) =>
                            other.id !== r.id &&
                            !other.teamLocked &&
                            other.draftGroup == null &&
                            other.pairId == null
                        )
                      : []
                    const joinOptions = canGroup
                      ? registrations.filter(
                          (other) =>
                            other.id !== r.id &&
                            !other.teamLocked &&
                            other.draftGroup == null &&
                            ((r.pairId == null && other.pairId == null) ||
                              (r.pairId == null && other.pairId != null) ||
                              (r.pairId != null && other.pairId == null))
                        )
                      : []
                    return (
                      <tr
                        key={r.id}
                        className={`border-t border-gray-100 ${genderRowClass(r.gender)}`}
                      >
                        <td className="px-3 py-2">
                          <SkillStyledText
                            score={effectiveSkillScore(r, skillViewMode)}
                            mode={skillViewMode}
                          >
                            {label}
                          </SkillStyledText>
                          {r.teamLocked ? (
                            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              Locked
                            </span>
                          ) : onTeam && showFreeAgentTeamLabel ? (
                            <Tooltip
                              label="Free agent"
                              content="Added to this team after signup (not an original BYOT member)."
                            >
                              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                                FA
                              </span>
                            </Tooltip>
                          ) : null}
                          {r.hasStrongPersonality ? (
                            <Tooltip
                              label="Strong personality"
                              content={
                                r.strongPersonalityNotes ||
                                'Flagged as strong personality'
                              }
                            >
                              <span className="ml-1 text-amber-500">⚡</span>
                            </Tooltip>
                          ) : null}
                          {badge ? (
                            <Tooltip
                              label={badge === '(CC)' ? 'Co-captain' : 'Captain'}
                              content={
                                badge === '(CC)'
                                  ? 'Co-captain on this team (more than one captain assigned).'
                                  : 'Team captain.'
                              }
                            >
                              <span className="ml-1 text-xs font-medium text-blue-700">
                                {badge}
                              </span>
                            </Tooltip>
                          ) : null}
                          {event.pairingEnabled !== false &&
                          r.groupMembers.length > 0 ? (
                            <div className="text-xs text-violet-700">
                              Group with{' '}
                              {r.groupMembers.map((m) => m.nickname).join(', ')}
                            </div>
                          ) : event.pairingEnabled !== false &&
                            r.partnerNickname ? (
                            <div className="text-xs text-violet-700">
                              Grouped with {r.partnerNickname}
                            </div>
                          ) : null}
                          <div className="text-xs text-gray-500">
                            {r.firstName} {r.lastName}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {effectiveSkillScore(r, skillViewMode) != null
                            ? effectiveSkillLabel(r, skillViewMode)
                            : '—'}
                        </td>
                        <td className="px-3 py-2">{r.genderGroupLabel}</td>
                        <td className="px-3 py-2 text-xs">{r.primaryEmail ?? '—'}</td>
                        <td className="px-3 py-2">
                          <select
                            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
                            disabled={
                              savingId === r.id ||
                              event.teamsLocked ||
                              r.teamLocked
                            }
                            title={
                              event.teamsLocked
                                ? 'Unlock teams to change assignments'
                                : r.teamLocked
                                  ? 'Locked signup — use Unlock to move'
                                  : undefined
                            }
                            value={r.draftGroup == null ? '' : String(r.draftGroup)}
                            onChange={(e) => {
                              const v = e.target.value
                              void setDraftGroup(
                                r.id,
                                v === '' ? null : Number.parseInt(v, 10)
                              )
                            }}
                          >
                            <option value="">Unassigned</option>
                            {groupOptions.map((g) => (
                              <option key={g} value={g}>
                                {resolveTeamName(g, event.teamNames)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {onTeam ? (
                            <button
                              type="button"
                              className={`text-xs disabled:opacity-40 ${r.isCaptain ? 'font-medium text-blue-700 hover:text-blue-900' : 'text-gray-500 hover:text-gray-700'}`}
                              disabled={savingId === r.id}
                              aria-label={
                                r.isCaptain
                                  ? badge === '(CC)'
                                    ? 'Remove co-captain'
                                    : 'Remove captain'
                                  : 'Set as captain'
                              }
                              onClick={() => void toggleCaptain(r.id, !r.isCaptain)}
                            >
                              {r.isCaptain
                                ? `${badge ?? '(C)'} Remove`
                                : 'Set (C)'}
                            </button>
                          ) : (
                            <Tooltip
                              label="Captain assignment"
                              content="Assign to a team first"
                            >
                              <span className="text-xs text-gray-400">—</span>
                            </Tooltip>
                          )}
                        </td>
                        {event.pairingEnabled !== false ? (
                          <td className="px-3 py-2">
                            {!canGroup && !r.pairId ? (
                              <span className="text-xs text-gray-400">—</span>
                            ) : r.pairId ? (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  className="text-left text-xs text-violet-700 hover:underline disabled:opacity-40"
                                  disabled={savingId === r.id}
                                  onClick={() => void leaveGroup(r.id)}
                                >
                                  Leave group
                                </button>
                                <button
                                  type="button"
                                  className="text-left text-xs text-violet-700 hover:underline disabled:opacity-40"
                                  disabled={savingId === r.id}
                                  onClick={() => void dissolveGroup(r.id)}
                                >
                                  Dissolve
                                </button>
                                {canGroup && addableOptions.length > 0 ? (
                                  <select
                                    className="max-w-[10rem] rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                                    disabled={savingId === r.id}
                                    defaultValue=""
                                    onChange={(e) => {
                                      const partnerId = e.target.value
                                      e.target.value = ''
                                      if (!partnerId) return
                                      void pairWith(r.id, partnerId)
                                    }}
                                  >
                                    <option value="">Add to group…</option>
                                    {addableOptions.map((other) => (
                                      <option key={other.id} value={other.id}>
                                        {other.nickname ||
                                          `${other.firstName} ${other.lastName}`}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                              </div>
                            ) : joinOptions.length > 0 ? (
                              <select
                                className="max-w-[10rem] rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                                disabled={savingId === r.id}
                                defaultValue=""
                                onChange={(e) => {
                                  const partnerId = e.target.value
                                  e.target.value = ''
                                  if (!partnerId) return
                                  void pairWith(r.id, partnerId)
                                }}
                              >
                                <option value="">Group with…</option>
                                {joinOptions.map((other) => (
                                  <option key={other.id} value={other.id}>
                                    {other.nickname ||
                                      `${other.firstName} ${other.lastName}`}
                                    {other.pairId ? ' (group)' : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-3 py-2">
                          {r.draftGroup == null && !r.teamLocked ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <button
                              type="button"
                              className={`text-xs disabled:opacity-40 ${
                                r.teamLocked
                                  ? 'font-medium text-amber-800 hover:underline'
                                  : 'text-gray-500 hover:underline'
                              }`}
                              disabled={savingId === r.id || event.teamsLocked}
                              title={
                                event.teamsLocked
                                  ? 'Unlock teams first'
                                  : r.teamLocked
                                    ? 'Allow moving this player when assigning'
                                    : 'Lock to current team (signup)'
                              }
                              onClick={() =>
                                void setSignupOverride(r.id, {
                                  teamLocked: !r.teamLocked,
                                  draftGroup: r.draftGroup,
                                })
                              }
                            >
                              {r.teamLocked ? 'Unlock' : 'Lock'}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className={`min-h-11 text-xs text-red-700 hover:underline disabled:opacity-40 md:min-h-0 ${FOCUS_RING}`}
                            disabled={removingId === r.id}
                            onClick={() =>
                              setConfirmRemove({ id: r.id, label })
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {draftPhase !== 'board' ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reach out</h2>
              <FieldHelp>
                Players with selected home leagues who are not registered for this
                event.
              </FieldHelp>
              {!reachOutLoading && !reachOutError ? (
                <p className="mt-1 text-sm text-gray-600">
                  {reachOutPlayers.length} not registered
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className={`rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40 ${FOCUS_RING}`}
              disabled={reachOutLoading || reachOutPlayers.length === 0}
              onClick={() => void copyReachOutEmails()}
            >
              Copy emails
            </button>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={reachOutIncludeOthers}
                onChange={(e) => {
                  const checked = e.target.checked
                  setReachOutIncludeOthers(checked)
                  if (!checked) {
                    setReachOutLeagues([DEFAULT_REACH_OUT_LEAGUE])
                  }
                }}
              />
              Include other home leagues
            </label>
            {reachOutIncludeOthers ? (
              <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-50 ${FOCUS_RING}`}
                    onClick={() => setReachOutLeagues([...HOME_LEAGUE_CODES])}
                  >
                    All leagues
                  </button>
                  <button
                    type="button"
                    className={`rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-50 ${FOCUS_RING}`}
                    onClick={() => setReachOutLeagues([DEFAULT_REACH_OUT_LEAGUE])}
                  >
                    BDL only
                  </button>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {HOME_LEAGUE_CODES.map((code) => (
                    <label
                      key={code}
                      className="flex items-center gap-2 text-sm text-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={reachOutLeagues.includes(code)}
                        onChange={() => toggleReachOutLeague(code)}
                      />
                      {HOME_LEAGUES[code]}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {reachOutCopyMessage ? (
            <LiveMessage variant="status" className="text-sm text-green-700">
              {reachOutCopyMessage}
            </LiveMessage>
          ) : null}
          {reachOutError ? (
            <LiveMessage variant="alert" className="text-sm text-red-600">
              {reachOutError}
            </LiveMessage>
          ) : null}

          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-sm">
              <caption className="sr-only">
                Unregistered local players for outreach
              </caption>
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Skill
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Gender
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Email
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Home leagues
                  </th>
                </tr>
              </thead>
              <tbody>
                {reachOutLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : reachOutPlayers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      No matching players to reach out to.
                    </td>
                  </tr>
                ) : (
                  reachOutPlayers.map((p) => {
                    const label =
                      p.nickname || `${p.firstName} ${p.lastName}`
                    return (
                      <tr
                        key={p.id}
                        className={`border-t border-gray-100 ${genderRowClass(p.gender)}`}
                      >
                        <td className="px-3 py-2">
                          <SkillStyledText
                            score={effectiveSkillScore(p, skillViewMode)}
                            mode={skillViewMode}
                          >
                            {label}
                          </SkillStyledText>
                          <div className="text-xs text-gray-500">
                            {p.firstName} {p.lastName}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {effectiveSkillScore(p, skillViewMode) != null
                            ? effectiveSkillLabel(p, skillViewMode)
                            : '—'}
                        </td>
                        <td className="px-3 py-2">{p.genderGroupLabel}</td>
                        <td className="px-3 py-2 text-xs">
                          {p.primaryEmail ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {p.homeLeagues.length > 0
                            ? p.homeLeagues.map((h) => h.label).join(', ')
                            : '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={`Import TeamLinkt CSV for ${event.name}`}
        className="max-w-3xl"
      >
        <div className="space-y-4 text-gray-900">
          <FieldHelp className="text-sm">
            Players are upserted as usual, and each matched/created player is
            registered for this event. Re-imports keep draft group assignments.
          </FieldHelp>
          <label className="block text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              Existing players: skill / gender / jersey
              <Tooltip
                label="Profile field updates"
                content="Choose whether CSV values replace existing player skill, gender, and jersey fields."
              />
            </span>
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
            <FieldHelp>
              Skip leaves current values; fill blanks only updates empty fields;
              overwrite replaces from the CSV.
            </FieldHelp>
          </label>
          <label className="block text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              CSV file
              <Tooltip
                label="CSV file"
                content="Upload a TeamLinkt export, or paste CSV contents in the box below."
              />
            </span>
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
            {importFilename && importFilename !== 'pasted.csv' ? (
              <FieldHelp>Using file: {importFilename}</FieldHelp>
            ) : null}
          </label>
          <div>
            <label htmlFor="import-csv-paste" className="text-sm text-gray-600">
              CSV contents
            </label>
            <textarea
              id="import-csv-paste"
              className="mt-1 w-full h-40 rounded border border-gray-300 px-3 py-2 font-mono text-xs"
              value={importCsv}
              onChange={(e) => {
                setImportCsv(e.target.value)
                setImportPreview(null)
              }}
              placeholder="Or paste CSV contents here…"
            />
            <FieldHelp>
              Paste here if you do not have a file handy. Include a Team Name
              column for BYOT players; blank team = free agent. Dry run previews
              changes before commit.
            </FieldHelp>
          </div>
          {formError ? (
            <LiveMessage variant="alert" className="text-sm text-red-600">
              {formError}
            </LiveMessage>
          ) : null}
          {importPreview ? (
            <div className="space-y-2 text-sm">
              <LiveMessage variant="status">
                Preview: {importPreview.summary.create} create,{' '}
                {importPreview.summary.update} update, {importPreview.summary.skip} skip,{' '}
                {importPreview.summary.ambiguous} ambiguous
                {typeof importPreview.summary.register === 'number' ? (
                  <>
                    ; {importPreview.summary.register} will register,{' '}
                    {importPreview.summary.alreadyRegistered ?? 0} already registered
                  </>
                ) : null}
                {typeof importPreview.summary.byot === 'number' ? (
                  <>
                    ; {importPreview.summary.byot} BYOT /{' '}
                    {importPreview.summary.freeAgents ?? 0} free agents
                  </>
                ) : null}
              </LiveMessage>
              <div className="max-h-48 overflow-y-auto border rounded">
                <table className="min-w-full text-xs">
                  <caption className="sr-only">Import preview</caption>
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-2 py-1 text-left">Row</th>
                      <th scope="col" className="px-2 py-1 text-left">Action</th>
                      <th scope="col" className="px-2 py-1 text-left">Name</th>
                      <th scope="col" className="px-2 py-1 text-left">Detail</th>
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
              className={`rounded border px-3 py-2 text-sm ${FOCUS_RING}`}
              onClick={() => setImportOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              disabled={importBusy || !importCsv.trim()}
              className={`rounded border px-3 py-2 text-sm disabled:opacity-40 ${FOCUS_RING}`}
              onClick={() => void previewImport()}
            >
              Dry run
            </button>
            <button
              type="button"
              disabled={importBusy || !importCsv.trim()}
              className={`rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40 ${FOCUS_RING}`}
              onClick={() => void commitImport()}
            >
              {importPreview ? 'Commit import' : 'Import now'}
            </button>
          </div>
        </div>
      </Dialog>

      {contactOpen && event ? (
        <ContactPlayersDialog
          open={contactOpen}
          onClose={() => setContactOpen(false)}
          audience={{
            mode: 'filter',
            filters: { eventId },
            label: `${registrations.length} registered for ${event.name}`,
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDeleteEvent}
        onClose={() => setConfirmDeleteEvent(false)}
        title="Delete event"
        danger
        confirmLabel={deletingEvent ? 'Deleting…' : 'Delete'}
        busy={deletingEvent}
        onConfirm={() => void deleteEvent()}
      >
        Delete “{event.name}”? This removes the event and all its registrations.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmFinalize}
        onClose={() => setConfirmFinalize(false)}
        title="Finalize teams"
        confirmLabel={teamsActionBusy ? 'Finalizing…' : 'Finalize'}
        busy={teamsActionBusy}
        onConfirm={() => void finalizeTeams()}
      >
        Finalize teams? This locks assignments and unlocks DodgeballHub export.
        You can unlock later for late registrations.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRemove != null}
        onClose={() => setConfirmRemove(null)}
        title="Remove registration"
        danger
        confirmLabel={removingId ? 'Removing…' : 'Remove'}
        busy={removingId != null}
        onConfirm={() => {
          if (!confirmRemove) return
          void removeRegistration(confirmRemove.id, confirmRemove.label)
        }}
      >
        Remove {confirmRemove?.label} from this event?
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmImportCommit}
        onClose={() => setConfirmImportCommit(false)}
        title="Import without dry run"
        confirmLabel={importBusy ? 'Importing…' : 'Import now'}
        busy={importBusy}
        onConfirm={() => void runImportCommit()}
      >
        Import without a dry run? This will create/update players and register
        them for this event.
      </ConfirmDialog>
    </div>
  )
}
