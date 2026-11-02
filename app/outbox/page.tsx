'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { LiveMessage } from '@/app/components/ui'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'
import type {
  OutboundChannel,
  OutboundMessageRecord,
  OutboundSummary,
} from '@/app/lib/outbound/types'

type StatusFilter = '' | 'failed' | 'sent' | 'skipped'
type ChannelFilter = '' | OutboundChannel

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'delivered':
    case 'sent':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'skipped':
    case 'opted_out':
      return 'bg-gray-100 text-gray-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'contact':
      return 'Contact'
    case 'video_notify':
      return 'Video notify'
    case 'login_alert':
      return 'Login alert'
    default:
      return kind
  }
}

function channelLabel(channel: string): string {
  switch (channel) {
    case 'email':
      return 'Email'
    case 'sms':
      return 'SMS'
    case 'whatsapp':
      return 'WhatsApp'
    default:
      return channel
  }
}

function filterPillClass(active: boolean): string {
  return active
    ? 'bg-blue-600 text-white border-blue-600'
    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
}

export default function OutboxPage() {
  return (
    <Suspense
      fallback={
        <div
          className="mx-auto max-w-5xl p-6 text-sm text-gray-600"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          Loading…
        </div>
      }
    >
      <OutboxPageContent />
    </Suspense>
  )
}

function OutboxPageContent() {
  const { devMode } = useDevMode()
  const [messages, setMessages] = useState<OutboundMessageRecord[]>([])
  const [summary, setSummary] = useState<OutboundSummary>({
    sent: 0,
    failed: 0,
    skipped: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (channelFilter) params.set('channel', channelFilter)
      const qs = params.toString()
      const res = await fetch(`/api/outbox${qs ? `?${qs}` : ''}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load outbox')
      setMessages(data.messages ?? [])
      setSummary(
        data.summary ?? { sent: 0, failed: 0, skipped: 0 }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outbox')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, channelFilter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Outbox</h1>
        <p className="mt-1 text-sm text-gray-600">
          Outgoing email, SMS, and WhatsApp from Contact players and system
          alerts. Failed email rows mean Resend rejected the send; SMS/WhatsApp
          may update after delivery callbacks.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Sent (7 days)
          </p>
          <p className="mt-1 text-2xl font-semibold text-green-800">
            {summary.sent}
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">
            Failed (7 days)
          </p>
          <p className="mt-1 text-2xl font-semibold text-red-800">
            {summary.failed}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Skipped (7 days)
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-800">
            {summary.skipped}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-sm text-gray-600 self-center mr-1">Status:</span>
        {(
          [
            ['', 'All'],
            ['failed', 'Failed'],
            ['sent', 'Sent'],
            ['skipped', 'Skipped'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            className={`rounded-full border px-3 py-1 text-sm ${filterPillClass(statusFilter === value)}`}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <span className="text-sm text-gray-600 self-center mr-1">Channel:</span>
        {(
          [
            ['', 'All'],
            ['email', 'Email'],
            ['sms', 'SMS'],
            ['whatsapp', 'WhatsApp'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            className={`rounded-full border px-3 py-1 text-sm ${filterPillClass(channelFilter === value)}`}
            onClick={() => setChannelFilter(value as ChannelFilter)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <LiveMessage variant="alert" className="mb-4 text-sm text-red-600">
          {error}
        </LiveMessage>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-600" role="status" aria-busy="true">
          Loading…
        </p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-gray-600">No messages match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-700">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">To</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Detail</th>
                <th className="px-3 py-2 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {messages.map((m) => {
                const detail = m.errorMessage || m.skipReason || '—'
                return (
                  <tr key={m.id} className="text-gray-900">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {formatDateTime(m.sentAt ?? m.createdAt)}
                    </td>
                    <td className="px-3 py-2">{channelLabel(m.channel)}</td>
                    <td className="px-3 py-2">{kindLabel(m.kind)}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate">
                      {m.playerId ? (
                        <Link
                          href={withDevMode('/players', devMode)}
                          className="text-blue-600 hover:underline"
                          title={m.toAddress ?? undefined}
                        >
                          {m.toAddress ?? '—'}
                        </Link>
                      ) : (
                        m.toAddress ?? '—'
                      )}
                    </td>
                    <td
                      className="px-3 py-2 max-w-[200px] truncate"
                      title={m.subject ?? undefined}
                    >
                      {m.subject ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(m.status)}`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td
                      className="px-3 py-2 max-w-[180px] truncate text-gray-600"
                      title={detail}
                    >
                      {detail}
                    </td>
                    <td
                      className="px-3 py-2 max-w-[140px] truncate text-gray-600"
                      title={m.createdByAdminEmail ?? undefined}
                    >
                      {m.createdByAdminEmail ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
