import { describe, expect, it } from 'vitest'
import { estimateSmsSegments, normalizePhoneE164 } from '@/app/lib/contact/phone'
import {
  plainTextToHtml,
  renderContactTemplate,
} from '@/app/lib/contact/templates'
import {
  parseContactJobRequest,
  parseContactPreviewRequest,
} from '@/app/lib/contact/parse'
import {
  getWhatsAppTemplate,
  listConfiguredWhatsAppTemplates,
} from '@/app/lib/contact/whatsapp-templates'

describe('normalizePhoneE164', () => {
  it('normalizes US 10-digit numbers', () => {
    expect(normalizePhoneE164('(617) 555-1212')).toBe('+16175551212')
  })

  it('keeps explicit country codes', () => {
    expect(normalizePhoneE164('+44 7700 900123')).toBe('+447700900123')
  })

  it('returns null for junk', () => {
    expect(normalizePhoneE164('abc')).toBeNull()
    expect(normalizePhoneE164('')).toBeNull()
    expect(normalizePhoneE164(null)).toBeNull()
  })
})

describe('estimateSmsSegments', () => {
  it('counts a short GSM message as one segment', () => {
    expect(estimateSmsSegments('Hello')).toBe(1)
  })

  it('splits long messages', () => {
    expect(estimateSmsSegments('a'.repeat(161))).toBe(2)
  })
})

describe('renderContactTemplate', () => {
  it('fills placeholders', () => {
    expect(
      renderContactTemplate('Hi {{firstName}} — {{eventName}} on {{eventDate}}', {
        firstName: 'Alex',
        eventName: 'Spring Classic',
        eventDate: '2026-04-01',
      })
    ).toBe('Hi Alex — Spring Classic on 2026-04-01')
  })

  it('falls back when vars missing', () => {
    expect(renderContactTemplate('Hi {{firstName}}', {})).toBe('Hi there')
  })

  it('escapes html from plain text', () => {
    expect(plainTextToHtml('a <b> & c')).toContain('&lt;b&gt;')
    expect(plainTextToHtml('a <b> & c')).toContain('&amp;')
  })
})

describe('parseContactPreviewRequest', () => {
  it('accepts playerIds audience', () => {
    const parsed = parseContactPreviewRequest({
      channel: 'email',
      playerIds: ['a', 'b', 'a'],
    })
    expect(parsed.channel).toBe('email')
    expect(parsed.audience).toEqual({
      audienceType: 'player_ids',
      playerIds: ['a', 'b'],
      eventId: null,
    })
  })

  it('accepts homeLeague filter for local players', () => {
    const parsed = parseContactPreviewRequest({
      channel: 'sms',
      homeLeague: 'boston_dodgeball_league',
    })
    expect(parsed.audience).toEqual({
      audienceType: 'filter',
      filters: { homeLeague: 'boston_dodgeball_league' },
    })
  })

  it('accepts eventId filter', () => {
    const parsed = parseContactPreviewRequest({
      channel: 'email',
      eventId: 'evt-1',
      skill: 40,
    })
    expect(parsed.audience).toEqual({
      audienceType: 'filter',
      filters: { eventId: 'evt-1', skill: 40 },
    })
  })

  it('rejects invalid channel', () => {
    expect(() => parseContactPreviewRequest({ channel: 'carrier-pigeon' })).toThrow(
      /channel/
    )
  })
})

describe('parseContactJobRequest', () => {
  it('requires email subject and body', () => {
    expect(() =>
      parseContactJobRequest({
        channel: 'email',
        playerIds: ['p1'],
        bodyText: 'hi',
      })
    ).toThrow(/subject/)
  })

  it('requires whatsapp template key', () => {
    expect(() =>
      parseContactJobRequest({
        channel: 'whatsapp',
        playerIds: ['p1'],
      })
    ).toThrow(/whatsappTemplateKey/)
  })

  it('accepts a valid whatsapp job', () => {
    const parsed = parseContactJobRequest({
      channel: 'whatsapp',
      playerIds: ['p1'],
      whatsappTemplateKey: 'event_reminder',
      templateVariables: { '1': 'Alex' },
    })
    expect(parsed.whatsappTemplateKey).toBe('event_reminder')
  })
})

describe('whatsapp templates', () => {
  it('exposes known template keys', () => {
    expect(getWhatsAppTemplate('announcement')?.label).toMatch(/announcement/i)
    expect(listConfiguredWhatsAppTemplates().length).toBe(3)
  })
})
