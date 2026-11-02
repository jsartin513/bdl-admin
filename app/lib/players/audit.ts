import { writePlayerChange as writeSensitivePlayerChange } from '@/app/lib/sensitive/player-data'
import type { ChangeSource, ChangeType } from '@/app/lib/players/types'

export async function writePlayerChange(input: {
  playerId: string
  source: ChangeSource
  actor: string
  changeType: ChangeType
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  importBatchId?: string | null
}) {
  await writeSensitivePlayerChange(input)
}
