export type BoardAppId = 'admin' | 'merch' | 'open-gym'

export type BoardAppLink = {
  id: BoardAppId
  label: string
  href: string
}

const PROD_APPS: Record<BoardAppId, string> = {
  admin: 'https://admin.bostondodgeballleague.com',
  merch: 'https://merch.bostondodgeballleague.com/admin/dashboard',
  'open-gym': 'https://open-gym.bostondodgeballleague.com/admin/dashboard',
}

const PREVIEW_APPS: Record<BoardAppId, string> = {
  admin: 'https://admin-preview.bostondodgeballleague.com',
  merch: 'https://store-preview.bostondodgeballleague.com/admin/dashboard',
  'open-gym': 'https://open-gym-preview.bostondodgeballleague.com/admin/dashboard',
}

const APP_LABELS: Record<BoardAppId, string> = {
  admin: 'League Admin',
  merch: 'Merch Admin',
  'open-gym': 'Open Gym Admin',
}

const ALL_APP_IDS: BoardAppId[] = ['admin', 'merch', 'open-gym']

export function isPreviewBoardHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host.includes('-preview.') ||
    host.startsWith('store-preview.') ||
    host === 'store-preview.bostondodgeballleague.com'
  )
}

export function getBoardAppLinks(currentApp: BoardAppId, hostname?: string): BoardAppLink[] {
  const host =
    hostname ??
    (typeof window !== 'undefined' ? window.location.hostname : '') ??
    ''
  const map = isPreviewBoardHost(host) ? PREVIEW_APPS : PROD_APPS
  return ALL_APP_IDS.filter((id) => id !== currentApp).map((id) => ({
    id,
    label: APP_LABELS[id],
    href: map[id],
  }))
}
