import { NextRequest, NextResponse } from 'next/server'
import { completeVideoUploadSet } from '@/app/lib/video-tools/mutations'
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
      mergedBlobUrl?: string
      mergedBlobPathname?: string
      outputFilename?: string
    }

    if (!body.setId?.trim()) {
      return NextResponse.json({ error: 'setId is required' }, { status: 400 })
    }
    if (!body.mergedBlobUrl?.trim()) {
      return NextResponse.json({ error: 'mergedBlobUrl is required' }, { status: 400 })
    }
    if (!body.mergedBlobPathname?.trim()) {
      return NextResponse.json(
        { error: 'mergedBlobPathname is required' },
        { status: 400 }
      )
    }

    const set = await completeVideoUploadSet({
      setId: body.setId,
      mergedBlobUrl: body.mergedBlobUrl,
      mergedBlobPathname: body.mergedBlobPathname,
      outputFilename: body.outputFilename,
    })

    return NextResponse.json({ set })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete job'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
