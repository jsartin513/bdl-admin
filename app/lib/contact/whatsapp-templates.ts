import type {
  WhatsAppTemplateDefinition,
  WhatsAppTemplateKey,
} from '@/app/lib/contact/types'

export const WHATSAPP_TEMPLATES: WhatsAppTemplateDefinition[] = [
  {
    key: 'event_reminder',
    label: 'Event reminder',
    description: 'Remind registered players about an upcoming event.',
    envVar: 'TWILIO_WA_TEMPLATE_EVENT_REMINDER',
    variableKeys: ['firstName', 'eventName', 'eventDate'],
  },
  {
    key: 'schedule_change',
    label: 'Schedule change',
    description: 'Notify players of a schedule or time change.',
    envVar: 'TWILIO_WA_TEMPLATE_SCHEDULE_CHANGE',
    variableKeys: ['firstName', 'eventName', 'eventDate'],
  },
  {
    key: 'announcement',
    label: 'General announcement',
    description: 'Short operational announcement to opted-in players.',
    envVar: 'TWILIO_WA_TEMPLATE_ANNOUNCEMENT',
    variableKeys: ['firstName', 'body'],
  },
]

export function getWhatsAppTemplate(
  key: WhatsAppTemplateKey
): WhatsAppTemplateDefinition | undefined {
  return WHATSAPP_TEMPLATES.find((t) => t.key === key)
}

/** Resolve Twilio Content SID for a known template key from env. */
export function resolveWhatsAppTemplateSid(
  key: WhatsAppTemplateKey
): string | null {
  const def = getWhatsAppTemplate(key)
  if (!def) return null
  const sid = process.env[def.envVar]?.trim()
  return sid || null
}

export function listConfiguredWhatsAppTemplates(): Array<
  WhatsAppTemplateDefinition & { configured: boolean; sid: string | null }
> {
  return WHATSAPP_TEMPLATES.map((t) => {
    const sid = process.env[t.envVar]?.trim() || null
    return { ...t, configured: Boolean(sid), sid }
  })
}
