'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import { clipBlobPathname } from '@/app/lib/video-tools/naming'
import type { VideoUploadSetDetail } from '@/app/lib/video-tools/types'

type UploadProgress = {
  filename: string
  percent: number
  status: 'uploading' | 'registering' | 'done' | 'error'
  error?: string
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'complete':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'processing':
    case 'queued':
      return 'bg-amber-100 text-amber-900'
    case 'uploading':
    case 'ready':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

const METADATA_EDITABLE = new Set(['draft', 'uploading', 'ready', 'failed'])

export default function VideoUploadSetDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl p-6 text-sm text-gray-600">Loading…</div>
      }
    >
      <VideoUploadSetDetailContent />
    </Suspense>
  )
}

function VideoUploadSetDetailContent() {
  const params = useParams<{ id: string }>()
  const setId = params.id
  const { devMode } = useDevMode()
  const [set, setSet] = useState<VideoUploadSetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [eventName, setEventName] = useState('')
  const [label, setLabel] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaSaved, setMetaSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const uploadingRef = useRef(false)
  const metaDirtyRef = useRef(false)

  const loadSet = useCallback(async (opts?: { syncForm?: boolean }) => {
    try {
      const res = await fetch(`/api/video-tools/sets/${setId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load set')
      const next = data.set as VideoUploadSetDetail
      setSet(next)
      if (opts?.syncForm !== false && !metaDirtyRef.current) {
        setEventName(next.eventName)
        setLabel(next.label)
        setEventDate(next.eventDate)
      }
      setError(null)
      return next
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load set')
      return null
    } finally {
      setLoading(false)
    }
  }, [setId])

  useEffect(() => {
    void loadSet({ syncForm: true })
  }, [loadSet])

  useEffect(() => {
    if (!set) return
    const shouldPoll = set.status === 'queued' || set.status === 'processing'
    if (shouldPoll) {
      pollRef.current = setInterval(() => {
        void loadSet()
      }, 4000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [set?.status, loadSet, set])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!uploadingRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const canUpload =
    set != null &&
    !['queued', 'processing', 'complete'].includes(set.status) &&
    !busy

  const canEditMetadata =
    set != null && METADATA_EDITABLE.has(set.status)

  const canStartOrRetryMerge =
    set != null &&
    set.clips.length > 0 &&
    ['ready', 'failed', 'processing'].includes(set.status) &&
    !busy &&
    !set.autoEnqueueOnReady

  const metaDirty =
    set != null &&
    (eventName.trim() !== set.eventName ||
      label.trim() !== set.label ||
      eventDate !== set.eventDate)

  useEffect(() => {
    metaDirtyRef.current = metaDirty
  }, [metaDirty])

  async function uploadFiles(files: FileList | File[]) {
    if (!set || !canUpload) return
    const list = Array.from(files).filter((f) =>
      /\.(mp4|mov)$/i.test(f.name) || f.type.startsWith('video/')
    )
    if (list.length === 0) {
      setActionError('Select MP4 or MOV video files')
      return
    }

    setBusy(true)
    uploadingRef.current = true
    setActionError(null)
    setUploads(
      list.map((f) => ({
        filename: f.name,
        percent: 0,
        status: 'uploading',
      }))
    )

    let reserved = false
    try {
      const reserveRes = await fetch(
        `/api/video-tools/sets/${set.id}/reserve-uploads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: list.length }),
        }
      )
      const reserveData = await reserveRes.json()
      if (!reserveRes.ok) {
        throw new Error(reserveData.error || 'Failed to reserve upload slots')
      }
      reserved = true
      if (reserveData.set) setSet(reserveData.set)

      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        const pathname = clipBlobPathname(set.id, file.name)

        let tokenMinted = false
        try {
          const blob = await upload(pathname, file, {
            access: 'public',
            handleUploadUrl: '/api/video-tools/upload',
            multipart: true,
            clientPayload: JSON.stringify({
              setId: set.id,
              originalFilename: file.name,
              preReserved: true,
            }),
            onUploadProgress: (event) => {
              tokenMinted = true
              setUploads((prev) =>
                prev.map((u, idx) =>
                  idx === i
                    ? { ...u, percent: Math.round(event.percentage), status: 'uploading' }
                    : u
                )
              )
            },
          })
          tokenMinted = true

          setUploads((prev) =>
            prev.map((u, idx) =>
              idx === i ? { ...u, percent: 100, status: 'registering' } : u
            )
          )

          const reg = await fetch(`/api/video-tools/sets/${set.id}/clips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalFilename: file.name,
              blobUrl: blob.url,
              pathname: blob.pathname,
              sizeBytes: file.size,
            }),
          })
          const regData = await reg.json()
          if (!reg.ok) throw new Error(regData.error || 'Failed to register clip')

          setUploads((prev) =>
            prev.map((u, idx) =>
              idx === i ? { ...u, percent: 100, status: 'done' } : u
            )
          )
          if (regData.set) setSet(regData.set)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed'
          setUploads((prev) =>
            prev.map((u, idx) =>
              idx === i ? { ...u, status: 'error', error: message } : u
            )
          )
          // Best-effort: clear this slot if a token was minted or reserved.
          if (tokenMinted || reserved) {
            try {
              const cancelRes = await fetch(
                `/api/video-tools/sets/${set.id}/cancel-upload`,
                { method: 'POST' }
              )
              if (cancelRes.ok) {
                const cancelData = await cancelRes.json()
                if (cancelData.set) setSet(cancelData.set)
              }
            } catch {
              // best-effort
            }
          }
        }
      }

      // Client fallback: if auto-enqueue is on, ensure merge starts after the batch.
      const after = await loadSet()
      if (after?.autoEnqueueOnReady) {
        try {
          const autoRes = await fetch(`/api/video-tools/sets/${setId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'maybe_auto_enqueue' }),
          })
          const autoData = await autoRes.json()
          if (autoRes.ok && autoData.set) setSet(autoData.set)
        } catch {
          // best-effort
        }
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Upload failed')
      if (reserved) {
        // Release any leftover reserved slots from a failed batch start.
        try {
          await fetch(`/api/video-tools/sets/${set.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_pending_uploads' }),
          })
        } catch {
          // best-effort
        }
      }
      await loadSet()
    } finally {
      setBusy(false)
      uploadingRef.current = false
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function saveMetadata(e: React.FormEvent) {
    e.preventDefault()
    if (!canEditMetadata) return
    setSavingMeta(true)
    setActionError(null)
    setMetaSaved(false)
    try {
      const res = await fetch(`/api/video-tools/sets/${setId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_metadata',
          eventName,
          label,
          eventDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save details')
      setSet(data.set)
      setEventName(data.set.eventName)
      setLabel(data.set.label)
      setEventDate(data.set.eventDate)
      setMetaSaved(true)
      metaDirtyRef.current = false
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save details')
    } finally {
      setSavingMeta(false)
    }
  }

  async function toggleAutoEnqueue(next: boolean) {
    setActionError(null)
    try {
      const res = await fetch(`/api/video-tools/sets/${setId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_auto_enqueue',
          autoEnqueueOnReady: next,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update auto-start')
      setSet(data.set)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update auto-start'
      )
    }
  }

  async function markReady() {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/video-tools/sets/${setId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_ready' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to mark ready')
      setSet(data.set)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark ready')
    } finally {
      setBusy(false)
    }
  }

  async function resetPending() {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/video-tools/sets/${setId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_pending_uploads' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear pending uploads')
      setSet(data.set)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to clear pending uploads'
      )
    } finally {
      setBusy(false)
    }
  }

  async function startMerge() {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/video-tools/sets/${setId}/enqueue`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start merge')
      setSet(data.set)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to start merge')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-sm text-gray-600" role="status">
        Loading…
      </div>
    )
  }

  if (error || !set) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Link
          href={withDevMode('/video-tools', devMode)}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Video Tools
        </Link>
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error || 'Upload set not found'}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        href={withDevMode('/video-tools', devMode)}
        className="text-sm text-blue-700 hover:underline"
      >
        ← Video Tools
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{set.displayTitle}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {set.eventDate} · started by {set.createdByEmail}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(set.status)}`}
        >
          {set.status}
        </span>
      </div>

      {set.errorMessage && (
        <div
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {set.errorMessage}
        </div>
      )}

      {actionError && (
        <div
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {set.status === 'complete' && set.mergedBlobUrl && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm font-medium text-green-900">Merge complete</p>
          <p className="mt-1 text-sm text-green-800">
            {set.outputFilename || 'untrimmed merge'}
          </p>
          <a
            href={set.mergedBlobUrl}
            className="mt-2 inline-block text-sm font-medium text-green-900 underline"
            target="_blank"
            rel="noreferrer"
          >
            Download merged video
          </a>
        </div>
      )}

      {(set.status === 'queued' || set.status === 'processing') && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {set.status === 'queued'
            ? 'Queued for the merge worker. You can leave this page — you will get an in-app notification when it finishes.'
            : 'Worker is merging clips (this can take a while for large sets). Safe to leave; you will be notified when it finishes or fails. If this seems stuck, turn off auto-start and use Retry merge.'}
        </div>
      )}

      {canEditMetadata && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-gray-900">Set details</h2>
          <p className="mt-1 text-sm text-gray-600">
            You can edit these while clips are uploading.
          </p>
          <form
            onSubmit={(e) => void saveMetadata(e)}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="eventName"
                className="block text-sm font-medium text-gray-800"
              >
                Event name
              </label>
              <input
                id="eventName"
                type="text"
                required
                value={eventName}
                onChange={(e) => {
                  setEventName(e.target.value)
                  setMetaSaved(false)
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label
                htmlFor="label"
                className="block text-sm font-medium text-gray-800"
              >
                Label (court / session)
              </label>
              <input
                id="label"
                type="text"
                required
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value)
                  setMetaSaved(false)
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label
                htmlFor="eventDate"
                className="block text-sm font-medium text-gray-800"
              >
                Event date
              </label>
              <input
                id="eventDate"
                type="date"
                required
                value={eventDate}
                onChange={(e) => {
                  setEventDate(e.target.value)
                  setMetaSaved(false)
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingMeta || !metaDirty}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              >
                {savingMeta ? 'Saving…' : 'Save details'}
              </button>
              {metaSaved && !metaDirty && (
                <span className="text-sm text-green-700">Saved</span>
              )}
            </div>
          </form>

          <label className="mt-6 flex items-start gap-3 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-300"
              checked={set.autoEnqueueOnReady}
              onChange={(e) => void toggleAutoEnqueue(e.target.checked)}
              disabled={busy && uploads.some((u) => u.status === 'uploading')}
            />
            <span>
              <span className="font-medium">
                When uploads finish, start merge automatically
              </span>
              <span className="mt-0.5 block text-gray-600">
                Keep this tab open until uploads finish. After that you can leave —
                merge runs in the background and you will get a notification.
              </span>
            </span>
          </label>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Clips</h2>
        <p className="mt-1 text-sm text-gray-600">
          Drop GoPro MP4s here
          {set.autoEnqueueOnReady
            ? '. With auto-start on, merge begins when the last upload finishes.'
            : '. When all uploads are finished, click Mark ready, then Start merge.'}{' '}
          Order is applied automatically (GoPro session + chapter rules) when
          merge starts. Keep this tab open while files transfer.
        </p>

        {canUpload && (
          <div
            className="mt-4 rounded-md border-2 border-dashed border-gray-300 px-4 py-8 text-center"
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (e.dataTransfer.files?.length) {
                void uploadFiles(e.dataTransfer.files)
              }
            }}
          >
            <p className="text-sm text-gray-600">Drag and drop videos, or</p>
            <button
              type="button"
              className="mt-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              Choose files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.MP4,.mov,.MOV"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files)
              }}
            />
          </div>
        )}

        {uploads.length > 0 && (
          <ul className="mt-4 space-y-2">
            {uploads.map((u) => (
              <li
                key={u.filename + u.status}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm"
              >
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium text-gray-800">
                    {u.filename}
                  </span>
                  <span className="shrink-0 text-gray-600">
                    {u.status === 'error'
                      ? 'Error'
                      : u.status === 'done'
                        ? 'Done'
                        : u.status === 'registering'
                          ? 'Saving…'
                          : `${u.percent}%`}
                  </span>
                </div>
                {u.status === 'uploading' && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-gray-100">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${u.percent}%` }}
                    />
                  </div>
                )}
                {u.error && (
                  <p className="mt-1 text-xs text-red-700">{u.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {set.clips.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">No clips uploaded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200">
            {set.clips.map((clip, idx) => (
              <li
                key={clip.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="text-gray-500 mr-2">
                    {clip.sortIndex != null ? clip.sortIndex + 1 : idx + 1}.
                  </span>
                  <span className="font-medium text-gray-900">
                    {clip.originalFilename}
                  </span>
                </div>
                <span className="text-gray-600">{formatBytes(clip.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        {canUpload &&
          set.clips.length > 0 &&
          set.status !== 'ready' &&
          !set.autoEnqueueOnReady && (
            <button
              type="button"
              onClick={() => void markReady()}
              disabled={busy || set.pendingUploadCount > 0}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
            >
              {set.pendingUploadCount > 0
                ? `Mark ready (${set.pendingUploadCount} uploading…)`
                : 'Mark ready'}
            </button>
          )}
        {set.pendingUploadCount > 0 &&
          !['queued', 'processing', 'complete'].includes(set.status) && (
            <button
              type="button"
              onClick={() => void resetPending()}
              disabled={busy}
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
            >
              Clear stuck uploads ({set.pendingUploadCount})
            </button>
          )}
        {canStartOrRetryMerge && (
          <button
            type="button"
            onClick={() => void startMerge()}
            disabled={busy}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {set.status === 'failed' || set.status === 'processing'
              ? 'Retry merge'
              : 'Start merge'}
          </button>
        )}
        {set.autoEnqueueOnReady &&
          (set.status === 'failed' || set.status === 'processing') &&
          !busy && (
            <button
              type="button"
              onClick={() => void startMerge()}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              Retry merge
            </button>
          )}
      </div>
    </div>
  )
}
