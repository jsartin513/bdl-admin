import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { videoUploadSets } from '@/app/db/schema'
import { getYoutubeAccessToken } from '@/app/lib/youtube/client'
import {
  verifyVideoWorkerRequest,
  workerUnauthorizedResponse,
} from '@/app/lib/video-tools/worker-auth'

/**
 * Mint a fresh YouTube access token for an in-progress upload claim
 * (long uploads that outlive the original token TTL).
 */
export async function POST(request: NextRequest) {
  if (!verifyVideoWorkerRequest(request)) {
    return workerUnauthorizedResponse()
  }

  try {
    const body = (await request.json()) as {
      setId?: string
      claimToken?: string
    }
    if (!body.setId?.trim() || !body.claimToken?.trim()) {
      return NextResponse.json(
        { error: 'setId and claimToken are required' },
        { status: 400 }
      )
    }

    const db = getDb()
    const [row] = await db
      .select({
        id: videoUploadSets.id,
        youtubeUploadStatus: videoUploadSets.youtubeUploadStatus,
        youtubeClaimToken: videoUploadSets.youtubeClaimToken,
      })
      .from(videoUploadSets)
      .where(
        and(
          eq(videoUploadSets.id, body.setId),
          eq(videoUploadSets.youtubeUploadStatus, 'uploading'),
          eq(videoUploadSets.youtubeClaimToken, body.claimToken)
        )
      )
      .limit(1)

    if (!row) {
      return NextResponse.json(
        { error: 'No matching in-progress YouTube upload' },
        { status: 404 }
      )
    }

    const accessToken = await getYoutubeAccessToken()
    return NextResponse.json({ accessToken })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to refresh YouTube token'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
