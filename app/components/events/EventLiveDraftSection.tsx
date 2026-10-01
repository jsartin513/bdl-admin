'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CaptainDraftSnapshot } from '@/app/lib/captain-draft/contract'
import type { LiveDraftRecord } from '@/app/lib/events/live-draft'
import type { LiveDraftOrderType } from '@/app/lib/events/live-draft-sequence'
import { Button } from '@/app/components/ui/Button'
import { LiveMessage } from '@/app/components/ui/LiveMessage'
import { FOCUS_RING } from '@/app/components/ui/focusRing'

type CommissionerRegistration = {
  id: string
  nickname: string
  firstName: string
  lastName: string
  hasStrongPersonality: boolean
  strongPersonalityNotes: string | null
}

type CommissionerView = {
  draft: LiveDraftRecord
  snapshot: CaptainDraftSnapshot
  photoCoverage: { withPhoto: number; total: number }
  registrations: CommissionerRegistration[]
}

export function EventLiveDraftSection(props: { eventId: string; eventFormat: string | null }) {
  const { eventId, eventFormat } = props
  const [view, setView] = useState<CommissionerView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [poolFilter, setPoolFilter] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/events/${eventId}/live-draft`)
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Failed to load live draft')
      }
      const body = (await res.json()) as CommissionerView
      setView(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (eventFormat !== 'draft') return
    void load()
    const id = window.setInterval(() => void load(), 2500)
    return () => window.clearInterval(id)
  }, [eventFormat, load])

  const personalityByRegId = useMemo(() => {
    const map = new Map<string, CommissionerRegistration>()
    for (const r of view?.registrations ?? []) map.set(r.id, r)
    return map
  }, [view?.registrations])

  if (eventFormat !== 'draft') return null

  const draft = view?.draft
  const snapshot = view?.snapshot

  async function ensureDraft() {
    const res = await fetch(`/api/events/${eventId}/live-draft`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to initialize live draft')
    await load()
  }

  async function patchSetup(body: Record<string, unknown>) {
    const res = await fetch(`/api/events/${eventId}/live-draft`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Update failed')
    }
    await load()
  }

  async function postPick(body: Record<string, unknown>) {
    const res = await fetch(`/api/events/${eventId}/live-draft/picks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Action failed')
    }
    await load()
  }

  const filteredPool = (snapshot?.pool ?? []).filter((p) => {
    const q = poolFilter.trim().toLowerCase()
    if (!q) return true
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.genderLabel.toLowerCase().includes(q) ||
      p.skillLabel.toLowerCase().includes(q)
    )
  })

  const onClock = snapshot?.turn && !snapshot.turn.isComplete

  return (
    <section className="mt-8 rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-violet-950">Captain live draft</h2>
          <p className="mt-1 text-sm text-violet-900/80">
            Captains pick on{' '}
            <span className="font-medium">{snapshot?.playDraftUrl ?? 'play.bostondodgeballleague.com'}</span>
            . Board-only personality notes stay in this panel.
          </p>
        </div>
        {!draft && !loading ? (
          <Button variant="primary" onClick={() => void ensureDraft().catch((e) => setError(String(e)))}>
            Set up live draft
          </Button>
        ) : null}
      </div>

      {loading && !view ? (
        <p className="mt-3 text-sm text-gray-600">Loading live draft…</p>
      ) : null}
      {error ? (
        <LiveMessage variant="alert" className="mt-3 text-sm text-red-700">
          {error}
        </LiveMessage>
      ) : null}

      {draft && snapshot ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-white px-2 py-1 font-medium capitalize">
              Status: {draft.status}
            </span>
            {view?.photoCoverage ? (
              <span className="rounded bg-white px-2 py-1">
                Pool photos: {view.photoCoverage.withPhoto}/{view.photoCoverage.total}
              </span>
            ) : null}
            {onClock && snapshot.turn ? (
              <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-900">
                On the clock: {snapshot.turn.teamName} (pick #{snapshot.turn.pickIndex + 1})
              </span>
            ) : null}
          </div>

          {draft.status === 'setup' || draft.status === 'paused' ? (
            <div className="grid gap-3 rounded border border-violet-100 bg-white p-3 md:grid-cols-2">
              <label className="text-sm">
                Pick order
                <select
                  className={`mt-1 w-full rounded border px-2 py-1 ${FOCUS_RING}`}
                  value={draft.orderType}
                  onChange={(e) =>
                    void patchSetup({ orderType: e.target.value as LiveDraftOrderType }).catch((err) =>
                      setError(String(err))
                    )
                  }
                >
                  <option value="snake">Snake</option>
                  <option value="linear">Linear</option>
                </select>
              </label>
              <label className="text-sm">
                Min W/NB players per team
                <input
                  type="number"
                  min={0}
                  className={`mt-1 w-full rounded border px-2 py-1 ${FOCUS_RING}`}
                  value={draft.rules.minWomenNb}
                  onChange={(e) =>
                    void patchSetup({
                      rules: { ...draft.rules, minWomenNb: Number(e.target.value) },
                    }).catch((err) => setError(String(err)))
                  }
                />
              </label>
              <label className="text-sm">
                Min intermediate per team
                <input
                  type="number"
                  min={0}
                  className={`mt-1 w-full rounded border px-2 py-1 ${FOCUS_RING}`}
                  value={draft.rules.minIntermediate}
                  onChange={(e) =>
                    void patchSetup({
                      rules: { ...draft.rules, minIntermediate: Number(e.target.value) },
                    }).catch((err) => setError(String(err)))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.rules.includeOtherInWomenNb}
                  onChange={(e) =>
                    void patchSetup({
                      rules: { ...draft.rules, includeOtherInWomenNb: e.target.checked },
                    }).catch((err) => setError(String(err)))
                  }
                />
                Count &quot;other&quot; gender toward W/NB minimum
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {draft.status === 'setup' || draft.status === 'paused' ? (
              <Button
                variant="primary"
                onClick={() => void patchSetup({ action: 'start' }).catch((e) => setError(String(e)))}
              >
                {draft.status === 'paused' ? 'Resume live' : 'Start live draft'}
              </Button>
            ) : null}
            {draft.status === 'live' ? (
              <Button
                variant="outline"
                onClick={() => void patchSetup({ action: 'pause' }).catch((e) => setError(String(e)))}
              >
                Pause
              </Button>
            ) : null}
            {draft.status === 'live' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => void postPick({ action: 'skip' }).catch((e) => setError(String(e)))}
                >
                  Skip slot
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void postPick({ action: 'undo' }).catch((e) => setError(String(e)))}
                >
                  Undo last pick
                </Button>
              </>
            ) : null}
            {draft.status === 'live' || draft.status === 'paused' ? (
              <Button
                variant="secondary"
                onClick={() => void patchSetup({ action: 'complete' }).catch((e) => setError(String(e)))}
              >
                Mark complete
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded border bg-white p-3">
              <h3 className="font-medium text-gray-900">Available players</h3>
              <input
                type="search"
                placeholder="Filter pool…"
                className={`mt-2 w-full rounded border px-2 py-1 text-sm ${FOCUS_RING}`}
                value={poolFilter}
                onChange={(e) => setPoolFilter(e.target.value)}
              />
              <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                {filteredPool.map((p) => {
                  const priv = personalityByRegId.get(p.registrationId)
                  return (
                    <li
                      key={p.registrationId}
                      className="flex items-center justify-between gap-2 rounded border px-2 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{p.displayName}</div>
                        <div className="text-xs text-gray-600">
                          {p.genderLabel} · {p.skillLabel}
                        </div>
                        {priv?.hasStrongPersonality ? (
                          <div className="text-xs text-amber-800" title={priv.strongPersonalityNotes ?? ''}>
                            ⚡ Board note (not shown to captains)
                          </div>
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        disabled={draft.status !== 'live'}
                        onClick={() =>
                          void postPick({ action: 'force', registrationId: p.registrationId }).catch((e) =>
                            setError(String(e))
                          )
                        }
                      >
                        Draft
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="rounded border bg-white p-3">
              <h3 className="font-medium text-gray-900">Teams & requirements</h3>
              <ul className="mt-2 max-h-96 space-y-3 overflow-y-auto text-sm">
                {snapshot.teams.map((team) => (
                  <li key={team.draftGroup} className="rounded border border-gray-100 p-2">
                    <div className="font-medium">{team.teamName}</div>
                    <div className="text-xs text-gray-600">
                      W/NB: {team.requirements.womenNbCount}/{team.requirements.womenNbRequired} · Int:{' '}
                      {team.requirements.intermediateCount}/{team.requirements.intermediateRequired}
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {team.players.map((pl) => (
                        <li key={pl.registrationId}>
                          {pl.displayName} ({pl.genderLabel}, {pl.skillLabel})
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
