import { NextRequest, NextResponse } from 'next/server'
import { failYoutubeUpload } from '@/app/lib/video-tools/mutations'
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
      errorMessage?: string
    }
    if (!body.setId?.trim() || !body.claimToken?.trim()) {
      return NextResponse.json(
        { error: 'setId and claimToken are required' },
        { status: 400 }
      )
    }
    const set = await failYoutubeUpload({
      setId: body.setId,
      claimToken: body.claimToken,
      errorMessage: body.errorMessage?.trim() || 'YouTube upload failed',
    })
    return NextResponse.json({ set })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to record YouTube failure'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
