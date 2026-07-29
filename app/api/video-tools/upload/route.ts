import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { beginPendingClipUpload, cancelPendingClipUpload, recordUploadedClip } from '@/app/lib/video-tools/mutations'
import { getVideoUploadSet } from '@/app/lib/video-tools/queries'
import { VIDEO_TOOLS_BLOB_PREFIX } from '@/app/lib/video-tools/naming'

/**
 * Client upload token exchange + completion webhook for video clips.
 * Auth is enforced in onBeforeGenerateToken (admin session).
 * Middleware allows this path so Vercel Blob completion callbacks can land.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = getAdminSessionFromRequest(request)
        if (!session) {
          throw new Error('Unauthorized')
        }

        let setId: string | null = null
        let originalFilename: string | null = null
        try {
          const payload = clientPayload
            ? (JSON.parse(clientPayload) as {
                setId?: string
                originalFilename?: string
              })
            : {}
          setId = payload.setId?.trim() || null
          originalFilename = payload.originalFilename?.trim() || null
        } catch {
          throw new Error('Invalid client payload')
        }

        if (!setId) throw new Error('setId is required')
        if (!originalFilename) throw new Error('originalFilename is required')

        const set = await getVideoUploadSet(setId)
        if (!set) throw new Error('Upload set not found')
        // New tokens while collecting clips (including demoting ready → uploading).
        if (!['draft', 'uploading', 'failed', 'ready'].includes(set.status)) {
          throw new Error(`Cannot upload clips while set is ${set.status}`)
        }

        const expectedPrefix = `${VIDEO_TOOLS_BLOB_PREFIX}${setId}/clips/`
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error('Invalid upload pathname')
        }

        await beginPendingClipUpload(setId)

        return {
          allowedContentTypes: [
            'video/mp4',
            'video/quicktime',
            'application/octet-stream',
          ],
          maximumSizeInBytes: 20 * 1024 * 1024 * 1024, // 20 GB per clip
          tokenPayload: JSON.stringify({
            setId,
            originalFilename,
            actor: session.email,
          }),
          addRandomSuffix: false,
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = tokenPayload
          ? (JSON.parse(tokenPayload) as {
              setId?: string
              originalFilename?: string
            })
          : {}
        if (!payload.setId || !payload.originalFilename) {
          throw new Error('Missing token payload for clip record')
        }

        try {
          await recordUploadedClip({
            setId: payload.setId,
            originalFilename: payload.originalFilename,
            blobUrl: blob.url,
            pathname: blob.pathname,
            sizeBytes: 0,
          })
        } catch (err) {
          // Token mint already incremented pending; release if registration failed
          // before the insert path could decrement.
          await cancelPendingClipUpload(payload.setId).catch(() => {})
          throw err
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    if (message === 'Unauthorized') {
      return adminUnauthorizedResponse()
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
