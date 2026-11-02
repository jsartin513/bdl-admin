import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { youtubeChannelConnection } from '@/app/db/schema'
import { decryptSecret, encryptSecret } from '@/app/lib/youtube/crypto'
import type { YoutubeChannelConnectionPublic } from '@/app/lib/youtube/types'

export type YoutubeConnectionRow = {
  id: string
  channelId: string
  channelTitle: string
  refreshToken: string
  connectedByEmail: string
  createdAt: Date
  updatedAt: Date
}

function mapPublic(
  row: typeof youtubeChannelConnection.$inferSelect
): YoutubeChannelConnectionPublic {
  return {
    channelId: row.channelId,
    channelTitle: row.channelTitle,
    connectedByEmail: row.connectedByEmail,
    updatedAt: row.updatedAt,
  }
}

export async function getYoutubeConnectionPublic(): Promise<YoutubeChannelConnectionPublic | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(youtubeChannelConnection)
    .orderBy(desc(youtubeChannelConnection.updatedAt))
    .limit(1)
  return row ? mapPublic(row) : null
}

export async function getYoutubeConnectionWithToken(): Promise<YoutubeConnectionRow | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(youtubeChannelConnection)
    .orderBy(desc(youtubeChannelConnection.updatedAt))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    channelId: row.channelId,
    channelTitle: row.channelTitle,
    refreshToken: decryptSecret(row.refreshTokenEnc),
    connectedByEmail: row.connectedByEmail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Upsert: keep a single active connection (delete others, insert/replace latest). */
export async function saveYoutubeConnection(input: {
  channelId: string
  channelTitle: string
  refreshToken: string
  connectedByEmail: string
}): Promise<YoutubeChannelConnectionPublic> {
  const channelId = input.channelId.trim()
  const channelTitle = input.channelTitle.trim() || channelId
  const connectedByEmail = input.connectedByEmail.trim().toLowerCase()
  if (!channelId) throw new Error('channelId is required')
  if (!input.refreshToken.trim()) throw new Error('refreshToken is required')
  if (!connectedByEmail) throw new Error('connectedByEmail is required')

  const db = getDb()
  await db.delete(youtubeChannelConnection)

  const [created] = await db
    .insert(youtubeChannelConnection)
    .values({
      channelId,
      channelTitle,
      refreshTokenEnc: encryptSecret(input.refreshToken.trim()),
      connectedByEmail,
      updatedAt: new Date(),
    })
    .returning()

  return mapPublic(created)
}

export async function deleteYoutubeConnection(): Promise<void> {
  const db = getDb()
  await db.delete(youtubeChannelConnection)
}

export async function updateYoutubeConnectionRefreshToken(
  id: string,
  refreshToken: string
): Promise<void> {
  const db = getDb()
  await db
    .update(youtubeChannelConnection)
    .set({
      refreshTokenEnc: encryptSecret(refreshToken.trim()),
      updatedAt: new Date(),
    })
    .where(eq(youtubeChannelConnection.id, id))
}
