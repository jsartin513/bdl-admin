'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import { buildSocialKit } from '@/app/lib/publish/social-kit'
import type { PublishKind, PublishPostRecord, SocialKit } from '@/app/lib/publish/types'
import { formatEasternLocal, easternLocalToDate } from '@/app/lib/schedule/eastern'

const KIND_LABELS: Record<PublishKind, string> = {
  open_gym_flyer: 'Open Gym flyer',
  announcement: 'Announcement',
  short_video: 'Short video',
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <button
          type="button"
          className="text-xs text-teal-800 underline"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            })
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-40 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  )
}

function SocialKitPanel({
  post,
  kit,
  onSocialChange,
}: {
  post: PublishPostRecord
  kit: SocialKit
  onSocialChange: (patch: { postedToInstagram?: boolean; postedToYoutube?: boolean }) => void
}) {
  return (
    <section className="mt-8 rounded-lg border border-teal-200 bg-teal-50/50 p-4">
      <h2 className="text-lg font-semibold text-gray-900">Instagram &amp; YouTube kit</h2>
      <p className="mt-1 text-sm text-gray-600">
        Post these manually. Auto-post to social networks is not enabled yet.
      </p>
      <p className="mt-2 text-xs text-gray-600">{kit.cropNotes}</p>

      <div className="mt-4 space-y-4">
        <CopyBlock label="Instagram caption" text={kit.instagramCaption} />
        {kit.youtubeTitle ? (
          <CopyBlock label="YouTube title" text={kit.youtubeTitle} />
        ) : null}
        {kit.youtubeDescription ? (
          <CopyBlock label="YouTube description" text={kit.youtubeDescription} />
        ) : null}
        {post.mediaUrl ? (
          <p className="text-sm">
            <a
              href={post.mediaUrl}
              className="font-medium text-teal-800 underline"
              download
              target="_blank"
              rel="noreferrer"
            >
              Download media for upload
            </a>
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={post.postedToInstagram}
            onChange={(e) => onSocialChange({ postedToInstagram: e.target.checked })}
          />
          Posted to Instagram
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={post.postedToYoutube}
            onChange={(e) => onSocialChange({ postedToYoutube: e.target.checked })}
          />
          Posted to YouTube
        </label>
      </div>
    </section>
  )
}

export default function PublishDetailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-6 text-sm text-gray-600">Loading…</div>}>
      <PublishDetailContent />
    </Suspense>
  )
}

function PublishDetailContent() {
  const params = useParams()
  const postId = typeof params.id === 'string' ? params.id : null
  const { devMode } = useDevMode()
  const [post, setPost] = useState<PublishPostRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [publishRunAt, setPublishRunAt] = useState(() =>
    formatEasternLocal(new Date(Date.now() + 60 * 60 * 1000))
  )

  const load = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/publish/${postId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load post')
      setPost(data.post)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    void load()
  }, [load])

  const socialKit = useMemo(() => (post ? buildSocialKit(post) : null), [post])

  async function saveDraft(): Promise<boolean> {
    if (!post || post.status === 'published') return true
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/publish/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: post.title,
          caption: post.caption,
          mediaUrl: post.mediaUrl,
          mediaType: post.mediaType,
          includeOpenGymFlyer: post.includeOpenGymFlyer,
          includeSiteAlert: post.includeSiteAlert,
          siteAlertKind: post.siteAlertKind,
          siteAlertStartsAt: post.siteAlertStartsAt,
          siteAlertEndsAt: post.siteAlertEndsAt,
          newsPublishAt: post.newsPublishAt,
          includeNewsPost: post.includeNewsPost,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setPost(data.post)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function approve() {
    if (!post) return
    setApproving(true)
    setError(null)
    try {
      const saved = await saveDraft()
      if (!saved) return
      const res = await fetch(`/api/publish/${post.id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to publish')
      setPost(data.post)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish')
      void load()
    } finally {
      setApproving(false)
    }
  }

  async function schedulePublish() {
    if (!post) return
    setScheduling(true)
    setError(null)
    try {
      const saved = await saveDraft()
      if (!saved) return
      const res = await fetch(`/api/publish/${post.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runAt: publishRunAt,
          siteAlertStartsAt: post.siteAlertStartsAt,
          siteAlertEndsAt: post.siteAlertEndsAt,
          newsPublishAt: post.newsPublishAt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to schedule')
      setPost(data.post)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule')
      void load()
    } finally {
      setScheduling(false)
    }
  }

  async function onUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const pathname = `publish/${Date.now()}-${safeName}`
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/publish/upload',
        multipart: file.size > 4.5 * 1024 * 1024,
      })
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image'
      setPost((prev) =>
        prev
          ? {
              ...prev,
              mediaUrl: blob.url,
              mediaType,
            }
          : prev
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function patchSocial(patch: { postedToInstagram?: boolean; postedToYoutube?: boolean }) {
    if (!post) return
    const res = await fetch(`/api/publish/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) setPost(data.post)
  }

  if (loading || !post) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-gray-600">
        {error ?? 'Loading…'}
      </div>
    )
  }

  const isDraft = post.status === 'draft'
  const isScheduled = post.status === 'scheduled'

  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="mb-4 text-sm">
        <Link href={withDevMode('/publish', devMode)} className="text-teal-800 underline">
          ← All posts
        </Link>
      </p>

      <h1 className="text-2xl font-semibold text-gray-900">{KIND_LABELS[post.kind]}</h1>
      <p className="mt-1 text-sm text-gray-600">
        Status: <strong>{post.status}</strong>
        {post.publishError ? (
          <span className="ml-2 text-red-700">Last error: {post.publishError}</span>
        ) : null}
      </p>

      {error ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-gray-800">Title</span>
          <input
            type="text"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            value={post.title}
            disabled={!isDraft}
            onChange={(e) => setPost({ ...post, title: e.target.value })}
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-gray-800">Caption</span>
          <textarea
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            rows={4}
            value={post.caption}
            disabled={!isDraft}
            onChange={(e) => setPost({ ...post, caption: e.target.value })}
          />
        </label>

        <div className="text-sm">
          <span className="font-medium text-gray-800">Media</span>
          {post.mediaUrl ? (
            <p className="mt-1 break-all text-xs text-gray-600">{post.mediaUrl}</p>
          ) : null}
          {isDraft ? (
            <input
              type="file"
              accept="image/*,video/*"
              className="mt-2 block text-sm"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onUpload(file)
              }}
            />
          ) : null}
          {uploading ? <p className="text-xs text-gray-500">Uploading…</p> : null}
        </div>

        <fieldset className="rounded border border-gray-200 p-3 text-sm" disabled={!isDraft}>
          <legend className="px-1 font-medium text-gray-800">Website targets</legend>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={post.includeOpenGymFlyer}
              onChange={(e) => setPost({ ...post, includeOpenGymFlyer: e.target.checked })}
            />
            Open Gym flyer (image only)
          </label>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={post.includeSiteAlert}
              onChange={(e) => setPost({ ...post, includeSiteAlert: e.target.checked })}
            />
            Header banner
          </label>
          {post.includeSiteAlert ? (
            <>
              <label className="mt-2 block">
                Banner kind
                <select
                  className="ml-2 rounded border border-gray-300 px-2 py-1"
                  value={post.siteAlertKind ?? 'news'}
                  onChange={(e) =>
                    setPost({
                      ...post,
                      siteAlertKind: e.target.value as 'news' | 'cancellation',
                    })
                  }
                >
                  <option value="news">News</option>
                  <option value="cancellation">Cancellation</option>
                </select>
              </label>
              <label className="mt-2 block text-sm">
                Banner starts (Eastern, optional)
                <input
                  type="datetime-local"
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  value={
                    post.siteAlertStartsAt
                      ? formatEasternLocal(new Date(post.siteAlertStartsAt))
                      : ''
                  }
                  onChange={(e) => {
                    const d = e.target.value ? easternLocalToDate(e.target.value) : null
                    setPost({
                      ...post,
                      siteAlertStartsAt: d ? d.toISOString() : null,
                    })
                  }}
                />
              </label>
              <label className="mt-2 block text-sm">
                Banner ends (Eastern)
                <input
                  type="datetime-local"
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  value={
                    post.siteAlertEndsAt
                      ? formatEasternLocal(new Date(post.siteAlertEndsAt))
                      : ''
                  }
                  onChange={(e) => {
                    const d = e.target.value ? easternLocalToDate(e.target.value) : null
                    setPost({
                      ...post,
                      siteAlertEndsAt: d ? d.toISOString() : null,
                    })
                  }}
                />
              </label>
            </>
          ) : null}
          {post.includeNewsPost ? (
            <label className="mt-2 block text-sm">
              News go-live (Eastern, optional)
              <input
                type="datetime-local"
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                value={
                  post.newsPublishAt
                    ? formatEasternLocal(new Date(post.newsPublishAt))
                    : ''
                }
                onChange={(e) => {
                  const d = e.target.value ? easternLocalToDate(e.target.value) : null
                  setPost({
                    ...post,
                    newsPublishAt: d ? d.toISOString() : null,
                  })
                }}
              />
            </label>
          ) : null}
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={post.includeNewsPost}
              onChange={(e) => setPost({ ...post, includeNewsPost: e.target.checked })}
            />
            News post
          </label>
        </fieldset>

        {isDraft ? (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={() => void approve()}
                disabled={approving}
                className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {approving ? 'Publishing…' : 'Approve & publish now'}
              </button>
            </div>
            <fieldset className="rounded border border-gray-200 p-3 text-sm">
              <legend className="px-1 font-medium">Schedule publish</legend>
              <label className="block">
                Run at (Eastern)
                <input
                  type="datetime-local"
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  value={publishRunAt}
                  onChange={(e) => setPublishRunAt(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => void schedulePublish()}
                disabled={scheduling}
                className="mt-3 rounded border border-teal-700 px-4 py-2 text-sm text-teal-800 hover:bg-teal-50 disabled:opacity-50"
              >
                {scheduling ? 'Scheduling…' : 'Schedule website publish'}
              </button>
            </fieldset>
          </div>
        ) : null}

        {isScheduled ? (
          <p className="mt-4 text-sm text-amber-800">
            This post is scheduled for website publish. Cancel from{' '}
            <Link href={withDevMode('/scheduled', devMode)} className="underline">
              Scheduled
            </Link>
            .
          </p>
        ) : null}
      </div>

      {post.status === 'published' && socialKit ? (
        <SocialKitPanel post={post} kit={socialKit} onSocialChange={(p) => void patchSocial(p)} />
      ) : null}
    </div>
  )
}
