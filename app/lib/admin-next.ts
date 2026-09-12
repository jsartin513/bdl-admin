export const DEFAULT_ADMIN_NEXT_PATH = '/schedules'

const ADMIN_NEXT_BASE = 'https://admin.invalid'
const UNSAFE_ADMIN_NEXT_CHARACTERS = /[\\\u0000-\u001f\u007f]/

export function safeAdminNextPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    UNSAFE_ADMIN_NEXT_CHARACTERS.test(value)
  ) {
    return DEFAULT_ADMIN_NEXT_PATH
  }

  try {
    const url = new URL(value, ADMIN_NEXT_BASE)
    if (url.origin !== ADMIN_NEXT_BASE) return DEFAULT_ADMIN_NEXT_PATH

    const destination = `${url.pathname}${url.search}${url.hash}`
    if (!destination.startsWith('/') || destination.startsWith('//')) {
      return DEFAULT_ADMIN_NEXT_PATH
    }

    return destination
  } catch {
    return DEFAULT_ADMIN_NEXT_PATH
  }
}
