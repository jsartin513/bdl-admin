import type { publishPosts } from '@/app/db/schema'
import type {
  PublishKind,
  PublishMediaType,
  PublishPostRecord,
  PublishStatus,
} from '@/app/lib/publish/types'

export function mapPublishPost(
  row: typeof publishPosts.$inferSelect
): PublishPostRecord {
  return {
    id: row.id,
    kind: row.kind as PublishKind,
    title: row.title,
    caption: row.caption,
    mediaUrl: row.mediaUrl,
    mediaType: (row.mediaType as PublishMediaType | null) ?? null,
    includeOpenGymFlyer: row.includeOpenGymFlyer,
    includeSiteAlert: row.includeSiteAlert,
    siteAlertKind:
      row.siteAlertKind === 'news' || row.siteAlertKind === 'cancellation'
        ? row.siteAlertKind
        : null,
    siteAlertEndsAt: row.siteAlertEndsAt?.toISOString() ?? null,
    includeNewsPost: row.includeNewsPost,
    status: row.status as PublishStatus,
    websiteNewsPostId: row.websiteNewsPostId,
    websiteSiteAlertId: row.websiteSiteAlertId,
    websiteNewsSlug: row.websiteNewsSlug,
    postedToInstagram: row.postedToInstagram,
    postedToYoutube: row.postedToYoutube,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    publishError: row.publishError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
