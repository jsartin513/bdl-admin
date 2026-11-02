export type FeatureMaturity = 'ready' | 'incomplete' | 'devOnly'

export type FeatureNavGroup = 'leagues' | 'main' | 'incomplete' | 'developer'

export type FeatureEntry = {
  id: string
  label: string
  href: string
  maturity: FeatureMaturity
  /** Nav placement. Defaults to main for ready/incomplete; developer for devOnly. */
  group?: FeatureNavGroup
  /** One-sentence nav hint (hover / keyboard focus). */
  description: string
  /** Shown on Incomplete badges/banners or Dev mode tooltips. */
  note?: string
  /** Path prefixes that belong to this feature (for banners / soft gates). */
  pathPrefixes?: string[]
}

export function resolveFeatureNavGroup(entry: FeatureEntry): FeatureNavGroup {
  return (
    entry.group ?? (entry.maturity === 'devOnly' ? 'developer' : 'main')
  )
}

export const FEATURE_REGISTRY: FeatureEntry[] = [
  {
    id: 'schedules',
    label: 'View Schedule',
    href: '/schedules',
    maturity: 'ready',
    group: 'leagues',
    description: 'Open existing league schedule spreadsheets from cloud storage.',
    pathPrefixes: ['/schedules'],
  },
  {
    id: 'create-league',
    label: 'Create New Schedule',
    href: '/create-league',
    maturity: 'ready',
    group: 'leagues',
    description: 'Generate a new season schedule workbook from league settings.',
    pathPrefixes: ['/create-league'],
  },
  {
    id: 'open-gym',
    label: 'Open Gym',
    href: '/open-gym',
    maturity: 'ready',
    group: 'main',
    description: 'Plan open gym nights and track who signed up.',
    pathPrefixes: ['/open-gym'],
  },
  {
    id: 'players',
    label: 'Player Management',
    href: '/players',
    maturity: 'ready',
    group: 'main',
    description: 'Search the roster, edit profiles, and message players.',
    pathPrefixes: ['/players'],
  },
  {
    id: 'outbox',
    label: 'Outbox',
    href: '/outbox',
    maturity: 'incomplete',
    group: 'incomplete',
    description:
      'Review sent and failed outbound email and text messages (delivery log).',
    note: 'Outbound send log and retries; delivery depends on Twilio/SendGrid setup and scheduled dispatch.',
    pathPrefixes: ['/outbox'],
  },
  {
    id: 'events',
    label: 'Events',
    href: '/events',
    maturity: 'ready',
    group: 'main',
    description: 'Create events, run drafts, and manage registrations.',
    pathPrefixes: ['/events'],
  },
  {
    id: 'captain-live-draft',
    label: 'Captain live draft',
    href: '/events',
    maturity: 'devOnly',
    group: 'developer',
    description:
      'Commissioner console for live captain drafts (open from a draft event).',
    note:
      'Commissioner console for live captain drafts. Open a draft-format event with Dev mode on, then use Live draft (commissioner).',
    pathPrefixes: [],
  },
  {
    id: 'video-tools',
    label: 'Video Tools',
    href: '/video-tools',
    maturity: 'incomplete',
    group: 'incomplete',
    description: 'Upload court camera clips and prepare merged highlight reels.',
    note: 'Uploads work; automatic merge needs the Fly video worker and related secrets.',
    pathPrefixes: ['/video-tools'],
  },
  {
    id: 'publish',
    label: 'Publish',
    href: '/publish',
    maturity: 'incomplete',
    group: 'incomplete',
    description: 'Draft and approve website posts and social share kits.',
    note: 'Cross-post to the public site. Approve needs publish secrets and a paired website env.',
    pathPrefixes: ['/publish'],
  },
  {
    id: 'scheduled',
    label: 'Scheduled',
    href: '/scheduled',
    maturity: 'incomplete',
    group: 'incomplete',
    description: 'Queue contact and publish jobs to send automatically later.',
    note: 'Scheduled contact and publish need an external cron hitting the dispatch endpoint in production.',
    pathPrefixes: ['/scheduled'],
  },
  {
    id: 'non-bdl-events',
    label: 'Non-BDL Events',
    href: '/non-bdl-events',
    maturity: 'incomplete',
    group: 'incomplete',
    description: 'Plan external tournaments and website stories outside main league play.',
    note: 'Newer workflow for external events; some story/photo paths are still evolving.',
    pathPrefixes: ['/non-bdl-events'],
  },
  {
    id: 'tournament-audio',
    label: 'Tournament Audio',
    href: '/tournament',
    maturity: 'devOnly',
    group: 'developer',
    description: 'Build tournament PA audio cue tracks from a CSV schedule.',
    note: 'Developer tool for building tournament audio cue tracks.',
    pathPrefixes: ['/tournament'],
  },
  {
    id: 'tournament-team-schedules',
    label: 'Team Schedules',
    href: '/tournament/team-schedules',
    maturity: 'devOnly',
    group: 'developer',
    description: 'Print per-team tournament schedule sheets for captains.',
    note: 'Developer tool for tournament team schedule printouts.',
    pathPrefixes: ['/tournament/team-schedules'],
  },
  {
    id: 'tournament-scoresheets',
    label: 'Scoresheets',
    href: '/tournament/scoresheets',
    maturity: 'devOnly',
    group: 'developer',
    description: 'Generate printable tournament scoresheet stacks.',
    note: 'Developer tool for tournament scoresheet stacks.',
    pathPrefixes: ['/tournament/scoresheets'],
  },
  {
    id: 'timer',
    label: 'Game Timer',
    href: '/timer',
    maturity: 'devOnly',
    group: 'developer',
    description: 'Run a game clock inside the admin navigation shell.',
    note: 'Standalone game clock UI. Prefer timer-standalone for kiosk use.',
    pathPrefixes: ['/timer'],
  },
  {
    id: 'timer-standalone',
    label: 'Timer (Standalone)',
    href: '/timer-standalone',
    maturity: 'devOnly',
    group: 'developer',
    description: 'Full-screen game clock for gym kiosks without admin chrome.',
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

/** Admin commissioner UI for captain live draft (`/events/[id]/live-draft`). */
export function isCaptainLiveDraftAdminPath(pathname: string): boolean {
  return /^\/events\/[^/]+\/live-draft\/?$/.test(pathname)
}

export function isDevOnlyRoute(pathname: string): boolean {
  if (isCaptainLiveDraftAdminPath(pathname)) return true
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
    return (
      resolveFeatureNavGroup(entry) === group && visibleInNav(entry, devMode)
    )
  })
}

/** Top-level bar links (registry order). Incomplete tools promote here when Dev mode is on. */
export function topLevelNavEntries(devMode: boolean): FeatureEntry[] {
  return FEATURE_REGISTRY.filter((entry) => {
    if (!visibleInNav(entry, devMode)) return false
    const group = resolveFeatureNavGroup(entry)
    if (group === 'leagues' || group === 'developer') return false
    if (group === 'incomplete') return devMode
    return group === 'main'
  })
}

/** Incomplete / WIP tools grouped under one menu when Dev mode is off. */
export function inProgressNavEntries(devMode: boolean): FeatureEntry[] {
  if (devMode) return []
  return navEntriesForGroup('incomplete', devMode)
}

export function pathMatchesFeature(
  pathname: string,
  entry: FeatureEntry
): boolean {
  return pathMatches(pathname, entry.pathPrefixes)
}
