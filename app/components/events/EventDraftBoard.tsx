'use client'

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useId, useMemo, useState } from 'react'
import {
  summarizeDraftAssignments,
  teamGenderCounts,
  teamSkillTotal,
} from '@/app/lib/events/draft-seed'
import { resolveTeamName } from '@/app/lib/events/dodgeballhub-export'
import type {
  EventDraftSnapshotListItem,
  EventRegistrationListItem,
} from '@/app/lib/events/types'
import { effectiveSkillScore, type SkillViewMode } from '@/app/lib/players/skill'
import {
  Button,
  FieldHelp,
  FOCUS_RING,
  LiveMessage,
} from '@/app/components/ui'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { DraftPlayerCard } from './DraftPlayerCard'
import { DraftSnapshotsPanel } from './DraftSnapshotsPanel'
import { DraftTeamColumn } from './DraftTeamColumn'
import {
  INPUT_CLASS,
  captainBadgeForAssignment,
  columnId,
  displayName,
  homeLeagueText,
  parseColumnId,
  sortPlayers,
  withEffectiveSkill,
  type DraftAssignment,
  type PlayerSort,
} from './draft-board-utils'

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
  pairingEnabled?: boolean
  skillViewMode?: SkillViewMode
  teamNames?: string[]
  teamsLocked?: boolean
  byotMode?: boolean
  snapshots: EventDraftSnapshotListItem[]
  snapshotsBusy: boolean
  onSaveSnapshot: (name: string) => Promise<void>
  onLoadSnapshot: (snapshotId: string) => void
  onRenameSnapshot: (snapshotId: string, name: string) => Promise<void>
  onDeleteSnapshot: (snapshotId: string) => Promise<void>
  onPromoteSnapshot: (snapshotId: string) => Promise<void>
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
    pairingEnabled = true,
    skillViewMode = 'linear',
    teamNames = [],
    teamsLocked = false,
    byotMode = false,
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
  const [showHomeLeague, setShowHomeLeague] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [compareA, setCompareA] = useState<'workspace' | string>('workspace')
  const [compareB, setCompareB] = useState<string>('')
  const sortHelpId = useId()
  const isWideBoard = useMediaQuery('(min-width: 768px)')

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
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
      const key = columnId(
        team != null && team >= 1 && team <= teamCount ? team : null
      )
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
      const total = teamSkillTotal(withEffectiveSkill(players, skillViewMode))
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
  }, [byColumn, teamCount, skillViewMode])

  const activePlayer = activeId
    ? (registrations.find((r) => r.id === activeId) ?? null)
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
    const scored = registrations.map((r) => ({
      ...r,
      skillLevel: effectiveSkillScore(r, skillViewMode),
    }))
    return {
      a: summarizeDraftAssignments(scored, resolve(compareA), teamCount),
      b: summarizeDraftAssignments(scored, resolve(compareB), teamCount),
      aLabel:
        compareA === 'workspace'
          ? 'Current workspace'
          : (snapshots.find((s) => s.id === compareA)?.name ?? 'A'),
      bLabel: snapshots.find((s) => s.id === compareB)?.name ?? 'B',
    }
  }, [
    assignments,
    compareA,
    compareB,
    registrations,
    snapshots,
    teamCount,
    skillViewMode,
  ])

  async function copyTeam(teamPlayers: EventRegistrationListItem[]): Promise<void> {
    const sorted = sortPlayers(teamPlayers, playerSort, skillViewMode)
    const lines = sorted.map((p) => {
      const name = copyUseRosterName
        ? p.rosterName || displayName(p)
        : displayName(p)
      let line =
        copyIncludeJersey && p.jerseyNumber != null
          ? `#${p.jerseyNumber} ${name}`
          : name
      if (showHomeLeague) {
        const league = homeLeagueText(p)
        if (league) line = `${line} — ${league}`
      }
      return line
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
    const dragged = registrations.find((r) => r.id === playerId)
    if (!dragged || dragged.teamLocked) return

    let targetTeam: number | null = null

    const overId = String(over.id)
    if (overId === 'unassigned' || overId.startsWith('team-')) {
      targetTeam = parseColumnId(overId)
    } else {
      targetTeam = assignments.get(overId) ?? null
    }

    const current = assignments.get(playerId) ?? null
    if (current === targetTeam) return

    const next = new Map(assignments)
    next.set(playerId, targetTeam)
    if (pairingEnabled && dragged.pairId) {
      for (const mate of dragged.groupMembers) {
        const mateReg = registrations.find((r) => r.id === mate.registrationId)
        if (mateReg && !mateReg.teamLocked) {
          next.set(mate.registrationId, targetTeam)
        }
      }
      if (dragged.groupMembers.length === 0 && dragged.partnerRegistrationId) {
        next.set(dragged.partnerRegistrationId, targetTeam)
      }
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
    <div className="space-y-4 rounded-lg border border-[var(--tm-panel-border,#bfdbfe)] bg-[var(--tm-panel,#eff6ff)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--tm-fg,#111827)]">
            {byotMode ? 'Assign free agents' : 'Draft mode'}
          </h2>
          <p className="text-sm text-[var(--tm-muted,#4b5563)]">
            {byotMode
              ? 'Working copy only — signup teams stay put until you Apply. Place unassigned free agents onto teams.'
              : 'Working copy only — permanent draft groups are unchanged until you Apply.'}
            {pairingEnabled ? ' Free-agent groups move together.' : ''}
            {byotMode ? ' Locked signup players cannot be moved.' : ''}
          </p>
          {teamsLocked ? (
            <p className="mt-1 text-sm font-medium text-[var(--tm-amber-fg,#92400e)]">
              Teams are locked. Unlock on the event page to Apply or Promote.
            </p>
          ) : null}
          <FieldHelp className="mt-1">
            {byotMode
              ? 'Drag free agents from Unassigned onto teams. Reshuffle only re-seeds free agents. Save snapshots to compare before applying.'
              : 'Drag players between teams. Reshuffle re-seeds from the current setup. Save snapshots to compare alternatives before applying.'}
          </FieldHelp>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unassignedCount > 0 ? (
            <span className="rounded border border-[var(--tm-amber-border,#fcd34d)] bg-[var(--tm-amber-bg,#fffbeb)] px-2.5 py-1.5 text-sm font-semibold text-[var(--tm-amber-fg,#78350f)]">
              Unassigned {unassignedCount}
            </span>
          ) : (
            <span className="rounded border border-[var(--tm-border,#e5e7eb)] bg-[var(--tm-surface,#fff)] px-2.5 py-1.5 text-sm text-[var(--tm-muted,#4b5563)]">
              Unassigned 0
            </span>
          )}
          <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--tm-fg,#374151)]">
            <span className="text-[var(--tm-muted,#4b5563)]">Sort within teams</span>
            <select
              className={INPUT_CLASS}
              value={playerSort}
              onChange={(e) => setPlayerSort(e.target.value as PlayerSort)}
              aria-describedby={sortHelpId}
            >
              <option value="name">Name</option>
              <option value="gender">Gender</option>
              <option value="skill">Skill (high → low)</option>
            </select>
            <FieldHelp id={sortHelpId} className="sr-only">
              Sort players within each team column.
            </FieldHelp>
          </label>
          <Button variant="secondary" disabled={applying} onClick={onReshuffle}>
            Reshuffle
          </Button>
          <Button variant="secondary" disabled={applying} onClick={onDiscard}>
            Discard
          </Button>
          <Button
            variant="primary"
            disabled={applying || teamsLocked}
            onClick={onApply}
            title={teamsLocked ? 'Unlock teams to apply' : undefined}
          >
            {applying ? 'Applying…' : 'Apply to event'}
          </Button>
        </div>
      </div>

      {error ? (
        <LiveMessage variant="alert" className="text-sm text-red-600">
          {error}
        </LiveMessage>
      ) : null}

      <DraftSnapshotsPanel
        byotMode={byotMode}
        snapshots={snapshots}
        snapshotsBusy={snapshotsBusy}
        applying={applying}
        teamsLocked={teamsLocked}
        teamNames={teamNames}
        snapshotName={snapshotName}
        onSnapshotNameChange={setSnapshotName}
        onSaveSnapshot={() => void handleSaveSnapshot()}
        onLoadSnapshot={onLoadSnapshot}
        onRenameSnapshot={onRenameSnapshot}
        onDeleteSnapshot={onDeleteSnapshot}
        onPromoteSnapshot={onPromoteSnapshot}
        compareA={compareA}
        compareB={compareB}
        onCompareAChange={setCompareA}
        onCompareBChange={setCompareB}
        compareSummary={compareSummary}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded border border-[var(--tm-border,#e5e7eb)] bg-[var(--tm-surface,#fff)] px-3 py-2 text-sm text-[var(--tm-fg,#374151)]">
        <span className="font-medium text-[var(--tm-muted,#4b5563)]">
          Copy roster options
        </span>
        <label className="flex min-h-11 cursor-pointer items-center gap-1.5 md:min-h-0">
          <input
            type="checkbox"
            className={FOCUS_RING}
            checked={copyIncludeJersey}
            onChange={(e) => setCopyIncludeJersey(e.target.checked)}
          />
          Include jersey #
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-1.5 md:min-h-0">
          <input
            type="checkbox"
            className={FOCUS_RING}
            checked={copyUseRosterName}
            onChange={(e) => setCopyUseRosterName(e.target.checked)}
          />
          Use roster name
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-1.5 md:min-h-0">
          <input
            type="checkbox"
            className={FOCUS_RING}
            checked={showHomeLeague}
            onChange={(e) => setShowHomeLeague(e.target.checked)}
          />
          Show home league
        </label>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className={
            isWideBoard
              ? 'flex gap-3 overflow-x-auto pb-2'
              : 'flex flex-col gap-3'
          }
          data-testid={isWideBoard ? 'draft-board-wide' : 'draft-board-stacked'}
        >
          <DraftTeamColumn
            team={null}
            label="Unassigned"
            players={unassignedPlayers}
            sort={playerSort}
            skillViewMode={skillViewMode}
            emphasizeUnassigned
            pairingEnabled={pairingEnabled}
            showHomeLeague={showHomeLeague}
            stacked={!isWideBoard}
            stickyUnassigned={!isWideBoard}
            captainBadgeFor={(p) =>
              captainBadgeForAssignment(p, null, registrations, assignments)
            }
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
              <DraftTeamColumn
                key={t}
                team={t}
                label={resolveTeamName(t, teamNames)}
                players={teamPlayers}
                sort={playerSort}
                skillViewMode={skillViewMode}
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
                byotSections={byotMode}
                pairingEnabled={pairingEnabled}
                showHomeLeague={showHomeLeague}
                stacked={!isWideBoard}
                captainBadgeFor={(p) =>
                  captainBadgeForAssignment(p, t, registrations, assignments)
                }
                onCopy={() => copyTeam(teamPlayers)}
              />
            )
          })}
        </div>
        <DragOverlay>
          {activePlayer ? (
            <DraftPlayerCard
              player={activePlayer}
              skillViewMode={skillViewMode}
              dragging
              pairingEnabled={pairingEnabled}
              showHomeLeague={showHomeLeague}
              captainBadge={captainBadgeForAssignment(
                activePlayer,
                assignments.get(activePlayer.id) ?? null,
                registrations,
                assignments
              )}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
