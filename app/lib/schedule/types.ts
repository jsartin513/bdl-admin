export const SCHEDULED_ACTION_TYPES = [
  'contact_job',
  'publish_post',
  'social_reminder',
] as const

export type ScheduledActionType = (typeof SCHEDULED_ACTION_TYPES)[number]

export const SCHEDULED_ACTION_STATUSES = [
  'scheduled',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const

export type ScheduledActionStatus = (typeof SCHEDULED_ACTION_STATUSES)[number]

export type ScheduledActionRecord = {
  id: string
  createdByAdminEmail: string
  runAt: string
  timezone: string
  actionType: ScheduledActionType
  payload: Record<string, unknown>
  status: ScheduledActionStatus
  idempotencyKey: string | null
  errorMessage: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ContactJobScheduledPayload = {
  contactRequest: Record<string, unknown>
}

export type PublishPostScheduledPayload = {
  publishPostId: string
  sendSocialReminder?: boolean
}

export type SocialReminderScheduledPayload = {
  publishPostId: string
}
