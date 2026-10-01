export type FeatureMaturity = 'ready' | 'incomplete' | 'devOnly'

export type FeatureNavGroup = 'leagues' | 'main' | 'developer'

export type FeatureEntry = {
  id: string
  label: string
  href: string
  maturity: FeatureMaturity
  /** Nav placement. Defaults to main for ready/incomplete; developer for devOnly. */
  group?: FeatureNavGroup
  /** Shown on Incomplete badges/banners or Dev mode tooltips. */
  note?: string
  /** Path prefixes that belong to this feature (for banners / soft gates). */
  pathPrefixes?: string[]
}

export const FEATURE_REGISTRY: FeatureEntry[] = [
  {
    id: 'schedules',
    label: 'View Schedule',
    href: '/schedules',
    maturity: 'ready',
    group: 'leagues',
    pathPrefixes: ['/schedules'],
  },
  {
    id: 'create-league',
    label: 'Create New Schedule',
    href: '/create-league',
    maturity: 'ready',
    group: 'leagues',
    pathPrefixes: ['/create-league'],
  },
  {
    id: 'open-gym',
    label: 'Open Gym',
    href: '/open-gym',
    maturity: 'ready',
    group: 'main',
    pathPrefixes: ['/open-gym'],
  },
  {
    id: 'players',
    label: 'Player Management',
    href: '/players',
    maturity: 'ready',
    group: 'main',
    pathPrefixes: ['/players'],
  },
  {
    id: 'events',
    label: 'Events',
    href: '/events',
    maturity: 'ready',
    group: 'main',
    pathPrefixes: ['/events'],
  },
  {
    id: 'video-tools',
    label: 'Video Tools',
    href: '/video-tools',
    maturity: 'incomplete',
    group: 'main',
    note: 'Uploads work; automatic merge needs the Fly video worker and related secrets.',
    pathPrefixes: ['/video-tools'],
  },
  {
    id: 'publish',
    label: 'Publish',
    href: '/publish',
    maturity: 'incomplete',
    group: 'main',
    note: 'Cross-post to the public site. Approve needs publish secrets and a paired website env.',
    pathPrefixes: ['/publish'],
  },
  {
    id: 'scheduled',
    label: 'Scheduled',
    href: '/scheduled',
    maturity: 'incomplete',
    group: 'main',
    note: 'Scheduled contact and publish need an external cron hitting the dispatch endpoint in production.',
    pathPrefixes: ['/scheduled'],
  },
  {
    id: 'non-bdl-events',
    label: 'Non-BDL Events',
    href: '/non-bdl-events',
    maturity: 'incomplete',
    group: 'main',
    note: 'Newer workflow for external events; some story/photo paths are still evolving.',
    pathPrefixes: ['/non-bdl-events'],
  },
  {
    id: 'tournament-audio',
    label: 'Tournament Audio',
    href: '/tournament',
    maturity: 'devOnly',
    group: 'developer',
    note: 'Developer tool for building tournament audio cue tracks.',
    pathPrefixes: ['/tournament'],
  },
  {
    id: 'tournament-team-schedules',
    label: 'Team Schedules',
    href: '/tournament/team-schedules',
    maturity: 'devOnly',
    group: 'developer',
    note: 'Developer tool for tournament team schedule printouts.',
    pathPrefixes: ['/tournament/team-schedules'],
  },
  {
    id: 'tournament-scoresheets',
    label: 'Scoresheets',
    href: '/tournament/scoresheets',
    maturity: 'devOnly',
    group: 'developer',
    note: 'Developer tool for tournament scoresheet stacks.',
    pathPrefixes: ['/tournament/scoresheets'],
  },
  {
    id: 'timer',
    label: 'Game Timer',
    href: '/timer',
    maturity: 'devOnly',
    group: 'developer',
    note: 'Standalone game clock UI. Prefer timer-standalone for kiosk use.',
    pathPrefixes: ['/timer'],
  },
  {
    id: 'timer-standalone',
    label: 'Timer (Standalone)',
    href: '/timer-standalone',
    maturity: 'devOnly',
    group: 'developer',
    note: 'Full-screen timer without admin chrome.',
    pathPrefixes: ['/timer-standalone'],
  },
]

function pathMatches(pathname: string, prefixes: string[] | undefined): boolean {
  if (!prefixes?.length) return false
  return prefixes.some((prefix) => {
    if (pathname === prefix) return true
    // Prefer longest exact /tournament/* entries over /tournament alone.
    return pathname.startsWith(`${prefix}/`)
  })
}

/** Most specific matching feature for a pathname (longest prefix wins). */
export function featureForPath(pathname: string): FeatureEntry | undefined {
  let best: FeatureEntry | undefined
  let bestLen = -1
  for (const entry of FEATURE_REGISTRY) {
    for (const prefix of entry.pathPrefixes ?? []) {
      const matches =
        pathname === prefix || pathname.startsWith(`${prefix}/`)
      if (!matches) continue
      if (prefix.length > bestLen) {
        best = entry
        bestLen = prefix.length
      }
    }
  }
  return best
}

export function visibleInNav(entry: FeatureEntry, devMode: boolean): boolean {
  if (entry.maturity === 'devOnly') return devMode
  return true
}

export function isDevOnlyRoute(pathname: string): boolean {
  return featureForPath(pathname)?.maturity === 'devOnly'
}

export function incompleteFeatureForPath(
  pathname: string
): FeatureEntry | undefined {
  const feature = featureForPath(pathname)
  return feature?.maturity === 'incomplete' ? feature : undefined
}

export function navEntriesForGroup(
  group: FeatureNavGroup,
  devMode: boolean
): FeatureEntry[] {
  return FEATURE_REGISTRY.filter((entry) => {
    const resolvedGroup =
      entry.group ?? (entry.maturity === 'devOnly' ? 'developer' : 'main')
    return resolvedGroup === group && visibleInNav(entry, devMode)
  })
}

export function pathMatchesFeature(
  pathname: string,
  entry: FeatureEntry
): boolean {
  return pathMatches(pathname, entry.pathPrefixes)
}
