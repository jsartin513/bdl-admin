import { NextRequest, NextResponse } from 'next/server'
import {
  claimNextYoutubeUpload,
} from '@/app/lib/video-tools/mutations'
import {
  verifyVideoWorkerRequest,
  workerUnauthorizedResponse,
} from '@/app/lib/video-tools/worker-auth'

export async function POST(request: NextRequest) {
  if (!verifyVideoWorkerRequest(request)) {
    return workerUnauthorizedResponse()
  }

  try {
    const job = await claimNextYoutubeUpload()
    return NextResponse.json({ job })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to claim YouTube upload'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
