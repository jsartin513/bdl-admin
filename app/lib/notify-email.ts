/**
 * Optional outbound email for admin job completion.
 * Sends only when RESEND_API_KEY and NOTIFY_FROM_EMAIL are set.
 * Uses Resend's HTTP API (no SDK dependency).
 */

export type NotifyEmailInput = {
  to: string
  subject: string
  text: string
}

export function isNotifyEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.NOTIFY_FROM_EMAIL?.trim()
  )
}

export async function sendNotifyEmail(
  input: NotifyEmailInput
): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.NOTIFY_FROM_EMAIL?.trim()
  const to = input.to.trim().toLowerCase()

  if (!apiKey || !from) {
    return { sent: false, skipped: 'email not configured' }
  }
  if (!to) {
    return { sent: false, skipped: 'missing recipient' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        text: input.text,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(
        '[notify-email] Resend error',
        res.status,
        body.slice(0, 500)
      )
      return {
        sent: false,
        error: `Resend returned ${res.status}`,
      }
    }

    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send failed'
    console.error('[notify-email]', message)
    return { sent: false, error: message }
  }
}
