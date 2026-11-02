import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'

const PUBLISH_PREFIX = 'publish/'
const MAX_BYTES = 100 * 1024 * 1024

/**
 * Client-direct Blob upload (same pattern as Video Tools). Avoids the 4.5MB
 * serverless request body limit for flyers and short clips.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = getAdminSessionFromRequest(request)
        if (!session) throw new Error('Unauthorized')
        if (!pathname.startsWith(PUBLISH_PREFIX)) {
          throw new Error('Invalid upload pathname')
        }
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'video/mp4',
            'video/quicktime',
            'application/octet-stream',
          ],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
        }
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    if (message === 'Unauthorized') return adminUnauthorizedResponse()
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
