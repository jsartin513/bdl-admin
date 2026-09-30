'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { withDevMode } from '@/app/lib/devMode'
import { useDevMode } from '@/app/hooks/useDevMode'
import type { PublishKind, PublishPostRecord } from '@/app/lib/publish/types'

const KIND_LABELS: Record<PublishKind, string> = {
  open_gym_flyer: 'Open Gym flyer',
  announcement: 'Announcement',
  short_video: 'Short video',
}

export default function PublishListPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl p-6 text-sm text-gray-600">Loading…</div>}>
      <PublishListContent />
    </Suspense>
  )
}

function PublishListContent() {
  const { devMode } = useDevMode()
  const [posts, setPosts] = useState<PublishPostRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<PublishKind | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/publish')
      const text = await res.text()
      const data = text ? (JSON.parse(text) as { posts?: PublishPostRecord[]; error?: string }) : {}
      if (!res.ok) throw new Error(data.error || 'Failed to load posts')
      setPosts(data.posts ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function startDraft(kind: PublishKind) {
    setCreating(kind)
    setError(null)
    try {
      const title =
        kind === 'open_gym_flyer'
          ? 'Open Gym'
          : kind === 'short_video'
            ? 'New short'
            : 'Announcement'
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, title, caption: '' }),
      })
      const text = await res.text()
      const data = text ? (JSON.parse(text) as { post?: PublishPostRecord; error?: string }) : {}
      if (!res.ok) throw new Error(data.error || 'Failed to create draft')
      if (!data.post?.id) throw new Error('Failed to create draft')
      window.location.href = withDevMode(`/publish/${data.post.id}`, devMode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create draft')
      setCreating(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Publish</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Compose once, push to the public website, then copy captions and download media
            for Instagram and YouTube.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mb-8 flex flex-wrap gap-2">
        {(Object.keys(KIND_LABELS) as PublishKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={creating !== null}
            onClick={() => void startDraft(kind)}
            className="rounded border border-teal-600 bg-white px-3 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50 disabled:opacity-50"
          >
            {creating === kind ? 'Creating…' : `New ${KIND_LABELS[kind]}`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Loading drafts…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-600">No posts yet. Start with a template above.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={withDevMode(`/publish/${post.id}`, devMode)}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <span className="font-medium text-gray-900">{post.title}</span>
                  <span className="ml-2 text-xs text-gray-500">{KIND_LABELS[post.kind]}</span>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    post.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {post.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
