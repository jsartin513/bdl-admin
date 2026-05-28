export const DEV_MODE_PARAM = 'dev'

export function isDevMode(searchParams: { get(name: string): string | null }): boolean {
  const value = searchParams.get(DEV_MODE_PARAM)
  return value === '1' || value === 'true'
}

/** Preserve dev=1 on internal links when dev mode is active. */
export function withDevMode(href: string, devMode: boolean): string {
  if (!devMode) return href
  const url = new URL(href, 'http://local')
  url.searchParams.set(DEV_MODE_PARAM, '1')
  return `${url.pathname}${url.search}`
}
