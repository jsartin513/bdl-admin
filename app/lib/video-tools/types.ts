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
  createdAt: Date
  updatedAt: Date
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
