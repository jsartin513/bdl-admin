import { desc, eq } from 'drizzle-orm'
import { publishPosts } from '@/app/db/schema'
import { getDb } from '@/app/lib/db'
import { mapPublishPost } from '@/app/lib/publish/map'
import {
  buildWebsitePublishPayload,
  callWebsitePublish,
} from '@/app/lib/publish/website-client'
import type {
  PublishKind,
  PublishMediaType,
  PublishPostRecord,
} from '@/app/lib/publish/types'

export type PublishPostWrite = {
  kind: PublishKind
  title: string
  caption: string
  mediaUrl: string | null
  mediaType: PublishMediaType | null
  includeOpenGymFlyer: boolean
  includeSiteAlert: boolean
  siteAlertKind: 'news' | 'cancellation' | null
  siteAlertStartsAt: Date | null
  siteAlertEndsAt: Date | null
  newsPublishAt: Date | null
  includeNewsPost: boolean
}

function defaultTargetsForKind(kind: PublishKind): Pick<
  PublishPostWrite,
  'includeOpenGymFlyer' | 'includeSiteAlert' | 'includeNewsPost' | 'siteAlertKind'
> {
  if (kind === 'open_gym_flyer') {
    return {
      includeOpenGymFlyer: true,
      includeSiteAlert: false,
      includeNewsPost: false,
      siteAlertKind: null,
    }
  }
  if (kind === 'announcement') {
    return {
      includeOpenGymFlyer: false,
      includeSiteAlert: true,
      includeNewsPost: true,
      siteAlertKind: 'news',
    }
  }
  return {
    includeOpenGymFlyer: false,
    includeSiteAlert: false,
    includeNewsPost: true,
    siteAlertKind: null,
  }
}

export async function listPublishPosts(limit = 30): Promise<PublishPostRecord[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(publishPosts)
    .orderBy(desc(publishPosts.createdAt))
    .limit(limit)
  return rows.map(mapPublishPost)
}

export async function getPublishPost(id: string): Promise<PublishPostRecord | null> {
  const db = getDb()
  const rows = await db.select().from(publishPosts).where(eq(publishPosts.id, id)).limit(1)
  return rows[0] ? mapPublishPost(rows[0]) : null
}

export async function createPublishPost(
  input: Partial<PublishPostWrite> & { kind: PublishKind; title: string }
): Promise<PublishPostRecord> {
  const defaults = defaultTargetsForKind(input.kind)
  const db = getDb()
  const [row] = await db
    .insert(publishPosts)
    .values({
      kind: input.kind,
      title: input.title.trim(),
      caption: input.caption?.trim() ?? '',
      mediaUrl: input.mediaUrl ?? null,
      mediaType: input.mediaType ?? null,
      includeOpenGymFlyer: input.includeOpenGymFlyer ?? defaults.includeOpenGymFlyer,
      includeSiteAlert: input.includeSiteAlert ?? defaults.includeSiteAlert,
      siteAlertKind: input.siteAlertKind ?? defaults.siteAlertKind,
      siteAlertStartsAt: input.siteAlertStartsAt ?? null,
      siteAlertEndsAt: input.siteAlertEndsAt ?? null,
      newsPublishAt: input.newsPublishAt ?? null,
      includeNewsPost: input.includeNewsPost ?? defaults.includeNewsPost,
      status: 'draft',
      updatedAt: new Date(),
    })
    .returning()
  return mapPublishPost(row)
}

export async function updatePublishPost(
  id: string,
  input: Partial<PublishPostWrite> & {
    postedToInstagram?: boolean
    postedToYoutube?: boolean
  }
): Promise<PublishPostRecord | null> {
  const existing = await getPublishPost(id)
  if (!existing) return null

  if (existing.status === 'scheduled') {
    throw new Error('Cancel the scheduled publish before editing')
  }

  if (existing.status === 'published') {
    const onlySocial =
      input.postedToInstagram !== undefined || input.postedToYoutube !== undefined
    const otherKeys = (
      [
        'kind',
        'title',
        'caption',
        'mediaUrl',
        'mediaType',
        'includeOpenGymFlyer',
        'includeSiteAlert',
        'siteAlertKind',
        'siteAlertStartsAt',
        'siteAlertEndsAt',
        'newsPublishAt',
        'includeNewsPost',
      ] as const
    ).some((key) => input[key] !== undefined)
    if (otherKeys || !onlySocial) {
      throw new Error('Published posts can only update Instagram and YouTube checkboxes')
    }
  }

  const db = getDb()
  const [row] = await db
    .update(publishPosts)
    .set({
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.caption !== undefined ? { caption: input.caption.trim() } : {}),
      ...(input.mediaUrl !== undefined ? { mediaUrl: input.mediaUrl } : {}),
      ...(input.mediaType !== undefined ? { mediaType: input.mediaType } : {}),
      ...(input.includeOpenGymFlyer !== undefined
        ? { includeOpenGymFlyer: input.includeOpenGymFlyer }
        : {}),
      ...(input.includeSiteAlert !== undefined
        ? { includeSiteAlert: input.includeSiteAlert }
        : {}),
      ...(input.siteAlertKind !== undefined ? { siteAlertKind: input.siteAlertKind } : {}),
      ...(input.siteAlertStartsAt !== undefined
        ? { siteAlertStartsAt: input.siteAlertStartsAt }
        : {}),
      ...(input.siteAlertEndsAt !== undefined
        ? { siteAlertEndsAt: input.siteAlertEndsAt }
        : {}),
      ...(input.newsPublishAt !== undefined ? { newsPublishAt: input.newsPublishAt } : {}),
      ...(input.includeNewsPost !== undefined
        ? { includeNewsPost: input.includeNewsPost }
        : {}),
      ...(input.postedToInstagram !== undefined
        ? { postedToInstagram: input.postedToInstagram }
        : {}),
      ...(input.postedToYoutube !== undefined
        ? { postedToYoutube: input.postedToYoutube }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(publishPosts.id, id))
    .returning()
  return row ? mapPublishPost(row) : null
}

export async function approvePublishPost(
  id: string,
  approvedBy: string
): Promise<PublishPostRecord> {
  const post = await getPublishPost(id)
  if (!post) throw new Error('Post not found')
  if (post.status === 'published') return post
  if (post.status !== 'draft' && post.status !== 'scheduled') {
    throw new Error('Post cannot be published')
  }

  const payload = buildWebsitePublishPayload(post)
  if (
    payload.openGymFlyerUrl === undefined &&
    !payload.news &&
    !payload.siteAlert
  ) {
    throw new Error('Select at least one website target to publish')
  }

  try {
    const result = await callWebsitePublish(payload)
    const db = getDb()
    const [row] = await db
      .update(publishPosts)
      .set({
        status: 'published',
        websiteNewsPostId: result.newsPostId,
        websiteSiteAlertId: result.siteAlertId,
        websiteNewsSlug: result.newsSlug ?? post.websiteNewsSlug,
        publishError: null,
        approvedBy,
        approvedAt: new Date(),
        scheduledActionId: null,
        updatedAt: new Date(),
      })
      .where(eq(publishPosts.id, id))
      .returning()
    if (!row) throw new Error('Post not found')
    return mapPublishPost(row)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed'
    const db = getDb()
    await db
      .update(publishPosts)
      .set({ publishError: message, updatedAt: new Date() })
      .where(eq(publishPosts.id, id))
    throw new Error(message)
  }
}
