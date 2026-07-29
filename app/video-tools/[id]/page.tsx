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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadSet = useCallback(async () => {
    try {
      const res = await fetch(`/api/video-tools/sets/${setId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load set')
      setSet(data.set)
      setError(null)
      return data.set as VideoUploadSetDetail
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load set')
      return null
    } finally {
      setLoading(false)
    }
  }, [setId])

  useEffect(() => {
    void loadSet()
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

  const canUpload =
    set != null &&
    !['queued', 'processing', 'complete'].includes(set.status) &&
    !busy

  const canStartOrRetryMerge =
    set != null &&
    set.clips.length > 0 &&
    ['ready', 'failed', 'processing'].includes(set.status) &&
    !busy

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
    setActionError(null)
    setUploads(
      list.map((f) => ({
        filename: f.name,
        percent: 0,
        status: 'uploading',
      }))
    )

    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        const pathname = clipBlobPathname(set.id, file.name)

        try {
          const blob = await upload(pathname, file, {
            access: 'public',
            handleUploadUrl: '/api/video-tools/upload',
            multipart: true,
            clientPayload: JSON.stringify({
              setId: set.id,
              originalFilename: file.name,
            }),
            onUploadProgress: (event) => {
              setUploads((prev) =>
                prev.map((u, idx) =>
                  idx === i
                    ? { ...u, percent: Math.round(event.percentage), status: 'uploading' }
                    : u
                )
              )
            },
          })

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
        }
      }
      await loadSet()
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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

  async function startMerge() {
    setBusy(true)
    setActionError(null)
    try {
      // Merge only from ready/failed/processing — require Mark ready after uploads finish.
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
            ? 'Queued for the merge worker…'
            : 'Worker is merging clips (this can take a while for large sets). If this seems stuck, use Retry merge to re-queue.'}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Clips</h2>
        <p className="mt-1 text-sm text-gray-600">
          Drop GoPro MP4s here. When all uploads are finished, click Mark ready,
          then Start merge. Order is applied automatically (GoPro session +
          chapter rules) when you start the merge.
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
        {canUpload && set.clips.length > 0 && set.status !== 'ready' && (
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
      </div>
    </div>
  )
}
