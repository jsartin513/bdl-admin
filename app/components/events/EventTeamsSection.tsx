'use client'

import type { EventRegistrationListItem } from '@/app/lib/events/types'
import { teamGenderCounts } from '@/app/lib/events/draft-seed'
import { Button, FieldHelp, FOCUS_RING } from '@/app/components/ui'
import { INPUT_CLASS } from './draft-board-utils'

type Props = {
  hasByotLocked: boolean
  teamsLocked: boolean
  teamsFinalizedAt: string | Date | null
  teamNamesDraft: string[]
  onTeamNamesDraftChange: (names: string[]) => void
  byotTeamIndexes: Set<number>
  showFreeAgentTeamLabel: boolean
  freeAgents: EventRegistrationListItem[]
  teamsActionBusy: boolean
  teamNamesSaving: boolean
  hasExistingGroups: boolean
  onFinalize: () => void
  onSetLocked: (locked: boolean) => void
  onExport: () => void
  onSaveTeamNames: () => void
}

export function EventTeamsSection(props: Props) {
  const {
    hasByotLocked,
    teamsLocked,
    teamsFinalizedAt,
    teamNamesDraft,
    onTeamNamesDraftChange,
    byotTeamIndexes,
    showFreeAgentTeamLabel,
    freeAgents,
    teamsActionBusy,
    teamNamesSaving,
    hasExistingGroups,
    onFinalize,
    onSetLocked,
    onExport,
    onSaveTeamNames,
  } = props

  const freeAgentGender = teamGenderCounts(freeAgents)

  return (
    <section className="space-y-4 rounded-lg border border-[var(--tm-border,#e5e7eb)] bg-[var(--tm-surface,#fff)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--tm-fg,#111827)]">
            Teams
          </h2>
          <FieldHelp>
            {hasByotLocked
              ? 'Imported BYOT names can only be changed when unlocked. Free-agent and draft/remix names stay editable. Missing names fall back to Team 1, Team 2, …'
              : 'Rename teams anytime. Extra names are ignored; missing names fall back to Team 1, Team 2, …'}
          </FieldHelp>
          {teamsFinalizedAt ? (
            <p className="mt-1 text-sm text-[var(--tm-muted,#4b5563)]">
              {teamsLocked
                ? 'Finalized and locked.'
                : 'Finalized (unlocked for late registrations).'}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--tm-muted,#4b5563)]">
              Not finalized yet.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!teamsFinalizedAt ? (
            <Button
              variant="primary"
              disabled={teamsActionBusy || !hasExistingGroups}
              onClick={onFinalize}
            >
              Finalize teams
            </Button>
          ) : teamsLocked ? (
            <Button
              variant="secondary"
              className="border-amber-400 bg-[var(--tm-amber-bg,#fffbeb)] text-[var(--tm-amber-fg,#78350f)]"
              disabled={teamsActionBusy}
              onClick={() => onSetLocked(false)}
            >
              Unlock teams
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={teamsActionBusy}
              onClick={() => onSetLocked(true)}
            >
              Lock teams
            </Button>
          )}
          {teamsFinalizedAt ? (
            <Button
              variant="secondary"
              className="border-violet-300 bg-violet-50 text-violet-900"
              onClick={onExport}
            >
              Export for DodgeballHub
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="space-y-2">
          {teamNamesDraft.map((name, index) => {
            const teamNum = index + 1
            const isByotSlot = byotTeamIndexes.has(teamNum)
            const byotFrozen = Boolean(teamsLocked && isByotSlot)
            const slotBusy = teamNamesSaving || byotFrozen
            const upBlocked =
              index === 0 ||
              slotBusy ||
              (teamsLocked && byotTeamIndexes.has(index))
            const downBlocked =
              index >= teamNamesDraft.length - 1 ||
              slotBusy ||
              (teamsLocked && byotTeamIndexes.has(index + 2))
            const removeBlocked =
              slotBusy ||
              (teamsLocked && [...byotTeamIndexes].some((g) => g > teamNum))
            return (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-[var(--tm-muted,#6b7280)]">
                  Team {teamNum}
                  {isByotSlot ? (
                    <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                      BYOT
                    </span>
                  ) : null}
                </span>
                <input
                  type="text"
                  className={`min-h-11 min-w-[12rem] flex-1 px-3 text-sm disabled:opacity-40 md:min-h-0 ${INPUT_CLASS}`}
                  value={name}
                  disabled={slotBusy}
                  title={
                    byotFrozen
                      ? 'Unlock teams to edit imported BYOT names'
                      : undefined
                  }
                  placeholder={`Team ${teamNum}`}
                  onChange={(e) => {
                    const value = e.target.value
                    onTeamNamesDraftChange(
                      teamNamesDraft.map((n, i) => (i === index ? value : n))
                    )
                  }}
                />
                <button
                  type="button"
                  className={`min-h-11 px-2 text-xs text-red-700 hover:underline disabled:opacity-40 md:min-h-0 ${FOCUS_RING}`}
                  disabled={removeBlocked}
                  title={
                    byotFrozen
                      ? 'Unlock teams to remove imported BYOT names'
                      : teamsLocked &&
                          [...byotTeamIndexes].some((g) => g > teamNum)
                        ? 'Cannot remove a slot that would shift locked BYOT names'
                        : undefined
                  }
                  onClick={() =>
                    onTeamNamesDraftChange(
                      teamNamesDraft.filter((_, i) => i !== index)
                    )
                  }
                >
                  Remove
                </button>
                <button
                  type="button"
                  className={`min-h-11 px-2 text-xs text-[var(--tm-muted,#4b5563)] hover:underline disabled:opacity-40 md:min-h-0 ${FOCUS_RING}`}
                  disabled={upBlocked}
                  onClick={() => {
                    if (index === 0) return
                    const next = [...teamNamesDraft]
                    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                    onTeamNamesDraftChange(next)
                  }}
                >
                  Up
                </button>
                <button
                  type="button"
                  className={`min-h-11 px-2 text-xs text-[var(--tm-muted,#4b5563)] hover:underline disabled:opacity-40 md:min-h-0 ${FOCUS_RING}`}
                  disabled={downBlocked}
                  onClick={() => {
                    if (index >= teamNamesDraft.length - 1) return
                    const next = [...teamNamesDraft]
                    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                    onTeamNamesDraftChange(next)
                  }}
                >
                  Down
                </button>
              </div>
            )
          })}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="secondary"
              disabled={teamNamesSaving}
              onClick={() => onTeamNamesDraftChange([...teamNamesDraft, ''])}
            >
              {showFreeAgentTeamLabel ? 'Add free agent team' : 'Add team name'}
            </Button>
            <Button
              variant="primary"
              className="bg-gray-900 hover:bg-gray-800"
              disabled={teamNamesSaving}
              onClick={onSaveTeamNames}
            >
              {teamNamesSaving ? 'Saving…' : 'Save team names'}
            </Button>
          </div>
          {showFreeAgentTeamLabel ? (
            <FieldHelp>
              Empty free-agent teams you can fill from Unassigned on the
              assignment board.
            </FieldHelp>
          ) : null}
        </div>

        <div className="space-y-2 rounded-lg border border-[var(--tm-border,#e5e7eb)] bg-[var(--tm-surface-2,#f9fafb)] px-3 py-3">
          <h3 className="text-sm font-semibold text-[var(--tm-fg,#111827)]">
            Free agents ({freeAgents.length})
          </h3>
          <p className="text-xs text-[var(--tm-muted,#4b5563)]">
            W/NB/O {freeAgentGender.wNbO} · M {freeAgentGender.men}
            {freeAgentGender.unset ? ` · — ${freeAgentGender.unset}` : ''}
          </p>
          {freeAgents.length === 0 ? (
            <p className="text-xs text-[var(--tm-muted,#6b7280)]">No free agents</p>
          ) : (
            <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs text-[var(--tm-fg,#1f2937)]">
              {freeAgents.map((r) => {
                const full =
                  `${r.firstName} ${r.lastName}`.trim() ||
                  r.rosterName ||
                  r.nickname ||
                  'Unknown'
                return (
                  <li key={r.id} className="truncate">
                    {full}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
