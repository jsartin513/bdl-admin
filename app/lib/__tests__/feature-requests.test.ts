import { describe, expect, it, vi } from 'vitest'
import {
  buildFeatureRequestIssueBody,
  buildGitHubNewIssueUrl,
  createFeatureRequestIssue,
  FEATURE_REQUEST_LABEL,
} from '@/app/lib/feature-requests'

describe('feature-requests', () => {
  it('builds a prefilled GitHub new-issue URL', () => {
    const url = buildGitHubNewIssueUrl({
      owner: 'jsartin513',
      repo: 'bdl-admin',
      title: 'Add standings export',
      body: 'Please add CSV export',
      labels: [FEATURE_REQUEST_LABEL],
    })
    expect(url).toContain('https://github.com/jsartin513/bdl-admin/issues/new?')
    expect(url).toContain('title=Add+standings+export')
    expect(url).toContain(`labels=${FEATURE_REQUEST_LABEL}`)
  })

  it('includes submitter metadata in the issue body', () => {
    const body = buildFeatureRequestIssueBody({
      description: 'Need better draft notes',
      submittedBy: 'board@example.com',
      pagePath: '/events',
    })
    expect(body).toContain('Need better draft notes')
    expect(body).toContain('Submitted by: board@example.com')
    expect(body).toContain('From page: /events')
    expect(body).toContain('Source: BDL Admin in-app feature request')
  })

  it('returns a fallback URL when no token is configured', async () => {
    const result = await createFeatureRequestIssue({
      title: 'Better schedule print',
      description: 'Print layouts for BYOT nights',
      submittedBy: 'dev@localhost',
      token: null,
    })
    expect(result.mode).toBe('fallback')
    expect(result.issueUrl).toContain('/issues/new?')
  })

  it('creates a GitHub issue when a token is set', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: FEATURE_REQUEST_LABEL }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          html_url: 'https://github.com/jsartin513/bdl-admin/issues/42',
          number: 42,
        }),
      })

    const result = await createFeatureRequestIssue({
      title: 'Better schedule print',
      description: 'Print layouts for BYOT nights',
      submittedBy: 'dev@localhost',
      token: 'ghs_test_token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toEqual({
      mode: 'created',
      issueUrl: 'https://github.com/jsartin513/bdl-admin/issues/42',
      issueNumber: 42,
    })
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/jsartin513/bdl-admin/issues',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer ghs_test_token',
        }),
      })
    )
    const init = fetchImpl.mock.calls[1][1] as RequestInit
    const payload = JSON.parse(String(init.body)) as {
      title: string
      labels: string[]
    }
    expect(payload.title).toBe('Better schedule print')
    expect(payload.labels).toEqual([FEATURE_REQUEST_LABEL])
  })
})
