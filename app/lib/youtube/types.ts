export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
].join(' ')

export const YOUTUBE_OAUTH_STATE_COOKIE = 'youtube_oauth_state'

export type YoutubePlaylistSummary = {
  id: string
  title: string
  itemCount: number | null
}

export type YoutubeChannelConnectionPublic = {
  channelId: string
  channelTitle: string
  connectedByEmail: string
  updatedAt: Date
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

export function buildYoutubeVideoTitle(input: {
  eventName: string
  label: string
  eventDate: string
}): string {
  const base = `${input.eventName.trim()} · ${input.label.trim()}`.trim()
  const withDate = input.eventDate ? `${base} (${input.eventDate})` : base
  // YouTube title max length is 100 characters.
  return withDate.slice(0, 100)
}

export function buildYoutubeVideoDescription(input: {
  eventName: string
  label: string
  eventDate: string
  appHref?: string | null
}): string {
  const lines = [
    `${input.eventName} — ${input.label}`,
    `Event date: ${input.eventDate}`,
    '',
    'Uploaded automatically from BDL Video Tools.',
  ]
  if (input.appHref) {
    lines.push('', `Admin: ${input.appHref}`)
  }
  return lines.join('\n').slice(0, 5000)
}
