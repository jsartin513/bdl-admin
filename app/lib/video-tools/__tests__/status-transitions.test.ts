import { describe, expect, it } from 'vitest'
import {
  CLIP_LOCKED_STATUSES,
  ENQUEUE_ALLOWED_STATUSES,
  READY_ALLOWED_STATUSES,
} from '@/app/lib/video-tools/mutations'
import { VIDEO_SET_STATUSES } from '@/app/lib/video-tools/types'

describe('video tools status transition policy', () => {
  it('blocks mark_ready once merge is queued or running', () => {
    expect([...READY_ALLOWED_STATUSES]).toEqual([
      'draft',
      'uploading',
      'ready',
      'failed',
    ])
    for (const status of ['queued', 'processing', 'complete'] as const) {
      expect(READY_ALLOWED_STATUSES).not.toContain(status)
    }
  })

  it('locks new clips only after claim or completion (queued still allowed)', () => {
    expect([...CLIP_LOCKED_STATUSES]).toEqual(['processing', 'complete'])
    expect(CLIP_LOCKED_STATUSES).not.toContain('queued')
  })

  it('allows re-enqueue from processing for stuck-worker recovery', () => {
    expect(ENQUEUE_ALLOWED_STATUSES).toContain('processing')
    expect(ENQUEUE_ALLOWED_STATUSES).toContain('failed')
    expect(ENQUEUE_ALLOWED_STATUSES).toContain('ready')
    for (const status of ['draft', 'uploading', 'queued', 'complete'] as const) {
      expect(ENQUEUE_ALLOWED_STATUSES).not.toContain(status)
    }
  })

  it('requires ready before enqueue (no merge while still uploading)', () => {
    expect(ENQUEUE_ALLOWED_STATUSES).not.toContain('uploading')
    expect(ENQUEUE_ALLOWED_STATUSES).not.toContain('draft')
    expect(READY_ALLOWED_STATUSES).toContain('uploading')
  })

  it('documents claim-token invalidation on retry', () => {
    // enqueue clears claimToken; complete/fail require matching token + processing.
    expect(ENQUEUE_ALLOWED_STATUSES).toContain('processing')
  })

  it('covers every set status in at least one transition list', () => {
    const covered = new Set<string>([
      ...READY_ALLOWED_STATUSES,
      ...CLIP_LOCKED_STATUSES,
      ...ENQUEUE_ALLOWED_STATUSES,
      'queued', // claim target
      'complete', // completeVideoUploadSet terminal
    ])
    for (const status of VIDEO_SET_STATUSES) {
      expect(covered.has(status)).toBe(true)
    }
  })
})
