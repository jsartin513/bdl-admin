import { NextRequest, NextResponse } from 'next/server'
import { completeYoutubeUpload } from '@/app/lib/video-tools/mutations'
import {
  verifyVideoWorkerRequest,
  workerUnauthorizedResponse,
} from '@/app/lib/video-tools/worker-auth'

export async function POST(request: NextRequest) {
  if (!verifyVideoWorkerRequest(request)) {
    return workerUnauthorizedResponse()
  }

  try {
    const body = (await request.json()) as {
      setId?: string
      claimToken?: string
      youtubeVideoId?: string
    }
    if (!body.setId?.trim() || !body.claimToken?.trim() || !body.youtubeVideoId?.trim()) {
      return NextResponse.json(
        { error: 'setId, claimToken, and youtubeVideoId are required' },
        { status: 400 }
      )
    }
    const set = await completeYoutubeUpload({
      setId: body.setId,
      claimToken: body.claimToken,
      youtubeVideoId: body.youtubeVideoId,
    })
    return NextResponse.json({ set })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to complete YouTube upload'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
