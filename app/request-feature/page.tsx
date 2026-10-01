'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useDevMode } from '@/app/hooks/useDevMode'
import { withDevMode } from '@/app/lib/devMode'

export default function RequestFeaturePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <RequestFeatureContent />
    </Suspense>
  )
}

function RequestFeatureContent() {
  const { devMode } = useDevMode()
  const pathname = usePathname()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    mode: 'created' | 'fallback'
    issueUrl: string
    issueNumber?: number
  } | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/feature-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          pagePath: pathname,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        mode?: 'created' | 'fallback'
        issueUrl?: string
        issueNumber?: number
      }
      if (!res.ok) {
        throw new Error(data.error || 'Request failed')
      }
      if (!data.issueUrl || !data.mode) {
        throw new Error('Unexpected response from server')
      }
      setResult({
        mode: data.mode,
        issueUrl: data.issueUrl,
        issueNumber: data.issueNumber,
      })
      if (data.mode === 'fallback') {
        window.open(data.issueUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link
        href={withDevMode('/whats-new', devMode)}
        className="text-sm text-blue-600 underline dark:text-blue-400"
      >
        ← What&apos;s New
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">
        Request a feature
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Submissions create a GitHub issue on the League Admin repo (label{' '}
        <code className="text-xs">board-request</code>). Your signed-in email is
        included so we can follow up.
      </p>

      {result ? (
        <div
          role="status"
          className="mt-6 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-950 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100"
        >
          {result.mode === 'created' ? (
            <p>
              Created issue{' '}
              {result.issueNumber ? `#${result.issueNumber}` : ''} —{' '}
              <a
                href={result.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                view on GitHub
              </a>
              .
            </p>
          ) : (
            <p>
              GitHub token is not configured on this environment, so we opened a
              prefilled issue form.{' '}
              <a
                href={result.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Open again
              </a>{' '}
              if the popup was blocked.
            </p>
          )}
          <button
            type="button"
            className="mt-3 text-sm underline"
            onClick={() => {
              setResult(null)
              setTitle('')
              setDescription('')
            }}
          >
            Submit another
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="feature-title"
              className="block text-sm font-medium text-foreground"
            >
              Title
            </label>
            <input
              id="feature-title"
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              placeholder="Short summary of the request"
            />
          </div>
          <div>
            <label
              htmlFor="feature-description"
              className="block text-sm font-medium text-foreground"
            >
              Description
            </label>
            <textarea
              id="feature-description"
              required
              minLength={10}
              maxLength={8000}
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              placeholder="What should we build? Who is it for? Any constraints?"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      )}
    </div>
  )
}
