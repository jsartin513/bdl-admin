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
import { useMemo, useState } from 'react'
import {
  teamGenderCounts,
  teamSkillTotal,
} from '@/app/lib/events/draft-seed'
import type { EventRegistrationListItem } from '@/app/lib/events/types'
import { genderGroup, genderGroupSortKey } from '@/app/lib/players/gender'
import { skillLevelLabel } from '@/app/lib/players/skill'

type DraftAssignment = Map<string, number | null>

type PlayerSort = 'name' | 'gender' | 'skill'

type Props = {
  registrations: EventRegistrationListItem[]
  teamCount: number
  assignments: DraftAssignment
  onAssignmentsChange: (next: DraftAssignment) => void
  onApply: () => void
  onDiscard: () => void
  applying: boolean
  error: string | null
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

function TeamColumn(props: {
  team: number | null
  label: string
  players: EventRegistrationListItem[]
  sort: PlayerSort
  showAverage?: boolean
  scoreImbalanced?: boolean
  genderImbalanced?: boolean
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

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[220px] w-56 shrink-0 flex-col rounded-lg border ${
        isOver ? 'border-blue-400 bg-blue-50/40' : 'border-gray-200 bg-gray-50/50'
      }`}
    >
      <div className="border-b border-gray-200 px-2 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900">{props.label}</span>
          <span className="text-xs text-gray-500">{count}</span>
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
          <div className="mt-1 text-xs text-gray-500">Drag onto a team</div>
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
    onApply,
    onDiscard,
    applying,
    error,
  } = props

  const [activeId, setActiveId] = useState<string | null>(null)
  const [playerSort, setPlayerSort] = useState<PlayerSort>('name')

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
    onAssignmentsChange(next)
  }

  return (
    <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Draft mode</h2>
          <p className="text-sm text-gray-600">
            Working copy only — permanent draft groups are unchanged until you Apply.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            players={byColumn.get(columnId(null)) ?? []}
            sort={playerSort}
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
