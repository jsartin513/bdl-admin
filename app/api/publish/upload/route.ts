import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'

const MAX_BYTES = 100 * 1024 * 1024

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be 100MB or smaller' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const pathname = `publish/${Date.now()}-${safeName}`
  const blob = await put(pathname, file, { access: 'public' })
  const mediaType = file.type.startsWith('video/') ? 'video' : 'image'
  return NextResponse.json({ url: blob.url, mediaType })
}
