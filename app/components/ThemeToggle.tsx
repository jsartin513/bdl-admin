'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <label className="flex items-center gap-2">
        <span className="sr-only">Theme</span>
        <select
          aria-label="Theme"
          disabled
          className="rounded border border-gray-500 bg-gray-700 px-2 py-1 text-sm text-gray-100"
        >
          <option>System</option>
        </select>
      </label>
    )
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-gray-200">Theme</span>
      <select
        aria-label="Theme"
        value={theme ?? 'system'}
        onChange={(event) => setTheme(event.target.value)}
        className="rounded border border-gray-500 bg-gray-700 px-2 py-1 text-sm text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {THEMES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
