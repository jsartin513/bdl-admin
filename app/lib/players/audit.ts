import { getDb } from '@/app/lib/db'
import { playerChanges } from '@/app/db/schema'
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
  const db = getDb()
  await db.insert(playerChanges).values({
    playerId: input.playerId,
    source: input.source,
    actor: input.actor,
    changeType: input.changeType,
    before: input.before,
    after: input.after,
    importBatchId: input.importBatchId ?? null,
  })
}
