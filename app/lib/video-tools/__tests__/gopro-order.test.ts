import { describe, expect, it } from 'vitest'
import {
  extractGoProSessionId,
  orderClipsForMerge,
} from '@/app/lib/video-tools/gopro-order'
import {
  buildUntrimmedOutputFilename,
  displayTitle,
  slugifyForFilename,
} from '@/app/lib/video-tools/naming'

describe('slugifyForFilename', () => {
  it('replaces spaces and strips unsafe characters', () => {
    expect(slugifyForFilename('BDL Season 7: Summer Remix')).toBe(
      'BDL_Season_7_Summer_Remix'
    )
  })
})

describe('buildUntrimmedOutputFilename', () => {
  it('follows Event_date_Label_untrimmed.MP4', () => {
    expect(
      buildUntrimmedOutputFilename({
        eventName: 'SheThey League',
        eventDate: '2026-03-29',
        label: 'Court 1',
      })
    ).toBe('SheThey_League_2026-03-29_Court_1_untrimmed.MP4')
  })
})

describe('displayTitle', () => {
  it('joins event and label', () => {
    expect(displayTitle('Summer Remix', 'Court 2')).toBe('Summer Remix · Court 2')
  })
})

describe('orderClipsForMerge', () => {
  it('orders GoPro chapters by session then GOPR/GP/GX', () => {
    const clips = [
      { originalFilename: 'GX020010.MP4' },
      { originalFilename: 'GX010010.MP4' },
      { originalFilename: 'GOPR0010.MP4' },
      { originalFilename: 'GX010020.MP4' },
      { originalFilename: 'random_clip.mp4' },
    ]
    const ordered = orderClipsForMerge(clips).map((c) => c.originalFilename)
    expect(ordered).toEqual([
      'GOPR0010.MP4',
      'GX010010.MP4',
      'GX020010.MP4',
      'GX010020.MP4',
      'random_clip.mp4',
    ])
  })

  it('orders GoPro chapters for .mov the same as .mp4', () => {
    const clips = [
      { originalFilename: 'GX020010.MOV' },
      { originalFilename: 'GX010010.mov' },
      { originalFilename: 'GOPR0010.MOV' },
      { originalFilename: 'random_clip.mov' },
    ]
    const ordered = orderClipsForMerge(clips).map((c) => c.originalFilename)
    expect(ordered).toEqual([
      'GOPR0010.MOV',
      'GX010010.mov',
      'GX020010.MOV',
      'random_clip.mov',
    ])
  })

  it('extracts session ids', () => {
    expect(extractGoProSessionId('GX010554.MP4')).toBe('0554')
    expect(extractGoProSessionId('GOPR0554.MP4')).toBe('0554')
    expect(extractGoProSessionId('GX010554.MOV')).toBe('0554')
    expect(extractGoProSessionId('other.mp4')).toBeNull()
  })
})
