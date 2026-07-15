import { describe, expect, it } from 'vitest'
import { getBoardAppLinks, isPreviewBoardHost } from '@/app/lib/board-apps'

describe('board apps menu links', () => {
  it('detects preview hosts', () => {
    expect(isPreviewBoardHost('admin-preview.bostondodgeballleague.com')).toBe(true)
    expect(isPreviewBoardHost('store-preview.bostondodgeballleague.com')).toBe(true)
    expect(isPreviewBoardHost('open-gym-preview.bostondodgeballleague.com')).toBe(true)
    expect(isPreviewBoardHost('admin.bostondodgeballleague.com')).toBe(false)
  })

  it('returns prod sibling apps and excludes the current app', () => {
    const links = getBoardAppLinks('admin', 'admin.bostondodgeballleague.com')
    expect(links.map((link) => link.id)).toEqual(['merch', 'open-gym'])
    expect(links.find((link) => link.id === 'merch')?.href).toBe(
      'https://merch.bostondodgeballleague.com/admin/dashboard'
    )
  })

  it('returns preview sibling apps on preview hosts', () => {
    const links = getBoardAppLinks('merch', 'store-preview.bostondodgeballleague.com')
    expect(links.map((link) => link.id)).toEqual(['admin', 'open-gym'])
    expect(links.find((link) => link.id === 'admin')?.href).toBe(
      'https://admin-preview.bostondodgeballleague.com'
    )
    expect(links.find((link) => link.id === 'open-gym')?.href).toBe(
      'https://open-gym-preview.bostondodgeballleague.com/admin/dashboard'
    )
  })
})
