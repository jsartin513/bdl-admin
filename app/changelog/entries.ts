export type ChangelogEntry = {
  /** ISO date string YYYY-MM-DD */
  date: string
  title: string
  summary: string
  /** Optional deep link into the related tool */
  href?: string
  /** Optional human version label (not package semver) */
  version?: string
}

/**
 * Curated board-facing release notes. Add an entry when shipping user-visible
 * admin changes (see AGENTS.md / PR template).
 */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: '2026-10-01',
    title: 'Captain live draft (preview)',
    summary:
      'Draft-format events can run a live snake draft: captains pick on the player app while the board runs the commissioner panel on the event page.',
    href: '/events',
  },
  {
    date: '2026-10-01',
    title: 'Board awareness: What’s New, Dev mode labels, feature requests',
    summary:
      'Incomplete tools are labeled in the nav, developer-only tools stay behind Dev mode, and board members can request features from within admin (GitHub issues).',
    href: '/whats-new',
  },
  {
    date: '2026-09-30',
    title: 'Scheduled communications',
    summary:
      'Schedule contact jobs and website publishes for a future time. Production needs an external cron hitting the dispatch endpoint.',
    href: '/scheduled',
  },
  {
    date: '2026-09-28',
    title: 'Publish to the public website',
    summary:
      'Draft announcements, open-gym flyers, and short videos in admin, then approve to cross-post to the league site.',
    href: '/publish',
  },
  {
    date: '2026-09-20',
    title: 'Non-BDL events',
    summary:
      'Track external tournaments and events with teams, attendees, stories, and photo kits.',
    href: '/non-bdl-events',
  },
  {
    date: '2026-09-10',
    title: 'Video tools',
    summary:
      'Upload GoPro clip sets for merge. Automatic merge requires the Fly video worker and Blob credentials.',
    href: '/video-tools',
  },
  {
    date: '2026-08-15',
    title: 'Dev mode for developer tools',
    summary:
      'Toggle Dev mode in the top nav to reveal tournament audio, scoresheets, and related builder utilities.',
  },
]

export function getChangelogEntriesNewestFirst(): ChangelogEntry[] {
  return [...CHANGELOG_ENTRIES].sort((a, b) => b.date.localeCompare(a.date))
}
