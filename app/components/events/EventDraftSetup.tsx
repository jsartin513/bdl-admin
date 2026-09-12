'use client'

import { useId } from 'react'
import { playersPerTeamLabel } from '@/app/lib/events/draft-seed'
import { Button, FieldHelp, FOCUS_RING, Tooltip } from '@/app/components/ui'
import { INPUT_CLASS } from './draft-board-utils'

export type DraftSeedMode = 'auto' | 'empty' | 'existing'

type Props = {
  hasByotLocked: boolean
  minDraftTeamCount: number
  registrationCount: number
  draftTeamCount: number
  onDraftTeamCountChange: (count: number) => void
  draftSeedMode: DraftSeedMode
  onDraftSeedModeChange: (mode: DraftSeedMode) => void
  hasExistingGroups: boolean
  onCancel: () => void
  onStart: () => void
}

export function EventDraftSetup(props: Props) {
  const {
    hasByotLocked,
    minDraftTeamCount,
    registrationCount,
    draftTeamCount,
    onDraftTeamCountChange,
    draftSeedMode,
    onDraftSeedModeChange,
    hasExistingGroups,
    onCancel,
    onStart,
  } = props

  const teamCountHelpId = useId()
  const setupHelpId = useId()

  return (
    <div className="space-y-4 rounded-lg border border-[var(--tm-panel-border,#bfdbfe)] bg-[var(--tm-panel,#eff6ff)] p-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--tm-fg,#111827)]">
          {hasByotLocked ? 'Finish team assignments' : 'Draft setup'}
        </h2>
        <FieldHelp id={setupHelpId} className="text-sm">
          {hasByotLocked
            ? 'Signup teams are already set. Place free agents onto those teams (working copy until you Apply).'
            : 'Local workspace only until you Apply. Default team size targets ~7–8 players.'}
        </FieldHelp>
      </div>
      <label className="block max-w-xs text-sm" aria-describedby={setupHelpId}>
        <span className="text-[var(--tm-muted,#4b5563)]">Number of teams</span>
        <input
          type="number"
          min={minDraftTeamCount}
          max={Math.max(minDraftTeamCount, registrationCount)}
          className={`mt-1 w-full ${INPUT_CLASS} px-3 py-2`}
          value={draftTeamCount}
          aria-describedby={teamCountHelpId}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10) || 1
            onDraftTeamCountChange(Math.max(minDraftTeamCount, parsed))
          }}
        />
        <FieldHelp id={teamCountHelpId}>
          ~{playersPerTeamLabel(registrationCount, draftTeamCount)} players per
          team
          {hasByotLocked && minDraftTeamCount > 1
            ? ` (min ${minDraftTeamCount} for locked BYOT teams)`
            : ''}
        </FieldHelp>
      </label>
      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 text-[var(--tm-muted,#4b5563)]">Start with</legend>
        <label className="flex min-h-11 items-center gap-2 md:min-h-0">
          <input
            type="radio"
            name="seedMode"
            className={FOCUS_RING}
            checked={draftSeedMode === 'auto'}
            onChange={() => onDraftSeedModeChange('auto')}
          />
          <span className="inline-flex items-center gap-1.5">
            Auto-seed free agents (gender-balanced, skill-aware)
            <Tooltip
              label="Auto-seed"
              content="Places unlocked free agents across teams. Locked BYOT signup players stay put and count toward team balance."
            />
          </span>
        </label>
        <label className="flex min-h-11 items-center gap-2 md:min-h-0">
          <input
            type="radio"
            name="seedMode"
            className={FOCUS_RING}
            checked={draftSeedMode === 'empty'}
            onChange={() => onDraftSeedModeChange('empty')}
          />
          <span className="inline-flex items-center gap-1.5">
            Empty free-agent pool (BYOT seats kept)
            <Tooltip
              label="Empty teams"
              content="Clears unlocked players to unassigned. Locked signup-team players remain on their teams."
            />
          </span>
        </label>
        {hasExistingGroups ? (
          <label className="flex min-h-11 items-center gap-2 md:min-h-0">
            <input
              type="radio"
              name="seedMode"
              className={FOCUS_RING}
              checked={draftSeedMode === 'existing'}
              onChange={() => onDraftSeedModeChange('existing')}
            />
            <span className="inline-flex items-center gap-1.5">
              {hasByotLocked
                ? 'Keep current teams (place free agents next)'
                : 'Copy current draft groups'}
              <Tooltip
                label={
                  hasByotLocked
                    ? 'Keep current teams'
                    : 'Copy current draft groups'
                }
                content={
                  hasByotLocked
                    ? 'Starts from signup teams and any players already assigned; only free agents still need placing.'
                    : 'Keeps each player on their current draft group as the starting point.'
                }
              />
            </span>
          </label>
        ) : null}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onStart}>
          {hasByotLocked ? 'Open assignment board' : 'Start drafting'}
        </Button>
      </div>
    </div>
  )
}
