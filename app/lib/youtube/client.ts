import type { YoutubePlaylistSummary } from '@/app/lib/youtube/types'
import {
  getYoutubeConnectionWithToken,
  updateYoutubeConnectionRefreshToken,
} from '@/app/lib/youtube/connection'

type TokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  error?: string
  error_description?: string
}

let cachedAccess: { token: string; expiresAtMs: number } | null = null

async function refreshAccessToken(): Promise<string> {
  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.ADMIN_GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client is not configured')
  }

  const connection = await getYoutubeConnectionWithToken()
  if (!connection) {
    throw new Error('YouTube channel is not connected')
  }

  if (cachedAccess && cachedAccess.expiresAtMs > Date.now() + 30_000) {
    return cachedAccess.token
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = (await res.json()) as TokenResponse
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || 'Failed to refresh YouTube access token'
    )
  }

  if (data.refresh_token) {
    await updateYoutubeConnectionRefreshToken(connection.id, data.refresh_token)
  }

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3500
  cachedAccess = {
    token: data.access_token,
    expiresAtMs: Date.now() + expiresIn * 1000,
  }
  return data.access_token
}

export async function getYoutubeAccessToken(): Promise<string> {
  return refreshAccessToken()
}

export function clearYoutubeAccessTokenCache(): void {
  cachedAccess = null
}

async function youtubeFetch(
  path: string,
  init?: RequestInit & { query?: Record<string, string> }
): Promise<Response> {
  const token = await getYoutubeAccessToken()
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      url.searchParams.set(k, v)
    }
  }
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, {
    method: init?.method,
    body: init?.body,
    headers,
    signal: init?.signal,
    cache: init?.cache,
    redirect: init?.redirect,
  })
}

export async function fetchMineChannel(): Promise<{
  channelId: string
  channelTitle: string
}> {
  const res = await youtubeFetch('channels', {
    query: { part: 'snippet', mine: 'true' },
  })
  const data = (await res.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string } }>
    error?: { message?: string }
  }
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to load YouTube channel')
  }
  const item = data.items?.[0]
  if (!item?.id) {
    throw new Error('No YouTube channel found for this Google account')
  }
  return {
    channelId: item.id,
    channelTitle: item.snippet?.title?.trim() || item.id,
  }
}

/** Used during OAuth callback when we already have a fresh access token. */
export async function fetchMineChannelWithAccessToken(
  accessToken: string
): Promise<{ channelId: string; channelTitle: string }> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('mine', 'true')
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string } }>
    error?: { message?: string }
  }
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to load YouTube channel')
  }
  const item = data.items?.[0]
  if (!item?.id) {
    throw new Error('No YouTube channel found for this Google account')
  }
  return {
    channelId: item.id,
    channelTitle: item.snippet?.title?.trim() || item.id,
  }
}

export async function listChannelPlaylists(): Promise<YoutubePlaylistSummary[]> {
  const playlists: YoutubePlaylistSummary[] = []
  let pageToken: string | undefined

  do {
    const query: Record<string, string> = {
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '50',
    }
    if (pageToken) query.pageToken = pageToken

    const res = await youtubeFetch('playlists', { query })
    const data = (await res.json()) as {
      items?: Array<{
        id?: string
        snippet?: { title?: string }
        contentDetails?: { itemCount?: number }
      }>
      nextPageToken?: string
      error?: { message?: string }
    }
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to list playlists')
    }

    for (const item of data.items || []) {
      if (!item.id) continue
      playlists.push({
        id: item.id,
        title: item.snippet?.title?.trim() || item.id,
        itemCount:
          typeof item.contentDetails?.itemCount === 'number'
            ? item.contentDetails.itemCount
            : null,
      })
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  playlists.sort((a, b) => a.title.localeCompare(b.title))
  return playlists
}

export async function createPlaylist(input: {
  title: string
  description?: string
  privacyStatus?: 'private' | 'public' | 'unlisted'
}): Promise<YoutubePlaylistSummary> {
  const title = input.title.trim()
  if (!title) throw new Error('Playlist title is required')

  const res = await youtubeFetch('playlists', {
    method: 'POST',
    query: { part: 'snippet,status,contentDetails' },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: {
        title: title.slice(0, 150),
        description: (input.description || '').slice(0, 5000),
      },
      status: {
        privacyStatus: input.privacyStatus || 'unlisted',
      },
    }),
  })

  const data = (await res.json()) as {
    id?: string
    snippet?: { title?: string }
    contentDetails?: { itemCount?: number }
    error?: { message?: string }
  }
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || 'Failed to create playlist')
  }

  return {
    id: data.id,
    title: data.snippet?.title?.trim() || title,
    itemCount:
      typeof data.contentDetails?.itemCount === 'number'
        ? data.contentDetails.itemCount
        : 0,
  }
}

export async function addVideoToPlaylist(input: {
  playlistId: string
  videoId: string
}): Promise<void> {
  const res = await youtubeFetch('playlistItems', {
    method: 'POST',
    query: { part: 'snippet' },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: {
        playlistId: input.playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId: input.videoId,
        },
      },
    }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    throw new Error(data.error?.message || 'Failed to add video to playlist')
  }
}

