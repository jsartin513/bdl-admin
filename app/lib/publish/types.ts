export const PUBLISH_KINDS = ['open_gym_flyer', 'announcement', 'short_video'] as const
export type PublishKind = (typeof PUBLISH_KINDS)[number]

export const PUBLISH_STATUSES = ['draft', 'published'] as const
export type PublishStatus = (typeof PUBLISH_STATUSES)[number]

export const PUBLISH_MEDIA_TYPES = ['image', 'video'] as const
export type PublishMediaType = (typeof PUBLISH_MEDIA_TYPES)[number]

export type PublishPostRecord = {
  id: string
  kind: PublishKind
  title: string
  caption: string
  mediaUrl: string | null
  mediaType: PublishMediaType | null
  includeOpenGymFlyer: boolean
  includeSiteAlert: boolean
  siteAlertKind: 'news' | 'cancellation' | null
  siteAlertEndsAt: string | null
  includeNewsPost: boolean
  status: PublishStatus
  websiteNewsPostId: string | null
  websiteSiteAlertId: string | null
  websiteNewsSlug: string | null
  postedToInstagram: boolean
  postedToYoutube: boolean
  approvedBy: string | null
  approvedAt: string | null
  publishError: string | null
  createdAt: string
  updatedAt: string
}

export type SocialKit = {
  instagramCaption: string
  youtubeTitle: string | null
  youtubeDescription: string | null
  publicPageUrl: string
  cropNotes: string
}
