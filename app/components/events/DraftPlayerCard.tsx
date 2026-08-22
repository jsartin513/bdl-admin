'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { EventRegistrationListItem } from '@/app/lib/events/types'
import {
  effectiveSkillLabel,
  effectiveSkillScore,
  type SkillViewMode,
} from '@/app/lib/players/skill'
import { Tooltip } from '@/app/components/ui'
import { homeLeagueText, playerCardClass } from './draft-board-utils'

export function DraftPlayerCard(props: {
  player: EventRegistrationListItem
  skillViewMode: SkillViewMode
  dragging?: boolean
  pairingEnabled?: boolean
  showHomeLeague?: boolean
  showFaBadge?: boolean
  captainBadge?: '(C)' | '(CC)' | null
}) {
  const {
    player,
    skillViewMode,
    dragging,
    pairingEnabled,
    showHomeLeague,
    showFaBadge,
    captainBadge,
  } = props
  const league = homeLeagueText(player)
  const score = effectiveSkillScore(player, skillViewMode)
  const label = effectiveSkillLabel(player, skillViewMode)
  const groupLabel =
    player.groupMembers.length > 0
      ? player.groupMembers.map((m) => m.nickname).filter(Boolean).join(', ')
      : player.partnerNickname
  return (
    <div
      className={`rounded border px-2 py-2 text-xs shadow-sm md:py-1.5 ${playerCardClass(player.gender)} ${
        dragging ? 'opacity-90 shadow-md ring-2 ring-blue-400' : ''
      } ${player.teamLocked ? 'ring-1 ring-amber-300' : ''}`}
    >
      <div className="text-sm font-medium text-[var(--tm-fg,#111827)] md:text-xs">
        {player.nickname || `${player.firstName} ${player.lastName}`}
        {player.teamLocked ? (
          <Tooltip
            label="BYOT locked"
            content="Signed up on this team. Cannot be moved here — use roster Unlock to change."
          >
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Locked
            </span>
          </Tooltip>
        ) : showFaBadge ? (
          <Tooltip
            label="Free agent"
            content="Added to this team after signup (not an original BYOT member)."
          >
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              FA
            </span>
          </Tooltip>
        ) : null}
        {captainBadge ? (
          <Tooltip
            label={captainBadge === '(CC)' ? 'Co-captain' : 'Captain'}
            content={
              captainBadge === '(CC)'
                ? 'Co-captain on this team (more than one captain assigned).'
                : 'Team captain.'
            }
          >
            <span className="ml-1 text-[10px] font-semibold text-blue-700">
              {captainBadge}
            </span>
          </Tooltip>
        ) : null}
        {player.hasStrongPersonality ? (
          <Tooltip
            label="Strong personality"
            content={player.strongPersonalityNotes || 'Flagged as strong personality'}
          >
            <span className="ml-1 text-amber-500">⚡</span>
          </Tooltip>
        ) : null}
        {pairingEnabled !== false && player.pairId ? (
          <Tooltip
            label="Free-agent group"
            content={
              groupLabel
                ? `Grouped with ${groupLabel}. Group members move together.`
                : 'Grouped with other free agents. Group members move together.'
            }
          >
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              Group
              {player.groupMembers.length > 0
                ? ` · ${player.groupMembers.length + 1}`
                : groupLabel
                  ? ` · ${groupLabel}`
                  : ''}
            </span>
          </Tooltip>
        ) : null}
      </div>
      <div className="text-xs text-[var(--tm-muted,#4b5563)]">
        {score != null ? label : '—'} · {player.genderGroupLabel}
        {score != null ? ` · ${score}` : ''}
      </div>
      {showHomeLeague && league ? (
        <div className="mt-0.5 text-[10px] text-[var(--tm-muted,#6b7280)]">{league}</div>
      ) : null}
    </div>
  )
}

export function DraggablePlayer(props: {
  player: EventRegistrationListItem
  skillViewMode: SkillViewMode
  pairingEnabled?: boolean
  showHomeLeague?: boolean
  showFaBadge?: boolean
  captainBadge?: '(C)' | '(CC)' | null
}) {
  const locked = props.player.teamLocked
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: props.player.id, disabled: locked })
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  if (locked) {
    return (
      <div className="cursor-not-allowed opacity-95" aria-disabled="true">
        <DraftPlayerCard
          player={props.player}
          skillViewMode={props.skillViewMode}
          pairingEnabled={props.pairingEnabled}
          showHomeLeague={props.showHomeLeague}
          showFaBadge={props.showFaBadge}
          captainBadge={props.captainBadge}
        />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cursor-grab ${isDragging ? 'opacity-40' : ''}`}
      {...listeners}
      {...attributes}
    >
      <DraftPlayerCard
        player={props.player}
        skillViewMode={props.skillViewMode}
        pairingEnabled={props.pairingEnabled}
        showHomeLeague={props.showHomeLeague}
        showFaBadge={props.showFaBadge}
        captainBadge={props.captainBadge}
      />
    </div>
  )
}
