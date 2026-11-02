import { afterEach, describe, expect, it } from 'vitest'
import {
  isNotifyEmailConfigured,
  sendNotifyEmail,
} from '@/app/lib/notify-email'

describe('notify-email', () => {
  const originalKey = process.env.RESEND_API_KEY
  const originalFrom = process.env.NOTIFY_FROM_EMAIL

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
    if (originalFrom === undefined) delete process.env.NOTIFY_FROM_EMAIL
    else process.env.NOTIFY_FROM_EMAIL = originalFrom
  })

  it('reports not configured when env is missing', () => {
    delete process.env.RESEND_API_KEY
    delete process.env.NOTIFY_FROM_EMAIL
    expect(isNotifyEmailConfigured()).toBe(false)
  })

  it('skips send when not configured', async () => {
    delete process.env.RESEND_API_KEY
    delete process.env.NOTIFY_FROM_EMAIL
    const result = await sendNotifyEmail({
      to: 'ops@example.com',
      subject: 'Test',
      text: 'Hello',
    })
    expect(result.sent).toBe(false)
    expect(result.skipped).toMatch(/not configured/)
  })
})
