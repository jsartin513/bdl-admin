import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { listConfiguredWhatsAppTemplates } from '@/app/lib/contact/whatsapp-templates'
import { isEmailProviderConfigured } from '@/app/lib/contact/providers/email'
import { isTwilioConfigured } from '@/app/lib/contact/providers/twilio'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  return NextResponse.json({
    providers: {
      email: isEmailProviderConfigured() || process.env.CONTACT_DRY_RUN === '1',
      sms: isTwilioConfigured() || process.env.CONTACT_DRY_RUN === '1',
      whatsapp: isTwilioConfigured() || process.env.CONTACT_DRY_RUN === '1',
    },
    whatsappTemplates: listConfiguredWhatsAppTemplates(),
  })
}
