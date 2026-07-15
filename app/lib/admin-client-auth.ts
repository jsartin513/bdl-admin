/** Client helpers for Google-cookie admin sessions. */

export async function fetchAdminSession(): Promise<{ email: string } | null> {
  const res = await fetch('/api/admin/session')
  if (res.status === 401) return null
  if (!res.ok) return null
  const data = (await res.json()) as { email?: string }
  return typeof data.email === 'string' ? { email: data.email } : null
}

export async function logoutAdminSession(): Promise<void> {
  await fetch('/api/admin/logout', { method: 'POST' })
}
