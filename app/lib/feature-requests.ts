/**
 * Build a GitHub "new issue" URL with title/body query params.
 * Used when GITHUB_FEATURE_REQUEST_TOKEN is not configured.
 */
export function buildGitHubNewIssueUrl(input: {
  owner: string
  repo: string
  title: string
  body: string
  labels?: string[]
}): string {
  const params = new URLSearchParams()
  params.set('title', input.title)
  params.set('body', input.body)
  if (input.labels?.length) {
    params.set('labels', input.labels.join(','))
  }
  return `https://github.com/${input.owner}/${input.repo}/issues/new?${params.toString()}`
}

export function buildFeatureRequestIssueBody(input: {
  description: string
  submittedBy: string
  pagePath?: string | null
}): string {
  const lines = [
    input.description.trim(),
    '',
    '---',
    `Submitted by: ${input.submittedBy}`,
  ]
  if (input.pagePath) {
    lines.push(`From page: ${input.pagePath}`)
  }
  lines.push('Source: BDL Admin in-app feature request')
  return lines.join('\n')
}

export const FEATURE_REQUEST_REPO = {
  owner: 'jsartin513',
  repo: 'bdl-admin',
} as const

export const FEATURE_REQUEST_LABEL = 'board-request'

export type CreateFeatureRequestResult =
  | { mode: 'created'; issueUrl: string; issueNumber: number }
  | { mode: 'fallback'; issueUrl: string }

export async function createFeatureRequestIssue(input: {
  title: string
  description: string
  submittedBy: string
  pagePath?: string | null
  token?: string | null
  fetchImpl?: typeof fetch
}): Promise<CreateFeatureRequestResult> {
  const title = input.title.trim()
  const body = buildFeatureRequestIssueBody({
    description: input.description,
    submittedBy: input.submittedBy,
    pagePath: input.pagePath,
  })
  const labels = [FEATURE_REQUEST_LABEL]
  const { owner, repo } = FEATURE_REQUEST_REPO

  if (!input.token) {
    return {
      mode: 'fallback',
      issueUrl: buildGitHubNewIssueUrl({
        owner,
        repo,
        title,
        body,
        labels,
      }),
    }
  }

  const fetchFn = input.fetchImpl ?? fetch
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${input.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }

  // Best-effort: ensure the board-request label exists (ignore failures).
  await fetchFn(`https://api.github.com/repos/${owner}/${repo}/labels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: FEATURE_REQUEST_LABEL,
      color: '0E8A16',
      description: 'Board member feature request from League Admin',
    }),
  }).catch(() => null)

  let res = await fetchFn(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, body, labels }),
    }
  )

  // If the label still cannot be applied, create the issue without labels.
  if (!res.ok && res.status === 422) {
    res = await fetchFn(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, body }),
      }
    )
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `GitHub issue create failed (${res.status}): ${text.slice(0, 300)}`
    )
  }

  const data = (await res.json()) as { html_url?: string; number?: number }
  if (!data.html_url || typeof data.number !== 'number') {
    throw new Error('GitHub issue create returned an unexpected payload')
  }

  return {
    mode: 'created',
    issueUrl: data.html_url,
    issueNumber: data.number,
  }
}
