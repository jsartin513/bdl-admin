import { describe, expect, it } from 'vitest'
import { orderClipsForMerge } from '@/app/lib/video-tools/gopro-order'
import {
  buildUntrimmedOutputFilename,
  displayTitle,
} from '@/app/lib/video-tools/naming'

/**
 * Smoke-style checks for concurrent Court 1 / Court 2 upload sets:
 * independent titles, distinct merge outputs, shared GoPro ordering rules.
 */
describe('concurrent court upload sets (smoke)', () => {
  const eventName = 'BDL Season 7: Summer Remix'
  const eventDate = '2026-07-12'

  it('builds distinct titles and filenames for Court 1 and Court 2', () => {
    const court1 = {
      eventName,
      eventDate,
      label: 'Court 1',
    }
    const court2 = {
      eventName,
      eventDate,
      label: 'Court 2',
    }

    expect(displayTitle(court1.eventName, court1.label)).toBe(
      'BDL Season 7: Summer Remix · Court 1'
    )
    expect(displayTitle(court2.eventName, court2.label)).toBe(
      'BDL Season 7: Summer Remix · Court 2'
    )

    const out1 = buildUntrimmedOutputFilename(court1)
    const out2 = buildUntrimmedOutputFilename(court2)
    expect(out1).toBe(
      'BDL_Season_7_Summer_Remix_2026-07-12_Court_1_untrimmed.MP4'
    )
    expect(out2).toBe(
      'BDL_Season_7_Summer_Remix_2026-07-12_Court_2_untrimmed.MP4'
    )
    expect(out1).not.toBe(out2)
  })

  it('orders each court set independently', () => {
    const court1Clips = [
      { originalFilename: 'GX020100.MP4', set: 'court1' },
      { originalFilename: 'GX010100.MP4', set: 'court1' },
    ]
    const court2Clips = [
      { originalFilename: 'GX010200.MP4', set: 'court2' },
      { originalFilename: 'GOPR0200.MP4', set: 'court2' },
    ]

    const ordered1 = orderClipsForMerge(court1Clips).map((c) => c.originalFilename)
    const ordered2 = orderClipsForMerge(court2Clips).map((c) => c.originalFilename)

    expect(ordered1).toEqual(['GX010100.MP4', 'GX020100.MP4'])
    expect(ordered2).toEqual(['GOPR0200.MP4', 'GX010200.MP4'])
  })
})
