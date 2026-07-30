export const VIDEO_SET_STATUSES = [
  'draft',
  'uploading',
  'ready',
  'queued',
  'processing',
  'complete',
  'failed',
] as const

export type VideoSetStatus = (typeof VIDEO_SET_STATUSES)[number]

export function isValidVideoSetStatus(value: string): value is VideoSetStatus {
  return (VIDEO_SET_STATUSES as readonly string[]).includes(value)
}

export type VideoUploadClipRecord = {
  id: string
  setId: string
  originalFilename: string
  blobUrl: string
  pathname: string
  sizeBytes: number
  sortIndex: number | null
  uploadComplete: boolean
  createdAt: Date
}

export const YOUTUBE_UPLOAD_STATUSES = [
  'none',
  'queued',
  'uploading',
  'complete',
  'failed',
] as const

export type YoutubeUploadStatus = (typeof YOUTUBE_UPLOAD_STATUSES)[number]

export function isValidYoutubeUploadStatus(
  value: string
): value is YoutubeUploadStatus {
  return (YOUTUBE_UPLOAD_STATUSES as readonly string[]).includes(value)
}

export type VideoUploadSetRecord = {
  id: string
  eventName: string
  label: string
  eventDate: string
  status: string
  createdByEmail: string
  errorMessage: string | null
  mergedBlobUrl: string | null
  mergedBlobPathname: string | null
  outputFilename: string | null
  pendingUploadCount: number
  autoEnqueueOnReady: boolean
  youtubePlaylistId: string | null
  youtubePlaylistTitle: string | null
  youtubePrivacy: string
  youtubeUploadStatus: string
  youtubeVideoId: string | null
  youtubeVideoUrl: string | null
  youtubeErrorMessage: string | null
  createdAt: Date
  updatedAt: Date
}

export type AdminNotificationRecord = {
  id: string
  recipientEmail: string
  title: string
  body: string
  href: string | null
  readAt: Date | null
  createdAt: Date
}

export type VideoUploadSetListItem = VideoUploadSetRecord & {
  clipCount: number
  displayTitle: string
}

export type VideoUploadSetDetail = VideoUploadSetRecord & {
  displayTitle: string
  clips: VideoUploadClipRecord[]
}

export type WorkerClaimPayload = {
  set: VideoUploadSetRecord
  clips: VideoUploadClipRecord[]
  outputFilename: string
  /** Must be sent back on complete/fail; rotated on each claim. */
  claimToken: string
}

export type YoutubeWorkerClaimPayload = {
  set: VideoUploadSetRecord
  claimToken: string
  accessToken: string
  mergedBlobUrl: string
  title: string
  description: string
  privacyStatus: string
  playlistId: string
}
