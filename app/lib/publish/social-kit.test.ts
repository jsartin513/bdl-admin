import { describe, expect, it } from 'vitest'
import { buildSocialKit } from '@/app/lib/publish/social-kit'
import type { PublishPostRecord } from '@/app/lib/publish/types'

const base: PublishPostRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'open_gym_flyer',
  title: 'Open Gym Sunday',
  caption: 'Join us in Somerville',
  mediaUrl: 'https://example.blob.vercel-storage.com/flyer.jpg',
  mediaType: 'image',
  includeOpenGymFlyer: true,
  includeSiteAlert: false,
  siteAlertKind: null,
  siteAlertEndsAt: null,
  includeNewsPost: false,
  status: 'published',
  websiteNewsPostId: null,
  websiteSiteAlertId: null,
  websiteNewsSlug: null,
  postedToInstagram: false,
  postedToYoutube: false,
  approvedBy: 'dev@localhost',
  approvedAt: null,
  publishError: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('buildSocialKit', () => {
  it('includes title, caption, and open gym link', () => {
    const kit = buildSocialKit(base)
    expect(kit.instagramCaption).toContain('Open Gym Sunday')
    expect(kit.instagramCaption).toContain('/open-gym')
    expect(kit.youtubeTitle).toBeNull()
  })

  it('adds YouTube fields for video', () => {
    const kit = buildSocialKit({ ...base, kind: 'short_video', mediaType: 'video' })
    expect(kit.youtubeTitle).toBe('Open Gym Sunday')
    expect(kit.youtubeDescription).toContain('#Shorts')
  })
})
