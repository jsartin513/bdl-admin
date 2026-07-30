import { describe, expect, it } from 'vitest'
import {
  buildYoutubeVideoDescription,
  buildYoutubeVideoTitle,
  youtubeWatchUrl,
} from '@/app/lib/youtube/types'
import { encryptSecret, decryptSecret } from '@/app/lib/youtube/crypto'

describe('youtube helpers', () => {
  it('builds watch URLs', () => {
    expect(youtubeWatchUrl('abc123')).toBe(
      'https://www.youtube.com/watch?v=abc123'
    )
  })

  it('builds title under 100 chars', () => {
    const title = buildYoutubeVideoTitle({
      eventName: 'BDL Season 7: Summer Remix',
      label: 'Court 1',
      eventDate: '2026-07-12',
    })
    expect(title).toContain('Court 1')
    expect(title.length).toBeLessThanOrEqual(100)
  })

  it('builds description with event fields', () => {
    const desc = buildYoutubeVideoDescription({
      eventName: 'Event',
      label: 'Court 2',
      eventDate: '2026-07-12',
      appHref: 'https://example.com/video-tools/1',
    })
    expect(desc).toContain('Court 2')
    expect(desc).toContain('https://example.com/video-tools/1')
  })
})

describe('youtube token crypto', () => {
  it('round-trips secrets when ADMIN_SESSION_SECRET is set', () => {
    const prev = process.env.ADMIN_SESSION_SECRET
    process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-for-youtube'
    try {
      const enc = encryptSecret('refresh-token-value')
      expect(enc).not.toContain('refresh-token-value')
      expect(decryptSecret(enc)).toBe('refresh-token-value')
    } finally {
      if (prev === undefined) delete process.env.ADMIN_SESSION_SECRET
      else process.env.ADMIN_SESSION_SECRET = prev
    }
  })
})
