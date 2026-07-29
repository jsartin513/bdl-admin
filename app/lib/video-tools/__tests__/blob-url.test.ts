import { describe, expect, it } from 'vitest'
import { assertSafeVideoClipBlobUrl } from '@/app/lib/video-tools/blob-url'

describe('assertSafeVideoClipBlobUrl', () => {
  const pathname =
    'video-tools/11111111-1111-1111-1111-111111111111/clips/abc-GX010100.MP4'

  it('accepts matching Vercel Blob https URLs', () => {
    const url = `https://abc123.public.blob.vercel-storage.com/${pathname}`
    expect(assertSafeVideoClipBlobUrl(url, pathname)).toBe(url)
  })

  it('rejects non-blob hosts (SSRF)', () => {
    expect(() =>
      assertSafeVideoClipBlobUrl(
        `https://169.254.169.254/${pathname}`,
        pathname
      )
    ).toThrow(/Vercel Blob/)
  })

  it('rejects http', () => {
    expect(() =>
      assertSafeVideoClipBlobUrl(
        `http://abc123.public.blob.vercel-storage.com/${pathname}`,
        pathname
      )
    ).toThrow(/https/)
  })

  it('rejects pathname mismatch', () => {
    expect(() =>
      assertSafeVideoClipBlobUrl(
        `https://abc123.public.blob.vercel-storage.com/${pathname}`,
        'video-tools/other/clips/x.MP4'
      )
    ).toThrow(/must match/)
  })
})
