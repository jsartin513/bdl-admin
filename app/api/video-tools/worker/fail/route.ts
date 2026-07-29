import { NextRequest, NextResponse } from 'next/server'
import { failVideoUploadSet } from '@/app/lib/video-tools/mutations'
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

    if (!body.setId?.trim()) {
      return NextResponse.json({ error: 'setId is required' }, { status: 400 })
    }
    if (!body.claimToken?.trim()) {
      return NextResponse.json({ error: 'claimToken is required' }, { status: 400 })
    }
    if (!body.errorMessage?.trim()) {
      return NextResponse.json({ error: 'errorMessage is required' }, { status: 400 })
    }

    const set = await failVideoUploadSet({
      setId: body.setId,
      claimToken: body.claimToken,
      errorMessage: body.errorMessage,
    })

    return NextResponse.json({ set })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fail job'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
