import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const login = vi.hoisted(() => ({
  fetchAdminSession: vi.fn(),
  nextValue: '/\\example.com',
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: login.replace }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'next' ? login.nextValue : null),
  }),
}))

vi.mock('@/app/lib/admin-client-auth', () => ({
  fetchAdminSession: login.fetchAdminSession,
}))

import LoginPage from '@/app/login/page'

describe('admin login return path', () => {
  beforeEach(() => {
    login.nextValue = '/\\example.com'
    login.fetchAdminSession.mockResolvedValue({ email: 'admin@example.com' })
    document.cookie = 'admin_oauth_next=; path=/; max-age=0'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses the safe fallback for the session redirect and OAuth cookie', async () => {
    render(<LoginPage />)

    await waitFor(() => {
      expect(login.replace).toHaveBeenCalledWith('/schedules')
      expect(document.cookie).toContain('admin_oauth_next=%2Fschedules')
    })
  })
})
