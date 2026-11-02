const PLACEHOLDER_RE = /\{\{\s*(firstName|eventName|eventDate)\s*\}\}/gi

export type ContactTemplateVars = {
  firstName?: string | null
  eventName?: string | null
  eventDate?: string | null
}

export function renderContactTemplate(
  template: string,
  vars: ContactTemplateVars
): string {
  return template.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const normalized = key.toLowerCase()
    if (normalized === 'firstname') return vars.firstName?.trim() || 'there'
    if (normalized === 'eventname') return vars.eventName?.trim() || 'the event'
    if (normalized === 'eventdate') return vars.eventDate?.trim() || ''
    return ''
  })
}

export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}
