import type { PublishPostRecord, SocialKit } from '@/app/lib/publish/types'

export function publicWebsiteBaseUrl(): string {
  const fromEnv = process.env.PUBLIC_WEBSITE_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  return 'https://www.bostondodgeballleague.com'
}

export function publishPageUrl(post: Pick<PublishPostRecord, 'kind' | 'websiteNewsSlug'>): string {
  const base = publicWebsiteBaseUrl()
  if (post.kind === 'open_gym_flyer') return `${base}/open-gym`
  if (post.websiteNewsSlug) return `${base}/news/${post.websiteNewsSlug}`
  return base
}

export function buildSocialKit(post: PublishPostRecord): SocialKit {
  const publicPageUrl = publishPageUrl(post)
  const lines = [post.title.trim(), post.caption.trim(), publicPageUrl].filter(Boolean)
  const instagramCaption = lines.join('\n\n')

  const isVideo = post.mediaType === 'video'
  const youtubeTitle = isVideo ? post.title.trim().slice(0, 100) : null
  const youtubeDescription = isVideo
    ? [post.caption.trim(), publicPageUrl, '#Shorts'].filter(Boolean).join('\n\n')
    : null

  const cropNotes =
    post.mediaType === 'video'
      ? 'Reels and Shorts: vertical 9:16, about 60 seconds or less. Video Tools full merges are too long for Shorts.'
      : 'Instagram feed: 4:5 portrait works well. Reels cover: 9:16.'

  return {
    instagramCaption,
    youtubeTitle,
    youtubeDescription,
    publicPageUrl,
    cropNotes,
  }
}
