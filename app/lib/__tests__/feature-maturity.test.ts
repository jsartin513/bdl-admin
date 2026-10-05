import { describe, expect, it } from 'vitest'
import {
  featureForPath,
  incompleteFeatureForPath,
  isDevOnlyRoute,
  navEntriesForGroup,
  visibleInNav,
} from '@/app/lib/feature-maturity'

describe('feature-maturity', () => {
  it('hides devOnly entries unless Dev mode is on', () => {
    const tournament = {
      id: 'tournament-audio',
      label: 'Tournament Audio',
      href: '/tournament',
      maturity: 'devOnly' as const,
    }
    expect(visibleInNav(tournament, false)).toBe(false)
    expect(visibleInNav(tournament, true)).toBe(true)
  })

  it('keeps incomplete and ready entries visible without Dev mode', () => {
    expect(
      visibleInNav(
        {
          id: 'publish',
          label: 'Publish',
          href: '/publish',
          maturity: 'incomplete',
        },
        false
      )
    ).toBe(true)
    expect(
      visibleInNav(
        {
          id: 'players',
          label: 'Players',
          href: '/players',
          maturity: 'ready',
        },
        false
      )
    ).toBe(true)
  })

  it('picks the longest matching path prefix', () => {
    expect(featureForPath('/tournament/team-schedules')?.id).toBe(
      'tournament-team-schedules'
    )
    expect(featureForPath('/tournament')?.id).toBe('tournament-audio')
    expect(featureForPath('/timer-standalone')?.id).toBe('timer-standalone')
    expect(featureForPath('/timer')?.id).toBe('timer')
  })

  it('detects incomplete and dev-only routes', () => {
    expect(incompleteFeatureForPath('/publish/abc')?.id).toBe('publish')
    expect(incompleteFeatureForPath('/players')).toBeUndefined()
    expect(isDevOnlyRoute('/timer')).toBe(true)
    expect(isDevOnlyRoute('/events')).toBe(false)
    expect(isDevOnlyRoute('/events/abc-123/live-draft')).toBe(true)
  })

  it('filters developer nav by Dev mode', () => {
    expect(navEntriesForGroup('developer', false)).toHaveLength(0)
    const withDev = navEntriesForGroup('developer', true)
    expect(withDev.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        'tournament-audio',
        'tournament-team-schedules',
        'tournament-scoresheets',
        'timer',
        'timer-standalone',
        'captain-live-draft',
      ])
    )
  })

  it('groups incomplete tools in the incomplete nav bucket', () => {
    const incomplete = navEntriesForGroup('incomplete', false)
    expect(incomplete.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        'outbox',
        'video-tools',
        'publish',
        'scheduled',
        'non-bdl-events',
      ])
    )
    expect(incomplete.every((e) => e.maturity === 'incomplete')).toBe(true)
    expect(incompleteFeatureForPath('/outbox')?.id).toBe('outbox')
  })
})
