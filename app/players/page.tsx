'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SKILL_LEVELS, skillLevelLabel } from '@/app/lib/players/skill'
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

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [includeMerged, setIncludeMerged] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<PlayerSnapshot | null>(null)
  const [history, setHistory] = useState<HistoryRow[] | null>(null)
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null)

  const [mergeOpen, setMergeOpen] = useState(false)
  const [survivorId, setSurvivorId] = useState('')

  const [importOpen, setImportOpen] = useState(false)
  const [importCsv, setImportCsv] = useState('')
  const [importFilename, setImportFilename] = useState('teamlinkt.csv')
  const [importPreview, setImportPreview] = useState<{
    actions: ImportAction[]
    summary: Record<string, number>
    warnings: string[]
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

  const selectedPlayers = useMemo(
    () => players.filter((p) => selectedIds.has(p.id)),
    [players, selectedIds]
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
    jerseyNumber?: number | null
    skillLevel?: number | null
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
        body: JSON.stringify({ csv: importCsv, filename: importFilename, dryRun: true }),
      })
      const data = await readApiJson(res)
      if (!res.ok) throw new Error(String(data.error || 'Preview failed'))
      setImportPreview({
        actions: data.actions as ImportAction[],
        summary: data.summary as Record<string, number>,
        warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
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
            Roster names, jersey numbers, skill levels, aliases, and emails.
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
        <label className="text-sm text-gray-900">
          <span className="block text-gray-600 mb-1">Skill</span>
          <select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">All</option>
            <option value="unset">Unset</option>
            {Object.entries(SKILL_LEVELS).map(([value, label]) => (
              <option key={value} value={value}>
                {value}: {label}
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
        <button
          type="button"
          onClick={() => void loadPlayers()}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-600">Loading players…</p> : null}

      {!loading && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white text-gray-900">
          <table className="min-w-full text-sm text-gray-900">
            <thead className="bg-gray-50 text-left text-gray-700">
              <tr>
                <th className="px-3 py-2 w-10" />
                <th className="px-3 py-2">First</th>
                <th className="px-3 py-2">Last</th>
                <th className="px-3 py-2">Roster name</th>
                <th className="px-3 py-2">Jersey</th>
                <th className="px-3 py-2">Skill</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {players.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-gray-100 ${p.isMerged ? 'bg-gray-50 text-gray-500' : 'text-gray-900'}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      disabled={p.isMerged}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </td>
                  <td className="px-3 py-2">{p.firstName}</td>
                  <td className="px-3 py-2">{p.lastName}</td>
                  <td className="px-3 py-2">{p.rosterName}</td>
                  <td className="px-3 py-2">{p.jerseyNumber ?? '—'}</td>
                  <td className="px-3 py-2">{p.skillLabel}</td>
                  <td className="px-3 py-2">{p.primaryEmail ?? '—'}</td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => void openEdit(p.id)}
                    >
                      Edit
                    </button>
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
              {players.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    No players yet. Import a TeamLinkt CSV or add one manually.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
                {importPreview.warnings.length > 0 ? (
                  <ul className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 space-y-1">
                    {importPreview.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
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
}) {
  const p = props.player
  const [firstName, setFirstName] = useState(p.firstName)
  const [lastName, setLastName] = useState(p.lastName)
  const [rosterName, setRosterName] = useState(p.rosterName)
  const [jerseyNumber, setJerseyNumber] = useState(
    p.jerseyNumber != null ? String(p.jerseyNumber) : ''
  )
  const [skillLevel, setSkillLevel] = useState(
    p.skillLevel != null ? String(p.skillLevel) : ''
  )
  const [newEmail, setNewEmail] = useState('')
  const [newAlias, setNewAlias] = useState('')

  useEffect(() => {
    setFirstName(p.firstName)
    setLastName(p.lastName)
    setRosterName(p.rosterName)
    setJerseyNumber(p.jerseyNumber != null ? String(p.jerseyNumber) : '')
    setSkillLevel(p.skillLevel != null ? String(p.skillLevel) : '')
  }, [p])

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
          <p className="text-sm text-amber-700 bg-amber-50 rounded px-3 py-2">
            This player was merged into another record and cannot be edited.
          </p>
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
                jerseyNumber: parseJerseyNumber(jerseyNumber),
                skillLevel: skillLevel ? Number(skillLevel) : null,
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
    jerseyNumber?: number | null
    skillLevel?: number | null
    email?: string
  }) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [rosterName, setRosterName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [email, setEmail] = useState('')

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
          <label className="text-sm">
            Jersey #
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
            />
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
                jerseyNumber: parseJerseyNumber(jerseyNumber),
                skillLevel: skillLevel ? Number(skillLevel) : null,
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
