import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADMIN_NEXT_PATH,
  safeAdminNextPath,
} from '@/app/lib/admin-next'

describe('safeAdminNextPath', () => {
  it.each([
    ['/', '/'],
    ['/players', '/players'],
    ['/players?dev=1', '/players?dev=1'],
    ['/events/123?tab=draft#teams', '/events/123?tab=draft#teams'],
    ['/events/../players', '/players'],
    ['/%2f%2fexample.com', '/%2f%2fexample.com'],
    ['/%5cexample.com', '/%5cexample.com'],
    ['/players/Zoë?tab=notes#bio', '/players/Zo%C3%AB?tab=notes#bio'],
  ])('keeps app-relative destinations: %s', (value, expected) => {
    expect(safeAdminNextPath(value)).toBe(expected)
  })

  it.each([
    null,
    undefined,
    '',
    'players',
    'https://example.com',
    '//example.com',
    '//admin.invalid/path',
    '///example.com',
    '/\\example.com',
    '/\\admin.invalid/path',
    '/safe/..//example.com',
    '/safe/%2e%2e//example.com',
    '/.//example.com',
    '/\t/example.com',
    '/\r/example.com',
    '/players\n/settings',
    '/players\u007f/settings',
  ])('falls back for an unsafe destination: %s', (value) => {
    expect(safeAdminNextPath(value)).toBe(DEFAULT_ADMIN_NEXT_PATH)
  })

  it.each([
    '/players',
    '/players?next=//example.com',
    '/events/../players',
  ])('always resolves on the app origin: %s', (value) => {
    const destination = safeAdminNextPath(value)
    expect(new URL(destination, 'https://admin.example.com').origin).toBe(
      'https://admin.example.com'
    )
  })
})
