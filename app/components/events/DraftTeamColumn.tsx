'use client'

import { useDroppable } from '@dnd-kit/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { teamGenderCounts, teamSkillTotal } from '@/app/lib/events/draft-seed'
import type { EventRegistrationListItem } from '@/app/lib/events/types'
import type { SkillViewMode } from '@/app/lib/players/skill'
import { FOCUS_RING, LiveMessage } from '@/app/components/ui'
import { DraggablePlayer } from './DraftPlayerCard'
import {
  COPY_FEEDBACK_DURATION_MS,
  columnId,
  sortPlayers,
  withEffectiveSkill,
  type PlayerSort,
} from './draft-board-utils'

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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

export function DraftTeamColumn(props: {
  team: number | null
  label: string
  players: EventRegistrationListItem[]
  sort: PlayerSort
  skillViewMode: SkillViewMode
  showAverage?: boolean
  scoreImbalanced?: boolean
  genderImbalanced?: boolean
  emphasizeUnassigned?: boolean
  byotSections?: boolean
  pairingEnabled?: boolean
  showHomeLeague?: boolean
  stacked?: boolean
  stickyUnassigned?: boolean
  captainBadgeFor?: (player: EventRegistrationListItem) => '(C)' | '(CC)' | null
  onCopy?: () => Promise<void>
}) {
  const id = columnId(props.team)
  const { setNodeRef, isOver } = useDroppable({ id })
  const score = teamSkillTotal(withEffectiveSkill(props.players, props.skillViewMode))
  const gender = teamGenderCounts(props.players)
  const count = props.players.length
  const average = count > 0 ? score / count : 0
  const useByotSections = Boolean(props.byotSections && props.team != null)
  const signupPlayers = useMemo(
    () =>
      useByotSections
        ? sortPlayers(
            props.players.filter((p) => p.teamLocked),
            props.sort,
            props.skillViewMode
          )
        : [],
    [useByotSections, props.players, props.sort, props.skillViewMode]
  )
  const freeAgentPlayers = useMemo(
    () =>
      useByotSections
        ? sortPlayers(
            props.players.filter((p) => !p.teamLocked),
            props.sort,
            props.skillViewMode
          )
        : [],
    [useByotSections, props.players, props.sort, props.skillViewMode]
  )
  const sortedPlayers = useMemo(
    () => sortPlayers(props.players, props.sort, props.skillViewMode),
    [props.players, props.sort, props.skillViewMode]
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
    props
      .onCopy()
      .then(() => {
        setCopied(true)
        setCopyError(false)
        scheduleReset()
      })
      .catch(() => {
        setCopyError(true)
        setCopied(false)
        scheduleReset()
      })
  }

  function renderPlayer(p: EventRegistrationListItem, showFaBadge: boolean) {
    return (
      <DraggablePlayer
        key={p.id}
        player={p}
        skillViewMode={props.skillViewMode}
        pairingEnabled={props.pairingEnabled}
        showHomeLeague={props.showHomeLeague}
        showFaBadge={showFaBadge}
        captainBadge={props.captainBadgeFor?.(p) ?? null}
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[180px] flex-col rounded-lg border ${
        props.stacked ? 'w-full' : 'w-56 shrink-0'
      } ${
        props.stickyUnassigned ? 'sticky top-0 z-10' : ''
      } ${
        isOver
          ? 'border-blue-400 bg-blue-50/40'
          : emphasizeUnassigned
            ? 'border-[var(--tm-amber-border,#fcd34d)] bg-[var(--tm-amber-bg,#fffbeb)]'
            : 'border-[var(--tm-border,#e5e7eb)] bg-[var(--tm-surface-2,#f9fafb)]'
      }`}
    >
      <div
        className={`border-b px-2 py-2 ${
          emphasizeUnassigned
            ? 'border-[var(--tm-amber-border,#fde68a)]'
            : 'border-[var(--tm-border,#e5e7eb)]'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm font-semibold ${
              emphasizeUnassigned
                ? 'text-[var(--tm-amber-fg,#78350f)]'
                : 'text-[var(--tm-fg,#111827)]'
            }`}
          >
            {props.label}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs ${
                emphasizeUnassigned
                  ? 'font-semibold text-[var(--tm-amber-fg,#92400e)]'
                  : 'text-[var(--tm-muted,#6b7280)]'
              }`}
            >
              {count}
            </span>
            {props.onCopy && props.team != null ? (
              <>
                <button
                  type="button"
                  aria-label={
                    copied
                      ? 'Roster names copied'
                      : copyError
                        ? 'Failed to copy roster names'
                        : 'Copy roster names'
                  }
                  onClick={handleCopy}
                  disabled={isCopying}
                  className={`inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--tm-muted,#6b7280)] transition-colors hover:text-[var(--tm-fg,#111827)] disabled:opacity-50 md:min-h-8 md:min-w-8 ${FOCUS_RING}`}
                >
                  {copied ? (
                    <span className="text-xs font-medium text-green-600" aria-hidden="true">
                      Copied!
                    </span>
                  ) : copyError ? (
                    <span className="text-xs font-medium text-red-600" aria-hidden="true">
                      Failed
                    </span>
                  ) : (
                    <CopyIcon />
                  )}
                </button>
                {copied ? (
                  <LiveMessage variant="status" className="sr-only">
                    Roster names copied
                  </LiveMessage>
                ) : null}
                {copyError ? (
                  <LiveMessage variant="alert" className="sr-only">
                    Failed to copy roster names
                  </LiveMessage>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        {props.team != null ? (
          <div className="mt-1 space-y-0.5 text-xs text-[var(--tm-muted,#4b5563)]">
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
              emphasizeUnassigned
                ? 'font-medium text-[var(--tm-amber-fg,#92400e)]'
                : 'text-[var(--tm-muted,#6b7280)]'
            }`}
          >
            {emphasizeUnassigned
              ? `${count} not on a team — drag onto a team`
              : 'Drag onto a team'}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {useByotSections ? (
          <>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                Signup ({signupPlayers.length})
              </p>
              {signupPlayers.length > 0 ? (
                signupPlayers.map((p) => renderPlayer(p, false))
              ) : (
                <p className="text-[10px] text-[var(--tm-muted,#9ca3af)]">
                  No locked signup players
                </p>
              )}
            </div>
            <div className="mt-2 space-y-1.5 border-t border-[var(--tm-border,#e5e7eb)] pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Added free agents ({freeAgentPlayers.length})
              </p>
              {freeAgentPlayers.length > 0 ? (
                freeAgentPlayers.map((p) => renderPlayer(p, true))
              ) : (
                <p className="text-[10px] text-[var(--tm-muted,#9ca3af)]">
                  Drop free agents here
                </p>
              )}
            </div>
          </>
        ) : (
          sortedPlayers.map((p) => renderPlayer(p, false))
        )}
      </div>
    </div>
  )
}
