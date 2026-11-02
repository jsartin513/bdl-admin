import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { previewContactAudience } from '@/app/lib/contact/audience'
import { parseContactPreviewRequest } from '@/app/lib/contact/parse'
import { listConfiguredWhatsAppTemplates } from '@/app/lib/contact/whatsapp-templates'
import { estimateSmsSegments } from '@/app/lib/contact/phone'
import {
  isEmailProviderConfigured,
} from '@/app/lib/contact/providers/email'
import { isTwilioConfigured } from '@/app/lib/contact/providers/twilio'

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = await request.json()
    const parsed = parseContactPreviewRequest(body)
    const preview = await previewContactAudience(parsed)

    const { recipients: _recipients, ...summary } = preview
    void _recipients

    return NextResponse.json({
      ...summary,
      providers: {
        email: isEmailProviderConfigured() || process.env.CONTACT_DRY_RUN === '1',
        sms: isTwilioConfigured() || process.env.CONTACT_DRY_RUN === '1',
        whatsapp: isTwilioConfigured() || process.env.CONTACT_DRY_RUN === '1',
      },
      whatsappTemplates: listConfiguredWhatsAppTemplates(),
      smsSegments:
        typeof body.bodyText === 'string'
          ? estimateSmsSegments(body.bodyText)
          : null,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to preview contact audience'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
