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
import type { PlayerListItem, PlayerSnapshot } from '@/app/lib/players/types'

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

function parseJerseyNumber(value: string): number | null {
  if (!value.trim()) return null
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

export function shouldPromptForStrongPersonalityNotes(
  nextChecked: boolean,
  notes: string
): boolean {
  return nextChecked && !notes.trim()
}

/** Skill cues: beginner italic+parens, intermediate normal, advanced bold, worlds bold+underline. */
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
  | 'roster'
  | 'nickname'
  | 'jerseyNumber'
  | 'jerseyName'
  | 'gender'
  | 'skill'
  | 'email'

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: 'roster', label: 'Roster name' },
  { key: 'nickname', label: 'Nickname' },
  { key: 'jerseyNumber', label: 'Jersey #' },
  { key: 'jerseyName', label: 'Jersey name' },
  { key: 'gender', label: 'Gender' },
  { key: 'skill', label: 'Skill' },
  { key: 'email', label: 'Email' },
]

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  roster: true,
  nickname: true,
  jerseyNumber: false,
  jerseyName: false,
  gender: true,
  skill: true,
  email: true,
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
  const [genderFilter, setGenderFilter] = useState<'' | GenderGroup>('')
  const [sortKey, setSortKey] = useState<SortKey>('last')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [includeMerged, setIncludeMerged] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    DEFAULT_VISIBLE_COLUMNS
  )
  const [columnsOpen, setColumnsOpen] = useState(false)

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

  const visibleColumnCount =
    2 + // first + last always shown
    COLUMN_OPTIONS.filter((c) => visibleColumns[c.key]).length +
    2 // checkbox + actions

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
  }, [q, skillFilter, includeMerged])

  useEffect(() => {
    void loadPlayers()
  }, [loadPlayers])

  const displayedPlayers = useMemo(() => {
    const filtered = genderFilter
      ? players.filter((p) => genderGroup(p.gender) === genderFilter)
      : players
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      const cmp = comparePlayers(a, b, sortKey)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [players, genderFilter, sortKey, sortDir])

  const selectedPlayers = useMemo(
    () => displayedPlayers.filter((p) => selectedIds.has(p.id)),
    [displayedPlayers, selectedIds]
  )

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
            Roster names, jersey numbers, skill levels, gender, aliases, and emails.
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
              setImportOpen(true)
              setImportPreview(null)
              setImportProfileFields('skip')
              setFormError(null)
            }}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
          >
            Import TeamLinkt CSV
          </button>
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
              <p className="px-1 pb-1 text-xs text-gray-500">First/last always shown</p>
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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-600">Loading players…</p> : null}

      {!loading && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            {displayedPlayers.length} player{displayedPlayers.length === 1 ? '' : 's'}
          </p>
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white text-gray-900">
          <table className="min-w-full text-sm text-gray-900">
            <thead className="bg-gray-50 text-left text-gray-700">
              <tr>
                <th className="px-3 py-2 w-10" />
                <SortableHeader
                  label="First"
                  active={sortKey === 'first'}
                  dir={sortDir}
                  onClick={() => toggleSort('first')}
                />
                <SortableHeader
                  label="Last"
                  active={sortKey === 'last'}
                  dir={sortDir}
                  onClick={() => toggleSort('last')}
                />
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
                {visibleColumns.gender ? (
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
                {visibleColumns.skill ? (
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
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {displayedPlayers.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-gray-100 ${genderRowClass(p.gender, p.isMerged)}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      disabled={p.isMerged}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </td>
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
                  <td className="px-3 py-2">
                    <SkillStyledText skillLevel={p.skillLevel}>{p.lastName}</SkillStyledText>
                  </td>
                  {visibleColumns.roster ? (
                    <td className="px-3 py-2">
                      <SkillStyledText skillLevel={p.skillLevel}>{p.rosterName}</SkillStyledText>
                    </td>
                  ) : null}
                  {visibleColumns.nickname ? (
                    <td className="px-3 py-2">
                      <SkillStyledText skillLevel={p.skillLevel}>{p.nickname}</SkillStyledText>
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
                  {visibleColumns.gender ? (
                    <td className="px-3 py-2">
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
                    </td>
                  ) : null}
                  {visibleColumns.skill ? (
                    <td className="px-3 py-2">
                      <SkillStyledText skillLevel={p.skillLevel}>{p.skillLabel}</SkillStyledText>
                    </td>
                  ) : null}
                  {visibleColumns.email ? (
                    <td className="px-3 py-2">{p.primaryEmail ?? '—'}</td>
                  ) : null}
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
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
                    No players yet. Import a TeamLinkt CSV or add one manually.
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
              Choose the survivor. Emails and aliases from the others will move onto them;
              the other records will be marked merged.
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
              Unmerge reactivates this player and moves emails/aliases that still
              belong on the survivor back here. It does not undo jersey/skill/gender
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
