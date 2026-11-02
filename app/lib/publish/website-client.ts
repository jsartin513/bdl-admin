import type { PublishPostRecord } from '@/app/lib/publish/types'
import { slugify } from '@/app/lib/publish/slug'

export type WebsitePublishPayload = {
  adminPostId: string
  openGymFlyerUrl?: string | null
  news?: {
    websiteNewsPostId?: string | null
    title: string
    summary: string
    body?: string | null
    published: boolean
    publishedAt?: string | null
    imageUrl?: string | null
    slug?: string
  }
  siteAlert?: {
    websiteSiteAlertId?: string | null
    enabled: boolean
    kind: 'news' | 'cancellation'
    message: string
    linkUrl?: string | null
    linkLabel?: string | null
    startsAt?: string | null
    endsAt: string
  }
}

export function buildWebsitePublishPayload(post: PublishPostRecord): WebsitePublishPayload {
  const payload: WebsitePublishPayload = { adminPostId: post.id }
  const plannedNewsSlug =
    post.websiteNewsSlug ??
    (post.includeNewsPost ? slugify(post.title.trim()) || undefined : undefined)

  if (post.includeOpenGymFlyer && post.mediaType === 'image' && post.mediaUrl) {
    payload.openGymFlyerUrl = post.mediaUrl
  }

  if (post.includeNewsPost) {
    const summary =
      post.caption.trim().slice(0, 280) || post.title.trim().slice(0, 280)
    const newsGoLive = post.newsPublishAt ? new Date(post.newsPublishAt) : null
    const publishAt =
      newsGoLive && !Number.isNaN(newsGoLive.getTime()) ? newsGoLive : new Date()
    payload.news = {
      websiteNewsPostId: post.websiteNewsPostId,
      title: post.title.trim(),
      summary,
      body: post.caption.trim() || summary,
      published: true,
      publishedAt: publishAt.toISOString(),
      ...(post.mediaType === 'image' && post.mediaUrl
        ? { imageUrl: post.mediaUrl }
        : post.mediaType === 'video' && post.mediaUrl
          ? { imageUrl: null, body: `${post.caption.trim()}\n\nVideo: ${post.mediaUrl}`.trim() }
          : {}),
      ...(plannedNewsSlug ? { slug: plannedNewsSlug } : {}),
    }
  }

  if (post.includeSiteAlert) {
    const endsAt =
      post.siteAlertEndsAt ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const message = (post.caption.trim() || post.title.trim()).slice(0, 400)
    const linkUrl =
      plannedNewsSlug && post.includeNewsPost
        ? `/news/${plannedNewsSlug}`
        : post.kind === 'open_gym_flyer'
          ? '/open-gym'
          : '/news'
    payload.siteAlert = {
      websiteSiteAlertId: post.websiteSiteAlertId,
      enabled: true,
      kind: post.siteAlertKind ?? 'news',
      message,
      linkUrl,
      linkLabel: 'Details',
      startsAt: post.siteAlertStartsAt,
      endsAt,
    }
  }

  return payload
}

export type WebsitePublishResult = {
  openGymFlyerUrl: string | null
  newsPostId: string | null
  newsSlug: string | null
  siteAlertId: string | null
}

export function websitePublishEndpoint(): string {
  const configured = process.env.WEBSITE_PUBLISH_URL?.trim()
  if (configured) return configured
  const base = process.env.PUBLIC_WEBSITE_URL?.trim().replace(/\/$/, '')
  if (base) return `${base}/api/internal/publish`
  return 'https://www.bostondodgeballleague.com/api/internal/publish'
}

export async function callWebsitePublish(
  payload: WebsitePublishPayload
): Promise<WebsitePublishResult> {
  const secret = process.env.PUBLISH_API_SECRET?.trim()
  if (!secret) {
    throw new Error('PUBLISH_API_SECRET is not configured')
  }

  const res = await fetch(websitePublishEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  })

  const data = (await res.json().catch(() => ({}))) as WebsitePublishResult & {
    error?: string
  }
  if (!res.ok) {
    throw new Error(data.error || `Website publish failed (${res.status})`)
  }
  return data
}
