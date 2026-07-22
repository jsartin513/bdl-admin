'use client'

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  summarizeDraftAssignments,
  teamGenderCounts,
  teamSkillTotal,
} from '@/app/lib/events/draft-seed'
import type {
  EventDraftSnapshotListItem,
  EventRegistrationListItem,
} from '@/app/lib/events/types'
import { genderGroup, genderGroupSortKey } from '@/app/lib/players/gender'
import { skillLevelLabel } from '@/app/lib/players/skill'

type DraftAssignment = Map<string, number | null>

type PlayerSort = 'name' | 'gender' | 'skill'

const COPY_FEEDBACK_DURATION_MS = 2000

type Props = {
  registrations: EventRegistrationListItem[]
  teamCount: number
  assignments: DraftAssignment
  onAssignmentsChange: (next: DraftAssignment) => void
  onReshuffle: () => void
  onApply: () => void
  onDiscard: () => void
  applying: boolean
  error: string | null
  snapshots: EventDraftSnapshotListItem[]
  snapshotsBusy: boolean
  onSaveSnapshot: (name: string) => Promise<void>
  onLoadSnapshot: (snapshotId: string) => void
  onRenameSnapshot: (snapshotId: string, name: string) => Promise<void>
  onDeleteSnapshot: (snapshotId: string) => Promise<void>
  onPromoteSnapshot: (snapshotId: string) => Promise<void>
}

function columnId(team: number | null): string {
  return team == null ? 'unassigned' : `team-${team}`
}

function parseColumnId(id: string): number | null {
  if (id === 'unassigned') return null
  const m = /^team-(\d+)$/.exec(id)
  if (!m) return null
  return Number.parseInt(m[1], 10)
}

function displayName(player: EventRegistrationListItem): string {
  return player.nickname || `${player.firstName} ${player.lastName}`
}

function sortPlayers(
  players: EventRegistrationListItem[],
  sort: PlayerSort
): EventRegistrationListItem[] {
  return [...players].sort((a, b) => {
    if (sort === 'gender') {
      const g = genderGroupSortKey(a.gender) - genderGroupSortKey(b.gender)
      if (g !== 0) return g
    } else if (sort === 'skill') {
      const sa = a.skillLevel ?? -1
      const sb = b.skillLevel ?? -1
      if (sb !== sa) return sb - sa
    }
    return displayName(a).localeCompare(displayName(b), undefined, {
      sensitivity: 'base',
    })
  })
}

function playerCardClass(gender: string | null): string {
  const g = genderGroup(gender)
  if (g === 'w_nb_o') return 'border-rose-200 bg-rose-50/80'
  if (g === 'men') return 'border-sky-200 bg-sky-50/80'
  return 'border-gray-200 bg-white'
}

function DraftPlayerCard(props: {
  player: EventRegistrationListItem
  dragging?: boolean
}) {
  const { player, dragging } = props
  return (
    <div
      className={`rounded border px-2 py-1.5 text-xs shadow-sm ${playerCardClass(player.gender)} ${
        dragging ? 'opacity-90 shadow-md ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="font-medium text-gray-900">
        {player.nickname || `${player.firstName} ${player.lastName}`}
        {player.hasStrongPersonality ? (
          <span
            title={player.strongPersonalityNotes || 'Strong personality'}
            className="ml-1 cursor-help text-amber-500"
            aria-label="Strong personality"
          >
            ⚡
          </span>
        ) : null}
        {player.pairId ? (
          <span
            className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700"
            title={
              player.partnerNickname
                ? `Paired with ${player.partnerNickname}`
                : 'Paired'
            }
          >
            Pair
            {player.partnerNickname ? ` · ${player.partnerNickname}` : ''}
          </span>
        ) : null}
      </div>
      <div className="text-gray-600">
        {player.skillLevel != null ? skillLevelLabel(player.skillLevel) : '—'} ·{' '}
        {player.genderGroupLabel}
        {player.skillLevel != null ? ` · ${player.skillLevel}` : ''}
      </div>
    </div>
  )
}

function DraggablePlayer(props: { player: EventRegistrationListItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: props.player.id })
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
      {...listeners}
      {...attributes}
    >
      <DraftPlayerCard player={props.player} />
    </div>
  )
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function TeamColumn(props: {
  team: number | null
  label: string
  players: EventRegistrationListItem[]
  sort: PlayerSort
  showAverage?: boolean
  scoreImbalanced?: boolean
  genderImbalanced?: boolean
  emphasizeUnassigned?: boolean
  onCopy?: () => Promise<void>
}) {
  const id = columnId(props.team)
  const { setNodeRef, isOver } = useDroppable({ id })
  const score = teamSkillTotal(props.players)
  const gender = teamGenderCounts(props.players)
  const count = props.players.length
  const average = count > 0 ? score / count : 0
  const sortedPlayers = useMemo(
    () => sortPlayers(props.players, props.sort),
    [props.players, props.sort]
  )
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emphasizeUnassigned = Boolean(props.emphasizeUnassigned && count > 0)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  function scheduleReset() {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => {
      setCopied(false)
      setCopyError(false)
      setIsCopying(false)
    }, COPY_FEEDBACK_DURATION_MS)
  }

  function handleCopy() {
    if (!props.onCopy || isCopying) return
    setIsCopying(true)
    props.onCopy().then(() => {
      setCopied(true)
      setCopyError(false)
      scheduleReset()
    }).catch(() => {
      setCopyError(true)
      setCopied(false)
      scheduleReset()
    })
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[220px] w-56 shrink-0 flex-col rounded-lg border ${
        isOver
          ? 'border-blue-400 bg-blue-50/40'
          : emphasizeUnassigned
            ? 'border-amber-300 bg-amber-50/50'
            : 'border-gray-200 bg-gray-50/50'
      }`}
    >
      <div
        className={`border-b px-2 py-2 ${
          emphasizeUnassigned ? 'border-amber-200' : 'border-gray-200'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm font-semibold ${
              emphasizeUnassigned ? 'text-amber-900' : 'text-gray-900'
            }`}
          >
            {props.label}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs ${
                emphasizeUnassigned
                  ? 'font-semibold text-amber-800'
                  : 'text-gray-500'
              }`}
            >
              {count}
            </span>
            {props.onCopy && props.team != null ? (
              <button
                type="button"
                title="Copy roster names"
                onClick={handleCopy}
                disabled={isCopying}
                className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {copied ? (
                  <span className="text-xs font-medium text-green-600">Copied!</span>
                ) : copyError ? (
                  <span className="text-xs font-medium text-red-600">Failed</span>
                ) : (
                  <CopyIcon />
                )}
              </button>
            ) : null}
          </div>
        </div>
        {props.team != null ? (
          <div className="mt-1 space-y-0.5 text-xs text-gray-600">
            <div className={props.scoreImbalanced ? 'font-semibold text-amber-700' : ''}>
              Score {score}
              {props.showAverage && count > 0
                ? ` · avg ${average.toFixed(1)}`
                : ''}
            </div>
            <div className={props.genderImbalanced ? 'font-semibold text-amber-700' : ''}>
              W/NB/O {gender.wNbO} · M {gender.men}
              {gender.unset ? ` · — ${gender.unset}` : ''}
            </div>
          </div>
        ) : (
          <div
            className={`mt-1 text-xs ${
              emphasizeUnassigned ? 'font-medium text-amber-800' : 'text-gray-500'
            }`}
          >
            {emphasizeUnassigned
              ? `${count} not on a team — drag onto a team`
              : 'Drag onto a team'}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {sortedPlayers.map((p) => (
          <DraggablePlayer key={p.id} player={p} />
        ))}
      </div>
    </div>
  )
}

export function EventDraftBoard(props: Props) {
  const {
    registrations,
    teamCount,
    assignments,
    onAssignmentsChange,
    onReshuffle,
    onApply,
    onDiscard,
    applying,
    error,
    snapshots,
    snapshotsBusy,
    onSaveSnapshot,
    onLoadSnapshot,
    onRenameSnapshot,
    onDeleteSnapshot,
    onPromoteSnapshot,
  } = props

  const [activeId, setActiveId] = useState<string | null>(null)
  const [playerSort, setPlayerSort] = useState<PlayerSort>('name')
  const [copyIncludeJersey, setCopyIncludeJersey] = useState(false)
  const [copyUseRosterName, setCopyUseRosterName] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [compareA, setCompareA] = useState<'workspace' | string>('workspace')
  const [compareB, setCompareB] = useState<string>('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const byColumn = useMemo(() => {
    const map = new Map<string, EventRegistrationListItem[]>()
    map.set(columnId(null), [])
    for (let t = 1; t <= teamCount; t++) {
      map.set(columnId(t), [])
    }
    for (const r of registrations) {
      const team = assignments.get(r.id) ?? null
      const key = columnId(team != null && team >= 1 && team <= teamCount ? team : null)
      const list = map.get(key) ?? []
      list.push(r)
      map.set(key, list)
    }
    return map
  }, [registrations, assignments, teamCount])

  const teamStats = useMemo(() => {
    const scores: number[] = []
    const averages: number[] = []
    const sizes: number[] = []
    const genderDeltas: number[] = []
    for (let t = 1; t <= teamCount; t++) {
      const players = byColumn.get(columnId(t)) ?? []
      const total = teamSkillTotal(players)
      const size = players.length
      scores.push(total)
      sizes.push(size)
      averages.push(size > 0 ? total / size : 0)
      const g = teamGenderCounts(players)
      genderDeltas.push(Math.abs(g.wNbO - g.men))
    }
    const sizedTeams = sizes.filter((n) => n > 0)
    const sizesUneven =
      sizedTeams.length > 1 && Math.max(...sizedTeams) !== Math.min(...sizedTeams)
    const nonemptyIndexes = sizes
      .map((n, i) => (n > 0 ? i : -1))
      .filter((i) => i >= 0)
    const avgScore =
      nonemptyIndexes.length > 0
        ? nonemptyIndexes.reduce((sum, i) => sum + scores[i], 0) /
          nonemptyIndexes.length
        : 0
    const avgOfAverages =
      nonemptyIndexes.length > 0
        ? nonemptyIndexes.reduce((sum, i) => sum + averages[i], 0) /
          nonemptyIndexes.length
        : 0
    const avgGenderDelta =
      genderDeltas.length > 0
        ? genderDeltas.reduce((a, b) => a + b, 0) / genderDeltas.length
        : 0
    return {
      scores,
      averages,
      sizesUneven,
      avgScore,
      avgOfAverages,
      genderDeltas,
      avgGenderDelta,
    }
  }, [byColumn, teamCount])

  const activePlayer = activeId
    ? registrations.find((r) => r.id === activeId) ?? null
    : null

  const unassignedPlayers = byColumn.get(columnId(null)) ?? []
  const unassignedCount = unassignedPlayers.length

  const compareSummary = useMemo(() => {
    if (!compareB) return null
    const resolve = (key: 'workspace' | string) => {
      if (key === 'workspace') return assignments
      const snap = snapshots.find((s) => s.id === key)
      return snap?.assignments ?? {}
    }
    return {
      a: summarizeDraftAssignments(registrations, resolve(compareA), teamCount),
      b: summarizeDraftAssignments(registrations, resolve(compareB), teamCount),
      aLabel:
        compareA === 'workspace'
          ? 'Current workspace'
          : (snapshots.find((s) => s.id === compareA)?.name ?? 'A'),
      bLabel: snapshots.find((s) => s.id === compareB)?.name ?? 'B',
    }
  }, [assignments, compareA, compareB, registrations, snapshots, teamCount])

  async function copyTeam(teamPlayers: EventRegistrationListItem[]): Promise<void> {
    const sorted = sortPlayers(teamPlayers, playerSort)
    const lines = sorted.map((p) => {
      const name = copyUseRosterName ? (p.rosterName || displayName(p)) : displayName(p)
      if (copyIncludeJersey && p.jerseyNumber != null) {
        return `#${p.jerseyNumber} ${name}`
      }
      return name
    })
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      throw new Error('Could not copy to clipboard. Check browser permissions.')
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const playerId = String(active.id)
    let targetTeam: number | null = null

    const overId = String(over.id)
    if (overId === 'unassigned' || overId.startsWith('team-')) {
      targetTeam = parseColumnId(overId)
    } else {
      // Dropped on another player — use that player's column
      targetTeam = assignments.get(overId) ?? null
    }

    const current = assignments.get(playerId) ?? null
    if (current === targetTeam) return

    const next = new Map(assignments)
    next.set(playerId, targetTeam)
    const dragged = registrations.find((r) => r.id === playerId)
    if (dragged?.partnerRegistrationId) {
      next.set(dragged.partnerRegistrationId, targetTeam)
    }
    onAssignmentsChange(next)
  }

  async function handleSaveSnapshot() {
    const name = snapshotName.trim()
    if (!name) return
    await onSaveSnapshot(name)
    setSnapshotName('')
  }

  return (
    <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Draft mode</h2>
          <p className="text-sm text-gray-600">
            Working copy only — permanent draft groups are unchanged until you Apply.
            Paired players move together.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unassignedCount > 0 ? (
            <span className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-sm font-semibold text-amber-900">
              Unassigned {unassignedCount}
            </span>
          ) : (
            <span className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-600">
              Unassigned 0
            </span>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span className="text-gray-600">Sort within teams</span>
            <select
              className="rounded border border-gray-300 bg-white px-2 py-1.5"
              value={playerSort}
              onChange={(e) => setPlayerSort(e.target.value as PlayerSort)}
            >
              <option value="name">Name</option>
              <option value="gender">Gender</option>
              <option value="skill">Skill (high → low)</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            disabled={applying}
            onClick={onReshuffle}
          >
            Reshuffle
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            disabled={applying}
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40"
            disabled={applying}
            onClick={onApply}
          >
            {applying ? 'Applying…' : 'Apply to event'}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3 rounded border border-violet-200 bg-white px-3 py-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="text-gray-600">Save draft as</span>
            <input
              className="mt-1 block w-52 rounded border border-gray-300 px-2 py-1.5"
              value={snapshotName}
              disabled={snapshotsBusy || applying}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="e.g. Balanced A"
            />
          </label>
          <button
            type="button"
            className="rounded border border-violet-300 bg-violet-50 px-3 py-2 text-sm text-violet-900 disabled:opacity-40"
            disabled={snapshotsBusy || applying || !snapshotName.trim()}
            onClick={() => void handleSaveSnapshot()}
          >
            Save snapshot
          </button>
        </div>

        {snapshots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-1 pr-3 font-medium">Saved drafts</th>
                  <th className="py-1 pr-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs text-blue-700 hover:underline disabled:opacity-40"
                          disabled={snapshotsBusy || applying}
                          onClick={() => onLoadSnapshot(s.id)}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="text-xs text-gray-700 hover:underline disabled:opacity-40"
                          disabled={snapshotsBusy || applying}
                          onClick={() => {
                            const next = window.prompt('Rename snapshot', s.name)
                            if (next == null) return
                            void onRenameSnapshot(s.id, next)
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-xs text-violet-700 hover:underline disabled:opacity-40"
                          disabled={snapshotsBusy || applying}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Promote “${s.name}” to the live event roster?`
                              )
                            ) {
                              return
                            }
                            void onPromoteSnapshot(s.id)
                          }}
                        >
                          Promote
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-700 hover:underline disabled:opacity-40"
                          disabled={snapshotsBusy || applying}
                          onClick={() => {
                            if (!window.confirm(`Delete snapshot “${s.name}”?`)) {
                              return
                            }
                            void onDeleteSnapshot(s.id)
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-500">No saved drafts yet.</p>
        )}

        {snapshots.length > 0 ? (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-sm font-medium text-gray-800">Compare</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-gray-600">A</span>
                <select
                  className="rounded border border-gray-300 px-2 py-1"
                  value={compareA}
                  onChange={(e) => setCompareA(e.target.value)}
                >
                  <option value="workspace">Current workspace</option>
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-gray-600">B</span>
                <select
                  className="rounded border border-gray-300 px-2 py-1"
                  value={compareB}
                  onChange={(e) => setCompareB(e.target.value)}
                >
                  <option value="">Select snapshot…</option>
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {compareSummary ? (
              <div className="grid gap-3 md:grid-cols-2 text-xs">
                {[
                  {
                    label: compareSummary.aLabel,
                    summary: compareSummary.a,
                  },
                  {
                    label: compareSummary.bLabel,
                    summary: compareSummary.b,
                  },
                ].map((side) => (
                  <div
                    key={side.label}
                    className="rounded border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <div className="font-semibold text-gray-900">{side.label}</div>
                    <div className="mt-1 text-amber-800">
                      Unassigned {side.summary.unassigned}
                    </div>
                    <ul className="mt-2 space-y-1 text-gray-700">
                      {side.summary.teams.map((t) => (
                        <li key={t.team}>
                          Team {t.team}: {t.size} · score {t.skillTotal}
                          {t.size > 0 ? ` (avg ${t.skillAvg.toFixed(1)})` : ''} ·
                          W/NB/O {t.gender.wNbO} · M {t.gender.men}
                          {t.gender.unset ? ` · — ${t.gender.unset}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700 border border-gray-200 rounded bg-white px-3 py-2">
        <span className="font-medium text-gray-600">Copy roster options</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={copyIncludeJersey}
            onChange={(e) => setCopyIncludeJersey(e.target.checked)}
          />
          Include jersey #
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={copyUseRosterName}
            onChange={(e) => setCopyUseRosterName(e.target.checked)}
          />
          Use roster name
        </label>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          <TeamColumn
            team={null}
            label="Unassigned"
            players={unassignedPlayers}
            sort={playerSort}
            emphasizeUnassigned
          />
          {Array.from({ length: teamCount }, (_, i) => i + 1).map((t) => {
            const teamPlayers = byColumn.get(columnId(t)) ?? []
            const scoreMetric = teamStats.sizesUneven
              ? teamStats.averages[t - 1]
              : teamStats.scores[t - 1]
            const scoreBaseline = teamStats.sizesUneven
              ? teamStats.avgOfAverages
              : teamStats.avgScore
            const scoreThreshold = teamStats.sizesUneven ? 0.3 : 2
            return (
              <TeamColumn
                key={t}
                team={t}
                label={`Team ${t}`}
                players={teamPlayers}
                sort={playerSort}
                showAverage={teamStats.sizesUneven}
                scoreImbalanced={
                  teamPlayers.length > 0 &&
                  Math.abs(scoreMetric - scoreBaseline) > scoreThreshold
                }
                genderImbalanced={
                  teamPlayers.length > 0 &&
                  teamStats.genderDeltas[t - 1] >
                    Math.max(1, teamStats.avgGenderDelta + 1)
                }
                onCopy={() => copyTeam(teamPlayers)}
              />
            )
          })}
        </div>
        <DragOverlay>
          {activePlayer ? <DraftPlayerCard player={activePlayer} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
