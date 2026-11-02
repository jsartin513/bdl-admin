import { Resend } from 'resend'

export type SendEmailResult = {
  providerMessageId: string
}

export function isEmailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

export function getContactEmailFrom(): string {
  const from = process.env.CONTACT_EMAIL_FROM?.trim()
  if (!from) {
    throw new Error('CONTACT_EMAIL_FROM is not configured')
  }
  return from
}

/** Send one transactional email via Resend. */
export async function sendContactEmail(opts: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  if (process.env.CONTACT_DRY_RUN === '1') {
    return { providerMessageId: `dry-run-email-${Date.now()}` }
  }

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from: getContactEmailFrom(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  })

  if (error) {
    throw new Error(error.message || 'Resend send failed')
  }
  if (!data?.id) {
    throw new Error('Resend did not return a message id')
  }
  return { providerMessageId: data.id }
}
