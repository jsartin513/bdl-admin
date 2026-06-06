export const DEV_MODE_PARAM = 'dev'

type SearchParamsLike = Pick<URLSearchParams, 'get'>

export function isDevMode(searchParams: SearchParamsLike): boolean {
  const value = searchParams.get(DEV_MODE_PARAM)
  return value === '1' || value === 'true'
}

export function withDevMode(href: string, devMode: boolean): string {
  if (!devMode) return href
  // Only rewrite app-relative paths; avoid corrupting absolute URLs or non-http schemes.
  if (!href.startsWith('/')) return href
  const url = new URL(href, 'http://local')
  url.searchParams.set(DEV_MODE_PARAM, '1')
  return `${url.pathname}${url.search}${url.hash}`
}
