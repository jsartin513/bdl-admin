import { isWatchedAdminLoginEmail } from '@bdl/admin-auth'
import { recordOutboundMessage } from '@/app/lib/outbound/log'

const DEFAULT_LOGIN_ALERT_TO = 'jdoherty513@gmail.com'

function adminLoginAlertFrom(): string | null {
  const from =
    process.env.ADMIN_LOGIN_ALERT_FROM?.trim() ||
    process.env.NOTIFY_FROM_EMAIL?.trim() ||
    process.env.ORDER_RECEIPT_FROM?.trim() ||
    process.env.CONTACT_EMAIL_FROM?.trim()
  return from || null
}

/** Log + email (Resend) when a watched address hits Google admin login. */
export async function alertWatchedAdminLoginAttempt(
  email: string,
  details: { app: string; allowed: boolean }
): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!isWatchedAdminLoginEmail(normalized)) return

  const to = process.env.ADMIN_LOGIN_ALERT_TO?.trim() || DEFAULT_LOGIN_ALERT_TO
  const host = process.env.NEXT_PUBLIC_APP_URL?.trim() || details.app
  const subject = `[BDL Admin] Login attempt by ${normalized}`
  const text = [
    'Watched admin login attempt',
    `Email: ${normalized}`,
    `App: ${details.app}`,
    `Host: ${host}`,
    `Allowed: ${details.allowed}`,
    `Time: ${new Date().toISOString()}`,
    `VERCEL_ENV: ${process.env.VERCEL_ENV ?? 'unknown'}`,
  ].join('\n')

  console.error('[admin-auth] WATCHED_LOGIN_ATTEMPT', {
    email: normalized,
    app: details.app,
    allowed: details.allowed,
    alertTo: to,
  })

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = adminLoginAlertFrom()
  if (!apiKey || !from) {
    console.error(
      '[admin-auth] WATCHED_LOGIN_ATTEMPT email skipped (RESEND_API_KEY or from address not configured)'
    )
    await recordOutboundMessage({
      channel: 'email',
      kind: 'login_alert',
      status: 'skipped',
      toAddress: to,
      subject,
      skipReason: 'email not configured',
    })
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(
        '[admin-auth] WATCHED_LOGIN_ATTEMPT email failed',
        res.status,
        body.slice(0, 300)
      )
      await recordOutboundMessage({
        channel: 'email',
        kind: 'login_alert',
        status: 'failed',
        toAddress: to,
        subject,
        provider: 'resend',
        errorMessage: `Resend returned ${res.status}`,
      })
      return
    }

    let providerMessageId: string | null = null
    try {
      const data = (await res.json()) as { id?: string }
      providerMessageId = data.id?.trim() || null
    } catch {
      // ignore
    }

    await recordOutboundMessage({
      channel: 'email',
      kind: 'login_alert',
      status: 'sent',
      toAddress: to,
      subject,
      provider: 'resend',
      providerMessageId,
      sentAt: new Date(),
    })
  } catch (err) {
    console.error('[admin-auth] WATCHED_LOGIN_ATTEMPT email error', err)
    const message = err instanceof Error ? err.message : 'send failed'
    await recordOutboundMessage({
      channel: 'email',
      kind: 'login_alert',
      status: 'failed',
      toAddress: to,
      subject,
      provider: 'resend',
      errorMessage: message,
    })
  }
}
