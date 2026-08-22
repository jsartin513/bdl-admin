'use client'

import { useId, useState } from 'react'
import { summarizeDraftAssignments } from '@/app/lib/events/draft-seed'
import { resolveTeamName } from '@/app/lib/events/dodgeballhub-export'
import type { EventDraftSnapshotListItem } from '@/app/lib/events/types'
import {
  Button,
  ConfirmDialog,
  Dialog,
  FieldHelp,
  FOCUS_RING,
} from '@/app/components/ui'
import { INPUT_CLASS } from './draft-board-utils'

type Summary = ReturnType<typeof summarizeDraftAssignments>

type Props = {
  byotMode: boolean
  snapshots: EventDraftSnapshotListItem[]
  snapshotsBusy: boolean
  applying: boolean
  teamsLocked: boolean
  teamNames: string[]
  snapshotName: string
  onSnapshotNameChange: (name: string) => void
  onSaveSnapshot: () => void
  onLoadSnapshot: (snapshotId: string) => void
  onRenameSnapshot: (snapshotId: string, name: string) => Promise<void>
  onDeleteSnapshot: (snapshotId: string) => Promise<void>
  onPromoteSnapshot: (snapshotId: string) => Promise<void>
  compareA: 'workspace' | string
  compareB: string
  onCompareAChange: (value: 'workspace' | string) => void
  onCompareBChange: (value: string) => void
  compareSummary: {
    a: Summary
    b: Summary
    aLabel: string
    bLabel: string
  } | null
}

export function DraftSnapshotsPanel(props: Props) {
  const {
    byotMode,
    snapshots,
    snapshotsBusy,
    applying,
    teamsLocked,
    teamNames,
    snapshotName,
    onSnapshotNameChange,
    onSaveSnapshot,
    onLoadSnapshot,
    onRenameSnapshot,
    onDeleteSnapshot,
    onPromoteSnapshot,
    compareA,
    compareB,
    onCompareAChange,
    onCompareBChange,
    compareSummary,
  } = props

  const nameHelpId = useId()
  const [renameTarget, setRenameTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'promote'
    id: string
    name: string
  } | null>(null)

  return (
    <div className="space-y-3 rounded border border-violet-200 bg-[var(--tm-surface,#fff)] px-3 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="text-[var(--tm-muted,#4b5563)]">
            {byotMode ? 'Save assignment as' : 'Save draft as'}
          </span>
          <input
            className={`mt-1 block w-52 ${INPUT_CLASS}`}
            value={snapshotName}
            disabled={snapshotsBusy || applying}
            onChange={(e) => onSnapshotNameChange(e.target.value)}
            placeholder="e.g. Balanced A"
            aria-describedby={nameHelpId}
          />
          <FieldHelp id={nameHelpId}>
            Name a workspace copy to load or compare later.
          </FieldHelp>
        </label>
        <Button
          variant="secondary"
          className="border-violet-300 bg-violet-50 text-violet-900"
          disabled={snapshotsBusy || applying || !snapshotName.trim()}
          onClick={onSaveSnapshot}
        >
          Save snapshot
        </Button>
      </div>

      {snapshots.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[var(--tm-muted,#4b5563)]">
              <tr>
                <th className="py-1 pr-3 font-medium">
                  {byotMode ? 'Saved assignments' : 'Saved drafts'}
                </th>
                <th className="py-1 pr-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-[var(--tm-border,#f3f4f6)]"
                >
                  <td className="py-2 pr-3">
                    <div className="font-medium text-[var(--tm-fg,#111827)]">
                      {s.name}
                    </div>
                    <div className="text-xs text-[var(--tm-muted,#6b7280)]">
                      {new Date(s.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`min-h-11 px-1 text-xs text-[var(--tm-link,#1d4ed8)] hover:underline disabled:opacity-40 md:min-h-0 ${FOCUS_RING}`}
                        disabled={snapshotsBusy || applying}
                        onClick={() => onLoadSnapshot(s.id)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className={`min-h-11 px-1 text-xs text-[var(--tm-fg,#374151)] hover:underline disabled:opacity-40 md:min-h-0 ${FOCUS_RING}`}
                        disabled={snapshotsBusy || applying}
                        onClick={() => {
                          setRenameTarget({ id: s.id, name: s.name })
                          setRenameValue(s.name)
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className={`min-h-11 px-1 text-xs text-violet-700 hover:underline disabled:opacity-40 md:min-h-0 ${FOCUS_RING}`}
                        disabled={snapshotsBusy || applying || teamsLocked}
                        title={teamsLocked ? 'Unlock teams to promote' : undefined}
                        onClick={() =>
                          setConfirmAction({
                            type: 'promote',
                            id: s.id,
                            name: s.name,
                          })
                        }
                      >
                        Promote
                      </button>
                      <button
                        type="button"
                        className={`min-h-11 px-1 text-xs text-red-700 hover:underline disabled:opacity-40 md:min-h-0 ${FOCUS_RING}`}
                        disabled={snapshotsBusy || applying}
                        onClick={() =>
                          setConfirmAction({
                            type: 'delete',
                            id: s.id,
                            name: s.name,
                          })
                        }
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
        <p className="text-xs text-[var(--tm-muted,#6b7280)]">
          {byotMode ? 'No saved assignments yet.' : 'No saved drafts yet.'}
        </p>
      )}

      {snapshots.length > 0 ? (
        <div className="space-y-2 border-t border-[var(--tm-border,#f3f4f6)] pt-3">
          <p className="text-sm font-medium text-[var(--tm-fg,#1f2937)]">Compare</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-[var(--tm-muted,#4b5563)]">A</span>
              <select
                className={INPUT_CLASS}
                value={compareA}
                onChange={(e) =>
                  onCompareAChange(e.target.value as 'workspace' | string)
                }
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
              <span className="text-[var(--tm-muted,#4b5563)]">B</span>
              <select
                className={INPUT_CLASS}
                value={compareB}
                onChange={(e) => onCompareBChange(e.target.value)}
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
            <div className="grid gap-3 text-xs md:grid-cols-2">
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
                  className="rounded border border-[var(--tm-border,#e5e7eb)] bg-[var(--tm-surface-2,#f9fafb)] px-3 py-2"
                >
                  <div className="font-semibold text-[var(--tm-fg,#111827)]">
                    {side.label}
                  </div>
                  <div className="mt-1 text-amber-800">
                    Unassigned {side.summary.unassigned}
                  </div>
                  <ul className="mt-2 space-y-1 text-[var(--tm-muted,#374151)]">
                    {side.summary.teams.map((t) => (
                      <li key={t.team}>
                        {resolveTeamName(t.team, teamNames)}: {t.size} · score{' '}
                        {t.skillTotal}
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

      <Dialog
        open={renameTarget != null}
        onClose={() => setRenameTarget(null)}
        title="Rename snapshot"
        className="max-w-md"
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--tm-muted,#4b5563)]">Name</span>
            <input
              className={`mt-1 w-full ${INPUT_CLASS}`}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              aria-label="Snapshot name"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!renameValue.trim() || snapshotsBusy}
              onClick={() => {
                if (!renameTarget) return
                const next = renameValue.trim()
                if (!next) return
                void onRenameSnapshot(renameTarget.id, next).then(() =>
                  setRenameTarget(null)
                )
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmAction?.type === 'delete'}
        onClose={() => setConfirmAction(null)}
        title="Delete snapshot"
        danger
        confirmLabel="Delete"
        busy={snapshotsBusy}
        onConfirm={() => {
          if (!confirmAction || confirmAction.type !== 'delete') return
          void onDeleteSnapshot(confirmAction.id).then(() =>
            setConfirmAction(null)
          )
        }}
      >
        Delete snapshot “{confirmAction?.name}”? This cannot be undone.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmAction?.type === 'promote'}
        onClose={() => setConfirmAction(null)}
        title="Promote snapshot"
        confirmLabel="Promote"
        busy={snapshotsBusy}
        onConfirm={() => {
          if (!confirmAction || confirmAction.type !== 'promote') return
          void onPromoteSnapshot(confirmAction.id).then(() =>
            setConfirmAction(null)
          )
        }}
      >
        Promote “{confirmAction?.name}” to the live event roster?
      </ConfirmDialog>
    </div>
  )
}
