import { describe, expect, it } from 'vitest'
import {
  assertSafeVideoClipBlobUrl,
  assertSafeVideoMergedBlobUrl,
} from '@/app/lib/video-tools/blob-url'

const setId = '11111111-1111-1111-1111-111111111111'

describe('assertSafeVideoClipBlobUrl', () => {
  const pathname = `video-tools/${setId}/clips/abc-GX010100.MP4`

  it('accepts matching Vercel Blob https URLs', () => {
    const url = `https://abc123.public.blob.vercel-storage.com/${pathname}`
    expect(assertSafeVideoClipBlobUrl(url, pathname, setId)).toBe(url)
  })

  it('rejects non-blob hosts (SSRF)', () => {
    expect(() =>
      assertSafeVideoClipBlobUrl(
        `https://169.254.169.254/${pathname}`,
        pathname,
        setId
      )
    ).toThrow(/Vercel Blob/)
  })

  it('rejects http', () => {
    expect(() =>
      assertSafeVideoClipBlobUrl(
        `http://abc123.public.blob.vercel-storage.com/${pathname}`,
        pathname,
        setId
      )
    ).toThrow(/https/)
  })

  it('rejects pathname mismatch', () => {
    expect(() =>
      assertSafeVideoClipBlobUrl(
        `https://abc123.public.blob.vercel-storage.com/${pathname}`,
        'video-tools/other/clips/x.MP4',
        setId
      )
    ).toThrow(/must match/)
  })

  it('rejects clips for a different set when setId is provided', () => {
    const otherPath =
      'video-tools/22222222-2222-2222-2222-222222222222/clips/abc-GX010100.MP4'
    const url = `https://abc123.public.blob.vercel-storage.com/${otherPath}`
    expect(() => assertSafeVideoClipBlobUrl(url, otherPath, setId)).toThrow(
      /must start with/
    )
  })
})

describe('assertSafeVideoMergedBlobUrl', () => {
  const outputFilename = 'Summer_Remix_2026-07-12_Court_1_untrimmed.MP4'
  const pathname = `video-tools/${setId}/merged/${outputFilename}`

  it('accepts matching merged Blob URLs', () => {
    const url = `https://abc123.public.blob.vercel-storage.com/${pathname}`
    expect(
      assertSafeVideoMergedBlobUrl({
        blobUrl: url,
        pathname,
        setId,
        outputFilename,
      })
    ).toBe(url)
  })

  it('rejects non-blob hosts', () => {
    expect(() =>
      assertSafeVideoMergedBlobUrl({
        blobUrl: `https://evil.example/${pathname}`,
        pathname,
        setId,
        outputFilename,
      })
    ).toThrow(/Vercel Blob/)
  })

  it('rejects wrong output filename path', () => {
    const wrong = `video-tools/${setId}/merged/other_untrimmed.MP4`
    expect(() =>
      assertSafeVideoMergedBlobUrl({
        blobUrl: `https://abc123.public.blob.vercel-storage.com/${wrong}`,
        pathname: wrong,
        setId,
        outputFilename,
      })
    ).toThrow(/output filename/)
  })
})
