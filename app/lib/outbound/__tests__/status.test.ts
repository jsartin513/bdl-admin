import { describe, expect, it } from 'vitest'
import {
  mapContactRecipientToOutbound,
  mapTwilioStatusToOutbound,
} from '@/app/lib/outbound/status'
import { parseOutboxLimit } from '@/app/lib/outbound/queries'

describe('outbound status mapping', () => {
  it('maps Twilio undelivered to failed', () => {
    expect(mapTwilioStatusToOutbound('undelivered')).toBe('failed')
    expect(mapTwilioStatusToOutbound('failed')).toBe('failed')
  })

  it('maps Twilio delivered and sent', () => {
    expect(mapTwilioStatusToOutbound('delivered')).toBe('delivered')
    expect(mapTwilioStatusToOutbound('sent')).toBe('sent')
    expect(mapTwilioStatusToOutbound('queued')).toBe('sent')
  })

  it('ignores unknown Twilio statuses', () => {
    expect(mapTwilioStatusToOutbound('accepted')).toBeNull()
  })

  it('maps contact recipient statuses', () => {
    expect(mapContactRecipientToOutbound('delivered')).toBe('delivered')
    expect(mapContactRecipientToOutbound('failed')).toBe('failed')
    expect(mapContactRecipientToOutbound('skipped')).toBe('skipped')
    expect(mapContactRecipientToOutbound('pending')).toBe('skipped')
  })
})

describe('parseOutboxLimit', () => {
  it('defaults and caps limit', () => {
    expect(parseOutboxLimit(null)).toBe(50)
    expect(parseOutboxLimit('200')).toBe(100)
    expect(parseOutboxLimit('10')).toBe(10)
  })
})
