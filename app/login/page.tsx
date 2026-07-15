'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchAdminSession } from '@/app/lib/admin-client-auth'

function adminErrorMessage(error: string | null): string | null {
  if (!error) return null
  if (error === 'allowlist_not_configured') {
    return 'Admin sign-in is not configured. Set ADMIN_ALLOWED_EMAILS on production.'
  }
  if (error === 'email_not_allowed') {
    return 'That Google account is not on the admin allowlist.'
  }
  return 'Sign-in failed. Confirm your Google account is allowed and try again.'
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorMessage = adminErrorMessage(searchParams.get('error'))
  const next = searchParams.get('next') || '/schedules'

  useEffect(() => {
    void fetchAdminSession().then((session) => {
      if (session) router.replace(next.startsWith('/') ? next : '/schedules')
    })
  }, [router, next])

  useEffect(() => {
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      document.cookie = `admin_oauth_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`
    }
  }, [next])

  const loginHref = '/api/admin/google/login'

  return (
    <div className="min-h-[calc(100vh-52px)] bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          BDL League Admin
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign in with an approved Google account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 space-y-6">
          <p className="text-sm text-gray-700">
            Access schedules, league tools, and the players dashboard.
          </p>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <a
            href={loginHref}
            className="flex w-full items-center justify-center rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in with Google
          </a>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-52px)] bg-gray-50 flex items-center justify-center text-sm text-gray-600">
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
