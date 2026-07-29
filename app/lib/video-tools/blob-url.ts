import { VIDEO_TOOLS_BLOB_PREFIX } from '@/app/lib/video-tools/naming'

const ALLOWED_BLOB_HOST_SUFFIXES = ['.blob.vercel-storage.com']

function isVercelBlobHost(hostname: string): boolean {
  return ALLOWED_BLOB_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
  )
}

function normalizeBlobPathname(pathname: string): string {
  return pathname.startsWith('/') ? pathname.slice(1) : pathname
}

/**
 * Ensure clip blobUrl is a Vercel Blob HTTPS URL whose path matches the
 * trusted pathname for this set (prevents SSRF via the merge worker fetch).
 */
export function assertSafeVideoClipBlobUrl(
  blobUrl: string,
  pathname: string
): string {
  let parsed: URL
  try {
    parsed = new URL(blobUrl)
  } catch {
    throw new Error('blobUrl is not a valid URL')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('blobUrl must be https')
  }
  if (!isVercelBlobHost(parsed.hostname)) {
    throw new Error('blobUrl must be a Vercel Blob storage URL')
  }

  const urlPath = normalizeBlobPathname(decodeURIComponent(parsed.pathname))
  const expectedPath = normalizeBlobPathname(pathname)
  if (urlPath !== expectedPath) {
    throw new Error('blobUrl pathname must match the clip pathname')
  }
  if (!expectedPath.startsWith(VIDEO_TOOLS_BLOB_PREFIX)) {
    throw new Error('pathname must be under video-tools/')
  }

  return blobUrl.trim()
}
