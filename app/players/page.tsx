'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  SKILL_LEVELS,
  defaultJerseyName,
  defaultNickname,
  skillLevelLabel,
} from '@/app/lib/players/skill'
import {
  GENDERS,
  genderGroup,
  genderGroupSortKey,
  type GenderGroup,
} from '@/app/lib/players/gender'
import {
  HOME_LEAGUES,
  HOME_LEAGUE_LOGOS,
  isValidHomeLeague,
  type HomeLeague,
} from '@/app/lib/players/home-league'
import { shouldPromptForStrongPersonalityNotes } from '@/app/lib/players/strong-personality'
import type { PlayerListItem, PlayerSnapshot } from '@/app/lib/players/types'
import type { EventListItem } from '@/app/lib/events/types'

type HistoryRow = {
  id: string
  source: string
  actor: string
  changeType: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: string
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

type QuickFillDraft = {
  skillLevel: string
  gender: string
}

/** Empty string = leave field unchanged on apply. */
type BulkEditDraft = {
  gender: string
  skillLevel: string
  strongPersonality: '' | 'on' | 'off'
  strongPersonalityNotes: string
  addHomeLeague: string
  removeHomeLeague: string
}

const EMPTY_BULK_EDIT_DRAFT: BulkEditDraft = {
  gender: '',
  skillLevel: '',
  strongPersonality: '',
  strongPersonalityNotes: '',
  addHomeLeague: '',
  removeHomeLeague: '',
}

function buildBulkEditPatch(draft: BulkEditDraft): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {}
  if (draft.gender !== '') {
    patch.gender = draft.gender === '__clear__' ? null : draft.gender
  }
  if (draft.skillLevel !== '') {
    patch.skillLevel = draft.skillLevel === '__clear__' ? null : Number(draft.skillLevel)
  }
  if (draft.strongPersonality === 'on') {
    patch.hasStrongPersonality = true
    patch.strongPersonalityNotes = draft.strongPersonalityNotes.trim() || null
  } else if (draft.strongPersonality === 'off') {
    patch.hasStrongPersonality = false
    if (draft.strongPersonalityNotes.trim()) {
      patch.strongPersonalityNotes = draft.strongPersonalityNotes.trim()
    }
  } else if (draft.strongPersonalityNotes.trim()) {
    patch.strongPersonalityNotes = draft.strongPersonalityNotes.trim()
  }
  if (draft.addHomeLeague) patch.addHomeLeague = draft.addHomeLeague
  if (draft.removeHomeLeague) patch.removeHomeLeague = draft.removeHomeLeague
  return Object.keys(patch).length > 0 ? patch : null
}

function parseJerseyNumber(value: string): number | null {
  if (!value.trim()) return null
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

function hasMissingSkill(player: { skillLevel: number | null }): boolean {
  return player.skillLevel === null
}

function hasMissingGender(player: { gender: string | null }): boolean {
  return player.gender === null
}

function hasMissingInfo(player: { skillLevel: number | null; gender: string | null }): boolean {
  return hasMissingSkill(player) || hasMissingGender(player)
}

function countMissingFields(player: { skillLevel: number | null; gender: string | null }): number {
  return Number(hasMissingSkill(player)) + Number(hasMissingGender(player))
}

function quickFillDraftForPlayer(player: PlayerListItem): QuickFillDraft {
  return {
    skillLevel: player.skillLevel != null ? String(player.skillLevel) : '',
    gender: player.gender ?? '',
  }
}

function buildQuickFillPatch(
  player: PlayerListItem,
  draft: QuickFillDraft
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (hasMissingSkill(player) && draft.skillLevel !== '') {
    patch.skillLevel = Number(draft.skillLevel)
  }
  if (hasMissingGender(player) && draft.gender !== '') {
    patch.gender = draft.gender
  }
  return patch
}

/** True when every currently-missing field has a value ready to save. */
function isQuickFillReady(player: PlayerListItem, draft: QuickFillDraft): boolean {
  if (hasMissingSkill(player) && draft.skillLevel === '') return false
  if (hasMissingGender(player) && draft.gender === '') return false
  return hasMissingInfo(player)
}

/** Skill cues: beginner italic+parens, intermediate normal, advanced bold, worlds bold+underline. */
function HomeLeagueMark(props: {
  label: string
  logoUrl?: string | null
  size?: 'sm' | 'md'
}) {
  const sizeClass = props.size === 'md' ? 'h-7 w-7' : 'h-5 w-5'
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      {props.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.logoUrl}
          alt=""
          className={`${sizeClass} rounded-sm object-contain bg-white shrink-0`}
        />
      ) : null}
      <span className="truncate">{props.label}</span>
    </span>
  )
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

function genderRowClass(gender: string | null, isMerged: boolean): string {
  if (isMerged) return 'bg-gray-50 text-gray-500'
  const group = genderGroup(gender)
  if (group === 'w_nb_o') return 'bg-rose-50/70 text-gray-900'
  if (group === 'men') return 'bg-sky-50/70 text-gray-900'
  return 'text-gray-900'
}

function sortIndicator(active: boolean, dir: 'asc' | 'desc'): string {
  if (!active) return '↕'
  return dir === 'asc' ? '↑' : '↓'
}

function SortableHeaderButton(props: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`inline-flex items-center gap-1 font-medium hover:text-gray-900 ${
        props.active ? 'text-gray-900' : 'text-gray-700'
      }`}
    >
      {props.label}
      <span className="text-xs text-gray-500" aria-hidden>
        {sortIndicator(props.active, props.dir)}
      </span>
    </button>
  )
}

function SortableHeader(props: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <th className="px-3 py-2">
      <SortableHeaderButton {...props} />
    </th>
  )
}

type SortKey = 'first' | 'last' | 'jersey' | 'jerseyName' | 'gender' | 'skill'

type ColumnKey =
  | 'fullName'
  | 'roster'
  | 'nickname'
  | 'jerseyNumber'
  | 'jerseyName'
  | 'gender'
  | 'skill'
  | 'email'
  | 'homeLeagues'

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: 'fullName', label: 'Full name' },
  { key: 'roster', label: 'Roster name' },
  { key: 'nickname', label: 'Nickname' },
  { key: 'jerseyNumber', label: 'Jersey #' },
  { key: 'jerseyName', label: 'Jersey name' },
  { key: 'gender', label: 'Gender' },
  { key: 'skill', label: 'Skill' },
  { key: 'email', label: 'Email' },
  { key: 'homeLeagues', label: 'Home leagues' },
]

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  fullName: true,
  roster: true,
  nickname: true,
  jerseyNumber: false,
  jerseyName: false,
  gender: true,
  skill: true,
  email: true,
  homeLeagues: false,
}

/** Compact roster view for drafting teams. */
const MINIMAL_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  ...DEFAULT_VISIBLE_COLUMNS,
  fullName: false,
  roster: false,
  email: false,
}

const COLUMNS_STORAGE_KEY = 'bdl-admin.players.visibleColumns'

function loadVisibleColumns(): Record<ColumnKey, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_VISIBLE_COLUMNS }
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_VISIBLE_COLUMNS }
    const parsed = JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>
    return {
      ...DEFAULT_VISIBLE_COLUMNS,
      ...parsed,
    }
  } catch {
    return { ...DEFAULT_VISIBLE_COLUMNS }
  }
}

function compareByLastName(a: PlayerListItem, b: PlayerListItem): number {
  const last = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' })
  if (last !== 0) return last
  return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' })
}

function compareByFirstName(a: PlayerListItem, b: PlayerListItem): number {
  const first = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' })
  if (first !== 0) return first
  return a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' })
}

function compareJersey(a: PlayerListItem, b: PlayerListItem): number {
  if (a.jerseyNumber == null && b.jerseyNumber == null) return 0
  if (a.jerseyNumber == null) return 1
  if (b.jerseyNumber == null) return -1
  return a.jerseyNumber - b.jerseyNumber
}

function compareJerseyName(a: PlayerListItem, b: PlayerListItem): number {
  const cmp = a.jerseyName.localeCompare(b.jerseyName, undefined, { sensitivity: 'base' })
  if (cmp !== 0) return cmp
  return compareByLastName(a, b)
}

function compareSkill(a: PlayerListItem, b: PlayerListItem): number {
  if (a.skillLevel == null && b.skillLevel == null) return 0
  if (a.skillLevel == null) return 1
  if (b.skillLevel == null) return -1
  return a.skillLevel - b.skillLevel
}

function comparePlayers(a: PlayerListItem, b: PlayerListItem, key: SortKey): number {
  if (key === 'first') return compareByFirstName(a, b)
  if (key === 'last') return compareByLastName(a, b)
  if (key === 'jersey') return compareJersey(a, b)
  if (key === 'jerseyName') return compareJerseyName(a, b)
  if (key === 'gender') {
    const g = genderGroupSortKey(a.gender) - genderGroupSortKey(b.gender)
    if (g !== 0) return g
    return compareByLastName(a, b)
  }
  const s = compareSkill(a, b)
  if (s !== 0) return s
  return compareByLastName(a, b)
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [homeLeagueFilter, setHomeLeagueFilter] = useState<'' | 'unset' | HomeLeague>('')
  const [eventFilter, setEventFilter] = useState('')
  const [events, setEvents] = useState<EventListItem[]>([])
  const [eventsStatus, setEventsStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    'idle'
  )
  const [genderFilter, setGenderFilter] = useState<'' | GenderGroup>('')
  const [sortKey, setSortKey] = useState<SortKey>('last')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [includeMerged, setIncludeMerged] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    DEFAULT_VISIBLE_COLUMNS
  )
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [quickFillMode, setQuickFillMode] = useState(false)
  const [quickFillDrafts, setQuickFillDrafts] = useState<Record<string, QuickFillDraft>>({})
  const [quickFillSavingId, setQuickFillSavingId] = useState<string | null>(null)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEditDraft, setBulkEditDraft] = useState<BulkEditDraft>(EMPTY_BULK_EDIT_DRAFT)
  const [bulkEditBusy, setBulkEditBusy] = useState(false)
  const [bulkEditMessage, setBulkEditMessage] = useState<string | null>(null)

  useEffect(() => {
    setVisibleColumns(loadVisibleColumns())
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns))
    } catch {
      // ignore quota / private mode
    }
  }, [visibleColumns])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const showFullNameColumns = visibleColumns.fullName
  const showGenderColumn = visibleColumns.gender || quickFillMode
  const showSkillColumn = visibleColumns.skill || quickFillMode
  const showHomeLeaguesColumn = visibleColumns.homeLeagues || bulkEditMode

  const visibleColumnCount =
    (showFullNameColumns ? 2 : 0) +
    COLUMN_OPTIONS.filter((c) => {
      if (c.key === 'fullName') return false
      if (c.key === 'gender') return showGenderColumn
      if (c.key === 'skill') return showSkillColumn
      if (c.key === 'homeLeagues') return showHomeLeaguesColumn
      return visibleColumns[c.key]
    }).length +
    (bulkEditMode ? 1 : 0) + // checkbox
    1 // actions

  const loadEvents = useCallback(async () => {
    if (eventsStatus === 'loading' || eventsStatus === 'loaded') return
    setEventsStatus('loading')
    try {
      const res = await fetch('/api/events')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load events')
      setEvents(data.events ?? [])
      setEventsStatus('loaded')
    } catch {
      setEventsStatus('error')
    }
  }, [eventsStatus])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<PlayerSnapshot | null>(null)
  const [history, setHistory] = useState<HistoryRow[] | null>(null)
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null)

  const [mergeOpen, setMergeOpen] = useState(false)
  const [survivorId, setSurvivorId] = useState('')

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

  const [createOpen, setCreateOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (skillFilter) params.set('skill', skillFilter)
      if (homeLeagueFilter) params.set('homeLeague', homeLeagueFilter)
      if (eventFilter) params.set('eventId', eventFilter)
      if (includeMerged) params.set('includeMerged', '1')
      const res = await fetch(`/api/players?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load players')
      setPlayers(data.players)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }, [q, skillFilter, homeLeagueFilter, eventFilter, includeMerged])

  useEffect(() => {
    void loadPlayers()
  }, [loadPlayers])

  const missingPlayersCount = useMemo(
    () => players.filter((player) => !player.isMerged && hasMissingInfo(player)).length,
    [players]
  )

  const displayedPlayers = useMemo(() => {
    const filtered = genderFilter
      ? players.filter((p) => genderGroup(p.gender) === genderFilter)
      : players
    const quickFillFiltered = quickFillMode
      ? filtered.filter((p) => !p.isMerged && hasMissingInfo(p))
      : filtered
    const sorted = [...quickFillFiltered]
    sorted.sort((a, b) => {
      if (quickFillMode) {
        const missingCmp = countMissingFields(b) - countMissingFields(a)
        if (missingCmp !== 0) return missingCmp
      }
      const cmp = comparePlayers(a, b, sortKey)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [players, genderFilter, sortKey, sortDir, quickFillMode])

  // One player at a time in quick fill; queue length stays on displayedPlayers.
  const quickFillRows = useMemo(
    () => (quickFillMode ? displayedPlayers.slice(0, 1) : displayedPlayers),
    [displayedPlayers, quickFillMode]
  )

  useEffect(() => {
    if (!quickFillMode || quickFillSavingId) return
    const focusEl = document.querySelector<HTMLSelectElement>(
      'select[data-quick-fill-focus="true"]'
    )
    focusEl?.focus()
  }, [quickFillMode, quickFillSavingId, quickFillRows[0]?.id, quickFillDrafts])

  const selectedPlayers = useMemo(
    () => displayedPlayers.filter((p) => selectedIds.has(p.id)),
    [displayedPlayers, selectedIds]
  )

  const selectableVisibleIds = useMemo(
    () => displayedPlayers.filter((p) => !p.isMerged).map((p) => p.id),
    [displayedPlayers]
  )

  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => selectedIds.has(id))

  const someVisibleSelected =
    selectableVisibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const id of selectableVisibleIds) next.delete(id)
      } else {
        for (const id of selectableVisibleIds) next.add(id)
      }
      return next
    })
  }

  function enterBulkEditMode() {
    setQuickFillMode(false)
    setBulkEditMode(true)
    setBulkEditMessage(null)
    setFormError(null)
  }

  function exitBulkEditMode() {
    setBulkEditMode(false)
    setSelectedIds(new Set())
    setBulkEditDraft(EMPTY_BULK_EDIT_DRAFT)
    setBulkEditMessage(null)
    setFormError(null)
  }

  async function applyBulkEdit() {
    if (selectedIds.size === 0 || bulkEditBusy) return
    const patch = buildBulkEditPatch(bulkEditDraft)
    if (!patch) {
      setFormError('Choose at least one field to update')
      return
    }
    if (
      bulkEditDraft.strongPersonality === 'on' &&
      shouldPromptForStrongPersonalityNotes(true, bulkEditDraft.strongPersonalityNotes)
    ) {
      setFormError('Add strong personality notes when enabling the flag')
      return
    }

    setBulkEditBusy(true)
    setFormError(null)
    setBulkEditMessage(null)
    try {
      const res = await fetch('/api/players/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerIds: [...selectedIds],
          patch,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk update failed')
      const updated = typeof data.updated === 'number' ? data.updated : selectedIds.size
      setBulkEditMessage(`Updated ${updated} player${updated === 1 ? '' : 's'}`)
      setBulkEditDraft(EMPTY_BULK_EDIT_DRAFT)
      await loadPlayers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Bulk update failed')
    } finally {
      setBulkEditBusy(false)
    }
  }

  async function openEdit(id: string) {
    setFormError(null)
    try {
      const res = await fetch(`/api/players/${id}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load player')
        return
      }
      setEditing(data.player)
      setHistory(null)
      setHistoryPlayerId(null)
    } catch {
      setError('Failed to load player')
    }
  }

  async function openHistory(id: string) {
    setHistoryPlayerId(id)
    try {
      const res = await fetch(`/api/players/${id}/history`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load history')
        return
      }
      setHistory(
        (data.history as Array<Record<string, unknown>>).map((h) => ({
          id: String(h.id),
          source: String(h.source),
          actor: String(h.actor),
          changeType: String(h.changeType),
          before: (h.before as Record<string, unknown> | null) ?? null,
          after: (h.after as Record<string, unknown> | null) ?? null,
          createdAt: String(h.createdAt),
        }))
      )
    } catch {
      setError('Failed to load history')
    }
  }

  async function saveEdit(patch: Record<string, unknown>) {
    if (!editing) return
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/players/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setEditing(data.player)
      await loadPlayers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function getQuickFillDraft(player: PlayerListItem): QuickFillDraft {
    return quickFillDrafts[player.id] ?? quickFillDraftForPlayer(player)
  }

  async function saveQuickFill(player: PlayerListItem, draft: QuickFillDraft) {
    const patch = buildQuickFillPatch(player, draft)
    if (Object.keys(patch).length === 0) return

    setQuickFillSavingId(player.id)
    setError(null)
    try {
      const res = await fetch(`/api/players/${player.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setQuickFillDrafts((prev) => {
        const next = { ...prev }
        delete next[player.id]
        return next
      })
      await loadPlayers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setQuickFillSavingId(null)
    }
  }

  function applyQuickFillDraft(player: PlayerListItem, patch: Partial<QuickFillDraft>) {
    if (quickFillSavingId) return
    const next = { ...getQuickFillDraft(player), ...patch }
    setQuickFillDrafts((prev) => ({
      ...prev,
      [player.id]: next,
    }))
    if (isQuickFillReady(player, next)) {
      void saveQuickFill(player, next)
    }
  }

  async function createPlayer(payload: {
    firstName: string
    lastName: string
    rosterName?: string
    nickname?: string | null
    jerseyNumber?: number | null
    jerseyName?: string | null
    skillLevel?: number | null
    gender?: string | null
    email?: string
  }) {
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      setCreateOpen(false)
      await loadPlayers()
      setEditing(data.player)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  async function runMerge() {
    if (!survivorId || selectedIds.size < 2) return
    setSaving(true)
    setFormError(null)
    try {
      const loserIds = [...selectedIds].filter((id) => id !== survivorId)
      const res = await fetch('/api/players/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survivorId, loserIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Merge failed')
      setMergeOpen(false)
      setSelectedIds(new Set())
      setSurvivorId('')
      await loadPlayers()
      if (data.survivor) setEditing(data.survivor)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setSaving(false)
    }
  }

  async function runUnmerge(playerId: string) {
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/players/unmerge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unmerge failed')
      await loadPlayers()
      if (data.player) setEditing(data.player)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unmerge failed')
      setError(err instanceof Error ? err.message : 'Unmerge failed')
    } finally {
      setSaving(false)
    }
  }

  async function readApiJson(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text()
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 180)
      throw new Error(
        snippet
          ? `Server returned a non-JSON response (${res.status}): ${snippet}`
          : `Server returned an empty non-JSON response (${res.status})`
      )
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
        }),
      })
      const data = await readApiJson(res)
      if (!res.ok) throw new Error(String(data.error || 'Preview failed'))
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
        }),
      })
      const data = await readApiJson(res)
      if (!res.ok) throw new Error(String(data.error || 'Import failed'))
      const summary = data.summary as {
        created: number
        updated: number
        skipped: number
        ambiguous: number
      }
      setImportOpen(false)
      setImportCsv('')
      setImportPreview(null)
      setImportProfileFields('skip')
      await loadPlayers()
      alert(
        `Import done: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.ambiguous} ambiguous`
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 text-gray-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Players</h1>
          <p className="text-sm text-gray-600 mt-1">
            Roster names, jersey numbers, skill levels, gender, home leagues, aliases, and
            emails.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true)
              setFormError(null)
            }}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Add player
          </button>
          <button
            type="button"
            onClick={() => {
              if (!quickFillMode) {
                // Entering quick fill — leave bulk edit
                setBulkEditMode(false)
                setSelectedIds(new Set())
                setBulkEditDraft(EMPTY_BULK_EDIT_DRAFT)
                setBulkEditMessage(null)
                setSkillFilter('')
                setHomeLeagueFilter('')
                setGenderFilter('')
              }
              setQuickFillMode((value) => !value)
            }}
            className={`rounded px-3 py-2 text-sm ${
              quickFillMode
                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                : 'border border-amber-300 bg-white text-amber-900 hover:bg-amber-50'
            }`}
          >
            {quickFillMode ? 'Exit quick fill' : `Quick fill missing info (${missingPlayersCount})`}
          </button>
          <button
            type="button"
            onClick={() => {
              if (bulkEditMode) {
                exitBulkEditMode()
              } else {
                enterBulkEditMode()
              }
            }}
            className={`rounded px-3 py-2 text-sm ${
              bulkEditMode
                ? 'bg-violet-100 text-violet-900 hover:bg-violet-200'
                : 'border border-violet-300 bg-white text-violet-900 hover:bg-violet-50'
            }`}
          >
            {bulkEditMode ? 'Exit bulk edit' : 'Bulk edit'}
          </button>
          <button
            type="button"
            onClick={() => {
              setImportOpen(true)
              setImportPreview(null)
              setImportProfileFields('skip')
              setFormError(null)
            }}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
          >
            Import TeamLinkt CSV
          </button>
          {bulkEditMode ? (
            <button
              type="button"
              disabled={selectedIds.size < 2}
              onClick={() => {
                setMergeOpen(true)
                setSurvivorId([...selectedIds][0] ?? '')
                setFormError(null)
              }}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40"
            >
              Merge selected ({selectedIds.size})
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm text-gray-900">
          <span className="block text-gray-600 mb-1">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, alias, or email"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 w-64"
          />
        </label>
        <label className="text-sm text-gray-900">
          <span className="block text-gray-600 mb-1">Event</span>
          <select
            aria-label="Filter by event"
            value={eventFilter}
            onFocus={() => void loadEvents()}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 max-w-[16rem]"
          >
            <option value="">All events</option>
            {eventsStatus === 'loading' ? (
              <option value="" disabled>
                Loading…
              </option>
            ) : null}
            {eventsStatus === 'error' ? (
              <option value="" disabled>
                Failed to load events
              </option>
            ) : null}
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} ({event.eventDate})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-900">
          <span className="block text-gray-600 mb-1">Home league</span>
          <select
            aria-label="Filter by home league"
            value={homeLeagueFilter}
            onChange={(e) =>
              setHomeLeagueFilter(e.target.value as '' | 'unset' | HomeLeague)
            }
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 max-w-[14rem]"
          >
            <option value="">All</option>
            <option value="unset">None set</option>
            {Object.entries(HOME_LEAGUES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-900 pb-2">
          <input
            type="checkbox"
            checked={includeMerged}
            onChange={(e) => setIncludeMerged(e.target.checked)}
          />
          Show merged
        </label>
        <div className="relative pb-0.5">
          <button
            type="button"
            onClick={() => setColumnsOpen((open) => !open)}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
          >
            Columns
          </button>
          {columnsOpen ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded border border-gray-200 bg-white p-2 shadow-lg">
              {COLUMN_OPTIONS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 rounded px-1 py-1 text-sm text-gray-900 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
              <button
                type="button"
                className="mt-1 w-full rounded px-1 py-1 text-left text-xs text-blue-700 hover:bg-blue-50"
                onClick={() => setVisibleColumns({ ...MINIMAL_VISIBLE_COLUMNS })}
              >
                Minimal view
              </button>
              <button
                type="button"
                className="w-full rounded px-1 py-1 text-left text-xs text-blue-700 hover:bg-blue-50"
                onClick={() => setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMNS })}
              >
                Reset defaults
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void loadPlayers()}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <p className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="inline-block w-3 h-3 rounded-sm bg-rose-50/70 border border-rose-200 align-middle mr-1" />
          W/NB/O
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded-sm bg-sky-50/70 border border-sky-200 align-middle mr-1" />
          Men
        </span>
        <span>
          Skill:{' '}
          <span className="italic">(beginner)</span>
          {' · '}
          intermediate
          {' · '}
          <span className="font-bold">advanced</span>
          {' · '}
          <span className="font-bold underline">worlds</span>
        </span>
      </p>

      {quickFillMode ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Quick fill mode: one player at a time
          {displayedPlayers.length > 0
            ? ` (${displayedPlayers.length} remaining)`
            : ''}. Select missing gender/skill — saves automatically and advances to the
          next player.
        </p>
      ) : null}

      {bulkEditMode ? (
        <div className="rounded border border-violet-200 bg-violet-50 px-3 py-3 space-y-3 text-violet-950">
          <p className="text-sm">
            Bulk edit mode: filter the list (gender, skill, home league, search), select
            players, then apply shared updates. Leave a field blank to leave it unchanged.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              disabled={selectableVisibleIds.length === 0}
              className="rounded border border-violet-300 bg-white px-2.5 py-1.5 text-violet-900 hover:bg-violet-100 disabled:opacity-40"
            >
              {allVisibleSelected ? 'Deselect all visible' : 'Select all visible'}
              {selectableVisibleIds.length > 0
                ? ` (${selectableVisibleIds.length})`
                : ''}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedIds.size === 0}
              className="rounded border border-violet-300 bg-white px-2.5 py-1.5 text-violet-900 hover:bg-violet-100 disabled:opacity-40"
            >
              Clear selection
            </button>
            <span className="text-violet-800">
              {selectedIds.size} selected
            </span>
          </div>

          {selectedIds.size > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 rounded border border-violet-200 bg-white p-3 text-gray-900">
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Gender</span>
                <select
                  aria-label="Bulk set gender"
                  value={bulkEditDraft.gender}
                  onChange={(e) =>
                    setBulkEditDraft((d) => ({ ...d, gender: e.target.value }))
                  }
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">No change</option>
                  {Object.entries(GENDERS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                  <option value="__clear__">Clear</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Skill</span>
                <select
                  aria-label="Bulk set skill"
                  value={bulkEditDraft.skillLevel}
                  onChange={(e) =>
                    setBulkEditDraft((d) => ({ ...d, skillLevel: e.target.value }))
                  }
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">No change</option>
                  {Object.entries(SKILL_LEVELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {value}: {label}
                    </option>
                  ))}
                  <option value="__clear__">Clear</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Strong personality</span>
                <select
                  aria-label="Bulk set strong personality"
                  value={bulkEditDraft.strongPersonality}
                  onChange={(e) =>
                    setBulkEditDraft((d) => ({
                      ...d,
                      strongPersonality: e.target.value as BulkEditDraft['strongPersonality'],
                    }))
                  }
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">No change</option>
                  <option value="on">Turn on</option>
                  <option value="off">Turn off</option>
                </select>
              </label>
              {bulkEditDraft.strongPersonality === 'on' ||
              bulkEditDraft.strongPersonalityNotes ? (
                <label className="text-sm sm:col-span-2 lg:col-span-1">
                  <span className="block text-gray-600 mb-1">Strong personality notes</span>
                  <input
                    aria-label="Bulk strong personality notes"
                    value={bulkEditDraft.strongPersonalityNotes}
                    onChange={(e) =>
                      setBulkEditDraft((d) => ({
                        ...d,
                        strongPersonalityNotes: e.target.value,
                      }))
                    }
                    placeholder={
                      bulkEditDraft.strongPersonality === 'on'
                        ? 'Required when turning on'
                        : 'Optional'
                    }
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
              ) : null}
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Add home league</span>
                <select
                  aria-label="Bulk add home league"
                  value={bulkEditDraft.addHomeLeague}
                  onChange={(e) =>
                    setBulkEditDraft((d) => ({ ...d, addHomeLeague: e.target.value }))
                  }
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">No change</option>
                  {Object.entries(HOME_LEAGUES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Remove home league</span>
                <select
                  aria-label="Bulk remove home league"
                  value={bulkEditDraft.removeHomeLeague}
                  onChange={(e) =>
                    setBulkEditDraft((d) => ({ ...d, removeHomeLeague: e.target.value }))
                  }
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">No change</option>
                  {Object.entries(HOME_LEAGUES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <button
                  type="button"
                  disabled={bulkEditBusy || !buildBulkEditPatch(bulkEditDraft)}
                  onClick={() => void applyBulkEdit()}
                  className="rounded bg-violet-700 px-3 py-2 text-sm text-white hover:bg-violet-800 disabled:opacity-40"
                >
                  {bulkEditBusy
                    ? 'Applying…'
                    : `Apply to ${selectedIds.size} player${selectedIds.size === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          ) : null}

          {bulkEditMessage ? (
            <p className="text-sm text-violet-900" role="status">
              {bulkEditMessage}
            </p>
          ) : null}
          {formError && bulkEditMode ? (
            <p className="text-sm text-red-700" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-600">Loading players…</p> : null}

      {!loading && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            {quickFillMode
              ? `${displayedPlayers.length} player${displayedPlayers.length === 1 ? '' : 's'} remaining`
              : `${displayedPlayers.length} player${displayedPlayers.length === 1 ? '' : 's'}`}
          </p>
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white text-gray-900">
          <table className="min-w-full text-sm text-gray-900">
            <thead className="bg-gray-50 text-left text-gray-700">
              <tr>
                {bulkEditMode ? (
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all visible players"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected
                      }}
                      disabled={selectableVisibleIds.length === 0}
                      onChange={toggleSelectAllVisible}
                    />
                  </th>
                ) : null}
                {showFullNameColumns ? (
                  <SortableHeader
                    label="First"
                    active={sortKey === 'first'}
                    dir={sortDir}
                    onClick={() => toggleSort('first')}
                  />
                ) : null}
                {showFullNameColumns ? (
                  <SortableHeader
                    label="Last"
                    active={sortKey === 'last'}
                    dir={sortDir}
                    onClick={() => toggleSort('last')}
                  />
                ) : null}
                {visibleColumns.roster ? <th className="px-3 py-2">Roster name</th> : null}
                {visibleColumns.nickname ? <th className="px-3 py-2">Nickname</th> : null}
                {visibleColumns.jerseyNumber ? (
                  <SortableHeader
                    label="Jersey #"
                    active={sortKey === 'jersey'}
                    dir={sortDir}
                    onClick={() => toggleSort('jersey')}
                  />
                ) : null}
                {visibleColumns.jerseyName ? (
                  <SortableHeader
                    label="Jersey name"
                    active={sortKey === 'jerseyName'}
                    dir={sortDir}
                    onClick={() => toggleSort('jerseyName')}
                  />
                ) : null}
                {showGenderColumn ? (
                  <th className="px-3 py-2 align-bottom">
                    <div className="space-y-1">
                      <SortableHeaderButton
                        label="Gender"
                        active={sortKey === 'gender'}
                        dir={sortDir}
                        onClick={() => toggleSort('gender')}
                      />
                      <select
                        aria-label="Filter by gender"
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value as '' | GenderGroup)}
                        className="block w-full max-w-[8.5rem] rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900"
                      >
                        <option value="">All</option>
                        <option value="w_nb_o">W/NB/O</option>
                        <option value="men">Men</option>
                        <option value="unset">Unset</option>
                      </select>
                    </div>
                  </th>
                ) : null}
                {showSkillColumn ? (
                  <th className="px-3 py-2 align-bottom">
                    <div className="space-y-1">
                      <SortableHeaderButton
                        label="Skill"
                        active={sortKey === 'skill'}
                        dir={sortDir}
                        onClick={() => toggleSort('skill')}
                      />
                      <select
                        aria-label="Filter by skill"
                        value={skillFilter}
                        onChange={(e) => setSkillFilter(e.target.value)}
                        className="block w-full max-w-[9.5rem] rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900"
                      >
                        <option value="">All</option>
                        <option value="unset">Unset</option>
                        {Object.entries(SKILL_LEVELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {value}: {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                ) : null}
                {visibleColumns.email ? <th className="px-3 py-2">Email</th> : null}
                {showHomeLeaguesColumn ? (
                  <th className="px-3 py-2">Home leagues</th>
                ) : null}
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {quickFillRows.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-gray-100 ${genderRowClass(p.gender, p.isMerged)}`}
                >
                  {bulkEditMode ? (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.rosterName}`}
                        checked={selectedIds.has(p.id)}
                        disabled={p.isMerged}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
                  ) : null}
                  {showFullNameColumns ? (
                    <td className="px-3 py-2">
                      <SkillStyledText skillLevel={p.skillLevel}>{p.firstName}</SkillStyledText>
                      {p.hasStrongPersonality ? (
                        <span
                          title={p.strongPersonalityNotes || 'Strong personality'}
                          className="ml-1 cursor-help text-amber-500"
                          aria-label="Strong personality"
                        >
                          ⚡
                        </span>
                      ) : null}
                    </td>
                  ) : null}
                  {showFullNameColumns ? (
                    <td className="px-3 py-2">
                      <SkillStyledText skillLevel={p.skillLevel}>{p.lastName}</SkillStyledText>
                    </td>
                  ) : null}
                  {visibleColumns.roster ? (
                    <td className="px-3 py-2">
                      <SkillStyledText skillLevel={p.skillLevel}>{p.rosterName}</SkillStyledText>
                    </td>
                  ) : null}
                  {visibleColumns.nickname ? (
                    <td className="px-3 py-2">
                      <SkillStyledText skillLevel={p.skillLevel}>{p.nickname}</SkillStyledText>
                      {!showFullNameColumns && p.hasStrongPersonality ? (
                        <span
                          title={p.strongPersonalityNotes || 'Strong personality'}
                          className="ml-1 cursor-help text-amber-500"
                          aria-label="Strong personality"
                        >
                          ⚡
                        </span>
                      ) : null}
                    </td>
                  ) : null}
                  {visibleColumns.jerseyNumber ? (
                    <td className="px-3 py-2">{p.jerseyNumber ?? '—'}</td>
                  ) : null}
                  {visibleColumns.jerseyName ? (
                    <td className="px-3 py-2">
                      <SkillStyledText skillLevel={p.skillLevel}>{p.jerseyName}</SkillStyledText>
                    </td>
                  ) : null}
                  {showGenderColumn ? (
                    <td className="px-3 py-2">
                      {quickFillMode && !p.isMerged && hasMissingGender(p) ? (
                        <>
                          <span id={`quick-fill-gender-help-${p.id}`} className="sr-only">
                            Gender is missing for {p.rosterName}. Select a gender to save
                            automatically.
                          </span>
                          <select
                            aria-label={`Set gender for ${p.rosterName}`}
                            aria-describedby={`quick-fill-gender-help-${p.id}`}
                            data-quick-fill-focus={
                              getQuickFillDraft(p).gender === '' ? 'true' : undefined
                            }
                            disabled={quickFillSavingId === p.id}
                            className="w-full rounded border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-gray-900"
                            value={getQuickFillDraft(p).gender}
                            onChange={(e) => applyQuickFillDraft(p, { gender: e.target.value })}
                          >
                            <option value="" disabled>
                              Select gender (required)
                            </option>
                            {Object.entries(GENDERS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <span
                          className={
                            genderGroup(p.gender) === 'w_nb_o'
                              ? 'font-medium text-rose-800'
                              : genderGroup(p.gender) === 'men'
                                ? 'font-medium text-sky-900'
                                : 'text-gray-500'
                          }
                        >
                          {genderGroup(p.gender) === 'w_nb_o' ||
                          genderGroup(p.gender) === 'men' ? (
                            <>
                              {p.genderGroupLabel}
                              <span className="ml-1 font-normal text-gray-600">
                                ({p.genderLabel})
                              </span>
                            </>
                          ) : (
                            p.genderLabel
                          )}
                        </span>
                      )}
                    </td>
                  ) : null}
                  {showSkillColumn ? (
                    <td className="px-3 py-2">
                      {quickFillMode && !p.isMerged && hasMissingSkill(p) ? (
                        <>
                          <span id={`quick-fill-skill-help-${p.id}`} className="sr-only">
                            Skill is missing for {p.rosterName}. Select a skill level to save
                            automatically.
                          </span>
                          <select
                            aria-label={`Set skill for ${p.rosterName}`}
                            aria-describedby={`quick-fill-skill-help-${p.id}`}
                            data-quick-fill-focus={
                              (!hasMissingGender(p) || getQuickFillDraft(p).gender !== '') &&
                              getQuickFillDraft(p).skillLevel === ''
                                ? 'true'
                                : undefined
                            }
                            disabled={quickFillSavingId === p.id}
                            className="w-full rounded border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-gray-900"
                            value={getQuickFillDraft(p).skillLevel}
                            onChange={(e) =>
                              applyQuickFillDraft(p, { skillLevel: e.target.value })
                            }
                          >
                            <option value="" disabled>
                              Select skill (required)
                            </option>
                            {Object.entries(SKILL_LEVELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {value}: {label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <SkillStyledText skillLevel={p.skillLevel}>{p.skillLabel}</SkillStyledText>
                      )}
                    </td>
                  ) : null}
                  {visibleColumns.email ? (
                    <td className="px-3 py-2">{p.primaryEmail ?? '—'}</td>
                  ) : null}
                  {showHomeLeaguesColumn ? (
                    <td className="px-3 py-2">
                      {p.homeLeagues.length > 0 ? (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {p.homeLeagues.map((h) => (
                            <HomeLeagueMark
                              key={h.homeLeague}
                              label={h.label}
                              logoUrl={h.logoUrl}
                            />
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    {quickFillMode && quickFillSavingId === p.id ? (
                      <span className="text-amber-800">Saving…</span>
                    ) : null}
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => void openEdit(p.id)}
                    >
                      {p.isMerged ? 'View' : 'Edit'}
                    </button>
                    {p.isMerged ? (
                      <button
                        type="button"
                        className="text-amber-700 hover:underline"
                        disabled={saving}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Unmerge ${p.rosterName}? Emails and aliases that still sit on the survivor will move back.`
                            )
                          ) {
                            void runUnmerge(p.id)
                          }
                        }}
                      >
                        Unmerge
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => void openHistory(p.id)}
                    >
                      History
                    </button>
                  </td>
                </tr>
              ))}
              {displayedPlayers.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumnCount}
                    className="px-3 py-8 text-center text-gray-500"
                  >
                    {quickFillMode
                      ? 'Everyone currently has gender and skill filled in.'
                      : 'No players yet. Import a TeamLinkt CSV or add one manually.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {editing ? (
        <EditPanel
          player={editing}
          saving={saving}
          formError={formError}
          onClose={() => setEditing(null)}
          onSaveCore={(fields) => void saveEdit(fields)}
          onAddEmail={(email) => void saveEdit({ addEmail: email })}
          onRemoveEmail={(id) => void saveEdit({ removeEmailId: id })}
          onSetPrimary={(id) => void saveEdit({ setPrimaryEmailId: id })}
          onAddAlias={(alias) => void saveEdit({ addAlias: alias })}
          onRemoveAlias={(id) => void saveEdit({ removeAliasId: id })}
          onAddHomeLeague={(homeLeague) => void saveEdit({ addHomeLeague: homeLeague })}
          onRemoveHomeLeague={(id) => void saveEdit({ removeHomeLeagueId: id })}
          onReorderHomeLeagues={(ids) => void saveEdit({ reorderHomeLeagueIds: ids })}
          onUnmerge={() => void runUnmerge(editing.id)}
        />
      ) : null}

      {history && historyPlayerId ? (
        <HistoryPanel
          history={history}
          onClose={() => {
            setHistory(null)
            setHistoryPlayerId(null)
          }}
        />
      ) : null}

      {createOpen ? (
        <CreatePanel
          saving={saving}
          formError={formError}
          onClose={() => setCreateOpen(false)}
          onCreate={(payload) => void createPlayer(payload)}
        />
      ) : null}

      {mergeOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 text-gray-900">
            <h2 className="text-lg font-semibold text-gray-900">Merge players</h2>
            <p className="text-sm text-gray-600">
              Choose the survivor. Emails, aliases, and home leagues from the others will
              move onto them; the other records will be marked merged.
            </p>
            <label className="block text-sm">
              <span className="text-gray-600">Survivor</span>
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={survivorId}
                onChange={(e) => setSurvivorId(e.target.value)}
              >
                {selectedPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.rosterName} ({p.primaryEmail ?? 'no email'})
                  </option>
                ))}
              </select>
            </label>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => setMergeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !survivorId}
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40"
                onClick={() => void runMerge()}
              >
                Confirm merge
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 text-gray-900">
            <h2 className="text-lg font-semibold text-gray-900">Import TeamLinkt CSV</h2>
            <p className="text-sm text-gray-600">
              New players always get skill, gender, and jersey from the CSV. For existing
              players, those fields are left alone by default so manual edits are preserved.
              To attach registrations to a tournament or other event, import from the Events
              page instead.
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

function EditPanel(props: {
  player: PlayerSnapshot
  saving: boolean
  formError: string | null
  onClose: () => void
  onSaveCore: (fields: Record<string, unknown>) => void
  onAddEmail: (email: string) => void
  onRemoveEmail: (id: string) => void
  onSetPrimary: (id: string) => void
  onAddAlias: (alias: string) => void
  onRemoveAlias: (id: string) => void
  onAddHomeLeague: (homeLeague: string) => void
  onRemoveHomeLeague: (id: string) => void
  onReorderHomeLeagues: (ids: string[]) => void
  onUnmerge: () => void
}) {
  const p = props.player
  const [firstName, setFirstName] = useState(p.firstName)
  const [lastName, setLastName] = useState(p.lastName)
  const [rosterName, setRosterName] = useState(p.rosterName)
  const [nickname, setNickname] = useState(p.nickname)
  const [jerseyNumber, setJerseyNumber] = useState(
    p.jerseyNumber != null ? String(p.jerseyNumber) : ''
  )
  const [jerseyName, setJerseyName] = useState(p.jerseyName)
  const [skillLevel, setSkillLevel] = useState(
    p.skillLevel != null ? String(p.skillLevel) : ''
  )
  const [gender, setGender] = useState(p.gender ?? '')
  const [hasStrongPersonality, setHasStrongPersonality] = useState(p.hasStrongPersonality)
  const [strongPersonalityNotes, setStrongPersonalityNotes] = useState(p.strongPersonalityNotes ?? '')
  const showStrongPersonalityNotesPrompt = shouldPromptForStrongPersonalityNotes(
    hasStrongPersonality,
    strongPersonalityNotes
  )
  const [newEmail, setNewEmail] = useState('')
  const [newAlias, setNewAlias] = useState('')
  const [newHomeLeague, setNewHomeLeague] = useState('')

  useEffect(() => {
    setFirstName(p.firstName)
    setLastName(p.lastName)
    setRosterName(p.rosterName)
    setNickname(p.nickname)
    setJerseyNumber(p.jerseyNumber != null ? String(p.jerseyNumber) : '')
    setJerseyName(p.jerseyName)
    setSkillLevel(p.skillLevel != null ? String(p.skillLevel) : '')
    setGender(p.gender ?? '')
    setHasStrongPersonality(p.hasStrongPersonality)
    setStrongPersonalityNotes(p.strongPersonalityNotes ?? '')
  }, [p])

  const nicknameDefault = defaultNickname(firstName, lastName)
  const jerseyNameDefault = defaultJerseyName(lastName)
  const availableHomeLeagues = Object.entries(HOME_LEAGUES).filter(
    ([code]) => !p.homeLeagues.some((h) => h.homeLeague === code)
  )

  function moveHomeLeague(id: string, direction: -1 | 1) {
    const ids = p.homeLeagues.map((h) => h.id)
    const index = ids.indexOf(id)
    if (index < 0) return
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= ids.length) return
    const next = [...ids]
    const [moved] = next.splice(index, 1)
    next.splice(nextIndex, 0, moved)
    props.onReorderHomeLeagues(next)
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 text-gray-900">
        <div className="flex justify-between items-start gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Edit player</h2>
          <button type="button" className="text-sm text-gray-500" onClick={props.onClose}>
            Close
          </button>
        </div>

        {p.isMerged ? (
          <div className="space-y-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p>
              This player was merged
              {p.mergedIntoPlayerId ? ' into another record' : ''} and cannot be
              edited until unmerged.
            </p>
            <p className="text-amber-700/90">
              Unmerge reactivates this player and moves emails/aliases/home leagues that
              still belong on the survivor back here. It does not undo jersey/skill/gender
              fills on the survivor.
            </p>
            <button
              type="button"
              disabled={props.saving}
              className="rounded border border-amber-700/40 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100 disabled:opacity-40"
              onClick={() => {
                if (
                  window.confirm(
                    `Unmerge ${p.rosterName}? Emails and aliases that still sit on the survivor will move back.`
                  )
                ) {
                  props.onUnmerge()
                }
              }}
            >
              Unmerge player
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm col-span-1">
            First name
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={firstName}
              disabled={p.isMerged}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Last name
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={lastName}
              disabled={p.isMerged}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
          <label className="text-sm col-span-2">
            Roster name
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={rosterName}
              disabled={p.isMerged}
              onChange={(e) => setRosterName(e.target.value)}
            />
          </label>
          <label className="text-sm col-span-2">
            Nickname
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={nickname}
              disabled={p.isMerged}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={nicknameDefault}
            />
            <span className="mt-1 block text-xs text-gray-500">
              Defaults to first name + last initial ({nicknameDefault}
              {p.nicknameCustom ? '' : ' — currently using default'}
              ). Clear or match the default to keep it automatic.
            </span>
          </label>
          <label className="text-sm">
            Jersey #
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={jerseyNumber}
              disabled={p.isMerged}
              onChange={(e) => setJerseyNumber(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Jersey name
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={jerseyName}
              disabled={p.isMerged}
              onChange={(e) => setJerseyName(e.target.value)}
              placeholder={jerseyNameDefault}
            />
            <span className="mt-1 block text-xs text-gray-500">
              Defaults to last name ({jerseyNameDefault}
              {p.jerseyNameCustom ? '' : ' — currently using default'}
              ).
            </span>
          </label>
          <label className="text-sm">
            Skill
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={skillLevel}
              disabled={p.isMerged}
              onChange={(e) => setSkillLevel(e.target.value)}
            >
              <option value="">Unset</option>
              {Object.entries(SKILL_LEVELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {value}: {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Gender
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={gender}
              disabled={p.isMerged}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Unset</option>
              {Object.entries(GENDERS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2 rounded border border-amber-200 bg-amber-50/50 px-3 py-2">
            <p className="text-sm font-medium text-amber-900">Player flags</p>
            <label className="mt-2 text-sm flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={hasStrongPersonality}
                disabled={p.isMerged}
                onChange={(e) => {
                  setHasStrongPersonality(e.target.checked)
                }}
              />
              <span>Strong personality</span>
            </label>
            {showStrongPersonalityNotesPrompt ? (
              <p className="mt-2 text-xs text-amber-900" role="alert" aria-live="polite">
                Add a note describing the player&apos;s strong personality and communication
                considerations.
              </p>
            ) : null}
          </div>
          {hasStrongPersonality ? (
            <label className="text-sm col-span-2">
              Strong personality notes
              <textarea
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                rows={3}
                value={strongPersonalityNotes}
                disabled={p.isMerged}
                onChange={(e) => setStrongPersonalityNotes(e.target.value)}
                placeholder="Notes about this player's personality (shown on hover in team builder)"
              />
            </label>
          ) : null}
        </div>

        {!p.isMerged ? (
          <button
            type="button"
            disabled={props.saving}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40"
            onClick={() =>
              props.onSaveCore({
                firstName,
                lastName,
                rosterName,
                nickname,
                jerseyNumber: parseJerseyNumber(jerseyNumber),
                jerseyName,
                skillLevel: skillLevel ? Number(skillLevel) : null,
                gender: gender || null,
                hasStrongPersonality,
                strongPersonalityNotes: strongPersonalityNotes.trim() || null,
              })
            }
          >
            Save details
          </button>
        ) : null}

        <div className="border-t pt-4 space-y-2">
          <h3 className="font-medium text-sm">Emails</h3>
          <ul className="space-y-1 text-sm">
            {p.emails.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span>
                  {e.email}
                  {e.isPrimary ? (
                    <span className="ml-2 text-xs text-gray-500">(primary)</span>
                  ) : null}
                </span>
                {!p.isMerged ? (
                  <span className="space-x-2">
                    {!e.isPrimary ? (
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => props.onSetPrimary(e.id)}
                      >
                        Make primary
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => props.onRemoveEmail(e.id)}
                    >
                      Remove
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {!p.isMerged ? (
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Add email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  if (!newEmail.trim()) return
                  props.onAddEmail(newEmail.trim())
                  setNewEmail('')
                }}
              >
                Add
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-t pt-4 space-y-2">
          <h3 className="font-medium text-sm">Alternate names</h3>
          <ul className="space-y-1 text-sm">
            {p.aliases.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>{a.alias}</span>
                {!p.isMerged ? (
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => props.onRemoveAlias(a.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
            {p.aliases.length === 0 ? (
              <li className="text-gray-500">No aliases yet</li>
            ) : null}
          </ul>
          {!p.isMerged ? (
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Add alias (e.g. Jess)"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
              />
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  if (!newAlias.trim()) return
                  props.onAddAlias(newAlias.trim())
                  setNewAlias('')
                }}
              >
                Add
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-t pt-4 space-y-2">
          <h3 className="font-medium text-sm">Home leagues</h3>
          <p className="text-xs text-gray-500">
            Ordered preference — first is primary home league.
          </p>
          <ul className="space-y-1 text-sm">
            {p.homeLeagues.map((h, index) => (
              <li key={h.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 shrink-0">{index + 1}.</span>
                  <HomeLeagueMark label={h.label} logoUrl={h.logoUrl} size="md" />
                </span>
                {!p.isMerged ? (
                  <span className="space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-blue-600 hover:underline disabled:opacity-40"
                      disabled={index === 0}
                      onClick={() => moveHomeLeague(h.id, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline disabled:opacity-40"
                      disabled={index === p.homeLeagues.length - 1}
                      onClick={() => moveHomeLeague(h.id, 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => props.onRemoveHomeLeague(h.id)}
                    >
                      Remove
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
            {p.homeLeagues.length === 0 ? (
              <li className="text-gray-500">No home leagues yet</li>
            ) : null}
          </ul>
          {!p.isMerged && availableHomeLeagues.length > 0 ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded border px-3 py-2 text-sm"
                  value={newHomeLeague}
                  onChange={(e) => setNewHomeLeague(e.target.value)}
                >
                  <option value="">Select home league</option>
                  {availableHomeLeagues.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded border px-3 py-2 text-sm"
                  onClick={() => {
                    if (!newHomeLeague) return
                    props.onAddHomeLeague(newHomeLeague)
                    setNewHomeLeague('')
                  }}
                >
                  Add
                </button>
              </div>
              {newHomeLeague && isValidHomeLeague(newHomeLeague) ? (
                <HomeLeagueMark
                  label={HOME_LEAGUES[newHomeLeague]}
                  logoUrl={HOME_LEAGUE_LOGOS[newHomeLeague]}
                  size="md"
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="text-xs text-gray-500">
          Current skill label: {skillLevelLabel(p.skillLevel)}
        </p>
        {props.formError ? <p className="text-sm text-red-600">{props.formError}</p> : null}
      </div>
    </div>
  )
}

function CreatePanel(props: {
  saving: boolean
  formError: string | null
  onClose: () => void
  onCreate: (payload: {
    firstName: string
    lastName: string
    rosterName?: string
    nickname?: string | null
    jerseyNumber?: number | null
    jerseyName?: string | null
    skillLevel?: number | null
    gender?: string | null
    email?: string
  }) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [rosterName, setRosterName] = useState('')
  const [nickname, setNickname] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [jerseyName, setJerseyName] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [gender, setGender] = useState('')
  const [email, setEmail] = useState('')
  const nicknameDefault = defaultNickname(firstName, lastName)
  const jerseyNameDefault = defaultJerseyName(lastName)

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 text-gray-900">
        <h2 className="text-lg font-semibold text-gray-900">Add player</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            First name
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Last name
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
          <label className="text-sm col-span-2">
            Roster name (optional)
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={rosterName}
              onChange={(e) => setRosterName(e.target.value)}
            />
          </label>
          <label className="text-sm col-span-2">
            Nickname (optional)
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={nicknameDefault || 'First L'}
            />
            <span className="mt-1 block text-xs text-gray-500">
              Leave blank to use {nicknameDefault || 'first name + last initial'}.
            </span>
          </label>
          <label className="text-sm">
            Jersey #
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Jersey name (optional)
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={jerseyName}
              onChange={(e) => setJerseyName(e.target.value)}
              placeholder={jerseyNameDefault || 'Last name'}
            />
            <span className="mt-1 block text-xs text-gray-500">
              Leave blank to use {jerseyNameDefault || 'last name'}.
            </span>
          </label>
          <label className="text-sm">
            Skill
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value)}
            >
              <option value="">Unset</option>
              {Object.entries(SKILL_LEVELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {value}: {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Gender
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Unset</option>
              {Object.entries(GENDERS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm col-span-2">
            Email
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>
        {props.formError ? <p className="text-sm text-red-600">{props.formError}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={props.onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={props.saving || !firstName.trim() || !lastName.trim()}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40"
            onClick={() =>
              props.onCreate({
                firstName,
                lastName,
                rosterName: rosterName.trim() || undefined,
                nickname: nickname.trim() || null,
                jerseyNumber: parseJerseyNumber(jerseyNumber),
                jerseyName: jerseyName.trim() || null,
                skillLevel: skillLevel ? Number(skillLevel) : null,
                gender: gender || null,
                email: email.trim() || undefined,
              })
            }
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryPanel(props: { history: HistoryRow[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 text-gray-900">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Change history</h2>
          <button type="button" className="text-sm text-gray-500" onClick={props.onClose}>
            Close
          </button>
        </div>
        {props.history.length === 0 ? (
          <p className="text-sm text-gray-500">No changes recorded.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {props.history.map((h) => (
              <li key={h.id} className="border rounded p-3">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-700">
                  <span className="font-medium">{h.changeType}</span>
                  <span>{h.source}</span>
                  <span>{h.actor}</span>
                  <span className="text-gray-500">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </div>
                <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(
                    { before: h.before, after: h.after },
                    null,
                    2
                  )}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
