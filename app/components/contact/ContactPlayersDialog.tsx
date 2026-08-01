'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { Dialog } from '@/app/components/ui/Dialog'
import { LiveMessage } from '@/app/components/ui/LiveMessage'
import { estimateSmsSegments } from '@/app/lib/contact/phone'
import type { ContactChannel, WhatsAppTemplateKey } from '@/app/lib/contact/types'

export type ContactAudienceProp =
  | { mode: 'player_ids'; playerIds: string[]; eventId?: string | null; label?: string }
  | {
      mode: 'filter'
      filters: {
        q?: string
        skill?: number | 'unset' | null
        homeLeague?: string | 'unset' | null
        eventId?: string | null
      }
      label?: string
    }

type PreviewResponse = {
  channel: ContactChannel
  total: number
  reachable: number
  skipped: number
  skippedByReason: Record<string, number>
  sample: Array<{
    playerId: string
    firstName: string
    lastName: string
    rosterName: string
    address: string | null
    status: string
    skipReason: string | null
  }>
  eventName: string | null
  eventDate: string | null
  providers: { email: boolean; sms: boolean; whatsapp: boolean }
  whatsappTemplates: Array<{
    key: WhatsAppTemplateKey
    label: string
    description: string
    configured: boolean
  }>
  error?: string
}

type JobResponse = {
  job: { id: string; status: string; channel: string; errorMessage?: string | null }
  counts: Record<string, number>
  error?: string
}

const CHANNEL_LABELS: Record<ContactChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}

export function ContactPlayersDialog(props: {
  open: boolean
  onClose: () => void
  audience: ContactAudienceProp
  defaultChannel?: ContactChannel
}) {
  const titleId = useId()
  const [channel, setChannel] = useState<ContactChannel>(props.defaultChannel ?? 'email')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [whatsappTemplateKey, setWhatsappTemplateKey] =
    useState<WhatsAppTemplateKey>('event_reminder')
  const [templateBodyVar, setTemplateBodyVar] = useState('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<JobResponse | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [step, setStep] = useState<'compose' | 'preview' | 'done'>('compose')

  const audienceLabel = props.audience.label ?? 'Selected players'
  const smsSegments = useMemo(
    () => (channel === 'sms' ? estimateSmsSegments(bodyText) : 0),
    [channel, bodyText]
  )

  useEffect(() => {
    if (!props.open) return
    setChannel(props.defaultChannel ?? 'email')
    setSubject('')
    setBodyText('')
    setWhatsappTemplateKey('event_reminder')
    setTemplateBodyVar('')
    setPreview(null)
    setPreviewError(null)
    setSendResult(null)
    setSendError(null)
    setStep('compose')
  }, [props.open, props.defaultChannel])

  function audiencePayload() {
    if (props.audience.mode === 'player_ids') {
      return {
        playerIds: props.audience.playerIds,
        eventId: props.audience.eventId ?? undefined,
      }
    }
    return { filters: props.audience.filters }
  }

  async function runPreview() {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const res = await fetch('/api/contact/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          bodyText,
          ...audiencePayload(),
        }),
      })
      const data = (await res.json()) as PreviewResponse
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreview(data)
      setStep('preview')

      if (channel === 'email' && data.eventName && !subject.trim()) {
        setSubject(`Update: ${data.eventName}`)
      }
      if (
        channel === 'email' &&
        data.eventName &&
        !bodyText.trim()
      ) {
        setBodyText(
          `Hi {{firstName}},\n\nQuick update about {{eventName}}${data.eventDate ? ' on {{eventDate}}' : ''}.\n\nThanks,\nBDL`
        )
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function runSend() {
    setSending(true)
    setSendError(null)
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`

      const payload: Record<string, unknown> = {
        channel,
        ...audiencePayload(),
        idempotencyKey,
      }
      if (channel === 'email') {
        payload.subject = subject
        payload.bodyText = bodyText
      } else if (channel === 'sms') {
        payload.bodyText = bodyText
      } else {
        payload.whatsappTemplateKey = whatsappTemplateKey
        payload.templateVariables = {
          ...(templateBodyVar ? { body: templateBodyVar } : {}),
        }
      }

      const res = await fetch('/api/contact/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as JobResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setSendResult(data)
      setStep('done')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const providerOk = preview?.providers?.[channel] ?? true
  const channelDisabled = (c: ContactChannel) => {
    if (!preview?.providers) return false
    return !preview.providers[c]
  }

  if (!props.open) return null

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={<span id={titleId}>Contact players</span>}
      className="max-w-2xl"
    >
      <div className="space-y-4 text-gray-900">
        <p className="text-sm text-gray-600">{audienceLabel}</p>

        {step === 'compose' || step === 'preview' ? (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Channel</legend>
              <div className="flex flex-wrap gap-3">
                {(['email', 'sms', 'whatsapp'] as ContactChannel[]).map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="contact-channel"
                      checked={channel === c}
                      disabled={channelDisabled(c)}
                      onChange={() => {
                        setChannel(c)
                        setPreview(null)
                        setStep('compose')
                      }}
                    />
                    {CHANNEL_LABELS[c]}
                    {preview && channelDisabled(c) ? (
                      <span className="text-xs text-gray-500">(not configured)</span>
                    ) : null}
                  </label>
                ))}
              </div>
            </fieldset>

            {channel === 'email' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Subject
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Event update"
                  />
                </label>
                <label className="block text-sm">
                  Message
                  <textarea
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
                    rows={8}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Hi {{firstName}}, …"
                  />
                </label>
                <p className="text-xs text-gray-500">
                  Placeholders: {'{{firstName}}'}, {'{{eventName}}'}, {'{{eventDate}}'}
                </p>
              </div>
            ) : null}

            {channel === 'sms' ? (
              <div className="space-y-2">
                <label className="block text-sm">
                  Message
                  <textarea
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    rows={5}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    maxLength={1600}
                    placeholder="Hi {{firstName}}, reminder about {{eventName}}…"
                  />
                </label>
                <p className="text-xs text-gray-500">
                  {bodyText.length}/1600 · ~{smsSegments} SMS segment
                  {smsSegments === 1 ? '' : 's'}
                </p>
              </div>
            ) : null}

            {channel === 'whatsapp' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Template
                  <select
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    value={whatsappTemplateKey}
                    onChange={(e) =>
                      setWhatsappTemplateKey(e.target.value as WhatsAppTemplateKey)
                    }
                  >
                    {(
                      preview?.whatsappTemplates ?? [
                        {
                          key: 'event_reminder' as const,
                          label: 'Event reminder',
                          description: '',
                          configured: true,
                        },
                        {
                          key: 'schedule_change' as const,
                          label: 'Schedule change',
                          description: '',
                          configured: true,
                        },
                        {
                          key: 'announcement' as const,
                          label: 'General announcement',
                          description: '',
                          configured: true,
                        },
                      ]
                    ).map((t) => (
                      <option key={t.key} value={t.key} disabled={!t.configured && !!preview}>
                        {t.label}
                        {!t.configured && preview ? ' (not configured)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {whatsappTemplateKey === 'announcement' ? (
                  <label className="block text-sm">
                    Announcement text
                    <textarea
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      rows={3}
                      value={templateBodyVar}
                      onChange={(e) => setTemplateBodyVar(e.target.value)}
                    />
                  </label>
                ) : (
                  <p className="text-xs text-gray-500">
                    Uses approved Twilio template with event placeholders filled
                    automatically when an event audience is selected.
                  </p>
                )}
              </div>
            ) : null}

            {previewError ? (
              <LiveMessage variant="alert" className="text-sm text-red-600">
                {previewError}
              </LiveMessage>
            ) : null}

            {step === 'preview' && preview ? (
              <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2 text-sm">
                <p>
                  <strong>{preview.reachable}</strong> will receive ·{' '}
                  <strong>{preview.skipped}</strong> skipped
                  {preview.total ? ` (of ${preview.total})` : ''}
                </p>
                {Object.keys(preview.skippedByReason).length > 0 ? (
                  <ul className="text-xs text-gray-600 list-disc pl-4">
                    {Object.entries(preview.skippedByReason).map(([reason, n]) => (
                      <li key={reason}>
                        {reason.replace(/_/g, ' ')}: {n}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!providerOk ? (
                  <LiveMessage variant="alert" className="text-sm text-amber-800">
                    Provider for {CHANNEL_LABELS[channel]} is not configured.
                  </LiveMessage>
                ) : null}
                {preview.sample.length > 0 ? (
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-1">Player</th>
                          <th>Address</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample.map((r) => (
                          <tr key={r.playerId} className="border-t border-gray-200">
                            <td className="py-1">{r.rosterName}</td>
                            <td className="font-mono">{r.address ?? '—'}</td>
                            <td>
                              {r.status === 'reachable'
                                ? 'reachable'
                                : r.skipReason ?? 'skipped'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}

            {sendError ? (
              <LiveMessage variant="alert" className="text-sm text-red-600">
                {sendError}
              </LiveMessage>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                onClick={props.onClose}
              >
                Cancel
              </button>
              {step === 'compose' ? (
                <button
                  type="button"
                  className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40"
                  disabled={previewLoading}
                  onClick={() => void runPreview()}
                >
                  {previewLoading ? 'Previewing…' : 'Preview recipients'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                    onClick={() => setStep('compose')}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40"
                    disabled={
                      sending ||
                      !preview ||
                      preview.reachable === 0 ||
                      !providerOk ||
                      (channel === 'email' && (!subject.trim() || !bodyText.trim())) ||
                      (channel === 'sms' && !bodyText.trim())
                    }
                    onClick={() => void runSend()}
                  >
                    {sending
                      ? 'Sending…'
                      : `Send ${CHANNEL_LABELS[channel]} (${preview?.reachable ?? 0})`}
                  </button>
                </>
              )}
            </div>
          </>
        ) : null}

        {step === 'done' && sendResult ? (
          <div className="space-y-3">
            <LiveMessage variant="status" className="text-sm text-green-700">
              Job {sendResult.job.status}. Sent:{' '}
              {sendResult.counts.sent ?? 0}, failed:{' '}
              {sendResult.counts.failed ?? 0}, skipped:{' '}
              {sendResult.counts.skipped ?? 0}.
            </LiveMessage>
            {sendResult.job.errorMessage ? (
              <LiveMessage variant="alert" className="text-sm text-red-600">
                {sendResult.job.errorMessage}
              </LiveMessage>
            ) : null}
            <p className="text-xs text-gray-500">Job id: {sendResult.job.id}</p>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
                onClick={props.onClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
