import { eq } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { importBatches, playerEmails, players } from '@/app/db/schema'
import {
  createPlayer,
  ensurePlayerAlias,
  ensurePlayerEmail,
  updatePlayer,
} from '@/app/lib/players/mutations'
import { getPlayerSnapshot } from '@/app/lib/players/queries'
import {
  defaultRosterName,
  parseSkillLevel,
  skillLevelLabel,
  type SkillLevel,
} from '@/app/lib/players/skill'
import { normalizeEmail, normalizeNamePart, nameKey } from '@/app/lib/players/normalize'

export type TeamlinktRow = {
  rowNumber: number
  firstName: string
  lastName: string
  email: string | null
  jerseyNumber: number | null
  skillLevel: SkillLevel | null
  raw: Record<string, string>
}

export type ImportPreviewAction =
  | { action: 'create'; row: TeamlinktRow }
  | { action: 'update'; row: TeamlinktRow; playerId: string; notes: string[] }
  | { action: 'skip'; row: TeamlinktRow; reason: string }
  | { action: 'ambiguous'; row: TeamlinktRow; reason: string; playerIds: string[] }

const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ['first name', 'firstname', 'first', 'player first name', 'given name'],
  lastName: ['last name', 'lastname', 'last', 'player last name', 'surname', 'family name'],
  email: ['email', 'e-mail', 'email address', 'player email', 'contact email'],
  jerseyNumber: [
    'jersey',
    'jersey number',
    'jersey #',
    'jersey no',
    'number',
    '#',
    'player number',
  ],
  skillLevel: [
    'skill',
    'skill level',
    'skilllevel',
    'player skill',
    'level',
    'caliber',
    'ability',
    'ability level',
  ],
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ')
}

function mapHeaders(headers: string[]): {
  firstName?: number
  lastName?: number
  email?: number
  jerseyNumber?: number
  skillLevel?: number
} {
  const mapped: {
    firstName?: number
    lastName?: number
    email?: number
    jerseyNumber?: number
    skillLevel?: number
  } = {}

  headers.forEach((header, index) => {
    const n = normalizeHeader(header)
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(n) && mapped[field as keyof typeof mapped] === undefined) {
        mapped[field as keyof typeof mapped] = index
      }
    }
  })

  return mapped
}

function truthyFlag(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase()
  return v === 'yes' || v === 'y' || v === 'true' || v === '1'
}

/** Minimal CSV parser supporting quoted fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch === '\r') {
      // skip
    } else {
      cell += ch
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0))
}

export function parseTeamlinktCsv(csvText: string): {
  rows: TeamlinktRow[]
  headers: string[]
  mapping: ReturnType<typeof mapHeaders>
  error?: string
} {
  // Strip BOM if present (common from Excel / TeamLinkt exports)
  const text = csvText.replace(/^\uFEFF/, '')
  const table = parseCsv(text)
  if (table.length < 2) {
    return { rows: [], headers: [], mapping: {}, error: 'CSV must include a header row and data' }
  }

  const headers = table[0]
  const mapping = mapHeaders(headers)
  if (mapping.firstName === undefined || mapping.lastName === undefined) {
    return {
      rows: [],
      headers,
      mapping,
      error:
        'Could not find First Name and Last Name columns. Expected TeamLinkt-style headers.',
    }
  }

  const hasPlayerCol = headers.some((h) => normalizeHeader(h) === 'player')
  const hasStatusCol = headers.some((h) => normalizeHeader(h) === 'status')

  const rows: TeamlinktRow[] = []
  for (let i = 1; i < table.length; i++) {
    const cells = table[i]
    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => {
      raw[h] = (cells[idx] ?? '').trim()
    })

    // Association members export: only import player rows that are active.
    if (hasPlayerCol && !truthyFlag(raw['Player'] ?? raw['player'])) {
      continue
    }
    if (hasStatusCol) {
      const status = (raw['Status'] ?? raw['status'] ?? '').trim().toLowerCase()
      if (status && status !== 'active') continue
    }

    const firstName = normalizeNamePart(cells[mapping.firstName] ?? '')
    const lastName = normalizeNamePart(cells[mapping.lastName] ?? '')
    const emailRaw =
      mapping.email !== undefined ? (cells[mapping.email] ?? '').trim() : ''
    const email = emailRaw ? normalizeEmail(emailRaw) : null

    let jerseyNumber: number | null = null
    if (mapping.jerseyNumber !== undefined) {
      const j = (cells[mapping.jerseyNumber] ?? '').trim()
      if (j) {
        const n = Number.parseInt(j.replace(/[^\d-]/g, ''), 10)
        if (!Number.isNaN(n)) jerseyNumber = n
      }
    }

    let skillLevel: SkillLevel | null = null
    if (mapping.skillLevel !== undefined) {
      skillLevel = parseSkillLevel(cells[mapping.skillLevel] ?? '')
    }

    if (!firstName && !lastName && !email) continue

    rows.push({
      rowNumber: i + 1,
      firstName,
      lastName,
      email,
      jerseyNumber,
      skillLevel,
      raw,
    })
  }

  return { rows, headers, mapping }
}

type MatchIndex = {
  emailToPlayerId: Map<string, string>
  nameToPlayerIds: Map<string, string[]>
  playersById: Map<
    string,
    {
      id: string
      firstName: string
      lastName: string
      rosterName: string
      jerseyNumber: number | null
      skillLevel: number | null
      isMerged: boolean
      emails: string[]
    }
  >
}

async function loadMatchIndex(): Promise<MatchIndex> {
  const db = getDb()
  const [playerRows, emailRows] = await Promise.all([
    db.select().from(players),
    db.select().from(playerEmails),
  ])

  const emailsByPlayer = new Map<string, string[]>()
  const emailToPlayerId = new Map<string, string>()
  for (const e of emailRows) {
    emailToPlayerId.set(e.email, e.playerId)
    const list = emailsByPlayer.get(e.playerId) ?? []
    list.push(e.email)
    emailsByPlayer.set(e.playerId, list)
  }

  const playersById = new Map<
    string,
    {
      id: string
      firstName: string
      lastName: string
      rosterName: string
      jerseyNumber: number | null
      skillLevel: number | null
      isMerged: boolean
      emails: string[]
    }
  >()
  const nameToPlayerIds = new Map<string, string[]>()

  for (const p of playerRows) {
    playersById.set(p.id, {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      rosterName: p.rosterName,
      jerseyNumber: p.jerseyNumber,
      skillLevel: p.skillLevel,
      isMerged: p.isMerged,
      emails: emailsByPlayer.get(p.id) ?? [],
    })
    if (p.isMerged) continue
    const key = nameKey(p.firstName, p.lastName)
    const list = nameToPlayerIds.get(key) ?? []
    list.push(p.id)
    nameToPlayerIds.set(key, list)
  }

  return { emailToPlayerId, nameToPlayerIds, playersById }
}

export async function previewTeamlinktImport(
  csvText: string
): Promise<{
  actions: ImportPreviewAction[]
  headers: string[]
  error?: string
}> {
  const parsed = parseTeamlinktCsv(csvText)
  if (parsed.error) {
    return { actions: [], headers: parsed.headers, error: parsed.error }
  }

  const index = await loadMatchIndex()
  const actions: ImportPreviewAction[] = []

  for (const row of parsed.rows) {
    if (!row.firstName || !row.lastName) {
      actions.push({
        action: 'skip',
        row,
        reason: 'Missing first or last name',
      })
      continue
    }

    let playerId: string | null = null
    if (row.email) {
      playerId = index.emailToPlayerId.get(row.email) ?? null
    }

    if (!playerId) {
      const byName = index.nameToPlayerIds.get(nameKey(row.firstName, row.lastName)) ?? []
      if (byName.length > 1) {
        actions.push({
          action: 'ambiguous',
          row,
          reason: 'Multiple players match this name; resolve manually or import with a unique email',
          playerIds: byName,
        })
        continue
      }
      if (byName.length === 1) {
        playerId = byName[0]
        if (row.email) {
          const emailOwner = index.emailToPlayerId.get(row.email)
          if (emailOwner && emailOwner !== playerId) {
            actions.push({
              action: 'ambiguous',
              row,
              reason: 'Name matches one player but email belongs to another',
              playerIds: [playerId, emailOwner],
            })
            continue
          }
        }
      }
    }

    if (!playerId) {
      actions.push({ action: 'create', row })
      continue
    }

    const existing = index.playersById.get(playerId)
    const notes: string[] = []
    if (!existing) {
      actions.push({ action: 'create', row })
      continue
    }
    if (existing.isMerged) {
      actions.push({
        action: 'skip',
        row,
        reason: 'Matched a merged player record',
      })
      continue
    }

    if (row.jerseyNumber != null && existing.jerseyNumber == null) {
      notes.push(`Set jersey #${row.jerseyNumber}`)
    }
    if (row.skillLevel != null && existing.skillLevel == null) {
      notes.push(`Set skill ${skillLevelLabel(row.skillLevel)} (${row.skillLevel})`)
    }
    if (row.email && !existing.emails.includes(row.email)) {
      notes.push(`Add email ${row.email}`)
    }
    const full = defaultRosterName(row.firstName, row.lastName)
    if (
      full.toLowerCase() !== existing.rosterName.toLowerCase() &&
      row.firstName.toLowerCase() !== existing.firstName.toLowerCase()
    ) {
      notes.push(`Add alias "${row.firstName}"`)
    }

    if (notes.length === 0) {
      actions.push({ action: 'skip', row, reason: 'Already up to date' })
    } else {
      actions.push({ action: 'update', row, playerId, notes })
    }
  }

  return { actions, headers: parsed.headers }
}

export async function commitTeamlinktImport(input: {
  csvText: string
  filename: string
  actor: string
}) {
  const preview = await previewTeamlinktImport(input.csvText)
  if (preview.error) {
    throw new Error(preview.error)
  }

  const db = getDb()
  const [batch] = await db
    .insert(importBatches)
    .values({
      filename: input.filename,
      actor: input.actor,
      rowCount: preview.actions.length,
      summary: {},
    })
    .returning()

  let created = 0
  let updated = 0
  let skipped = 0
  let ambiguous = 0
  const errors: string[] = []

  for (const item of preview.actions) {
    try {
      if (item.action === 'skip') {
        skipped++
        continue
      }
      if (item.action === 'ambiguous') {
        ambiguous++
        continue
      }

      if (item.action === 'create') {
        await createPlayer({
          firstName: item.row.firstName,
          lastName: item.row.lastName,
          jerseyNumber: item.row.jerseyNumber,
          skillLevel: item.row.skillLevel,
          email: item.row.email,
          actor: input.actor,
          source: 'import',
          importBatchId: batch.id,
        })
        created++
        continue
      }

      const snap = await getPlayerSnapshot(item.playerId)
      if (!snap || snap.isMerged) {
        skipped++
        continue
      }

      const patch: { jerseyNumber?: number | null; skillLevel?: number | null } = {}
      if (item.row.jerseyNumber != null && snap.jerseyNumber == null) {
        patch.jerseyNumber = item.row.jerseyNumber
      }
      if (item.row.skillLevel != null && snap.skillLevel == null) {
        patch.skillLevel = item.row.skillLevel
      }
      if (Object.keys(patch).length > 0) {
        await updatePlayer(item.playerId, patch, {
          actor: input.actor,
          source: 'import',
          importBatchId: batch.id,
        })
      }

      if (item.row.email) {
        await ensurePlayerEmail(item.playerId, item.row.email, {
          actor: input.actor,
          importBatchId: batch.id,
        })
      }

      if (item.row.firstName.toLowerCase() !== snap.firstName.toLowerCase()) {
        await ensurePlayerAlias(item.playerId, item.row.firstName, {
          actor: input.actor,
          importBatchId: batch.id,
        })
      }

      updated++
    } catch (err) {
      errors.push(
        `Row ${item.row.rowNumber}: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  const summary = { created, updated, skipped, ambiguous, errors }
  await db.update(importBatches).set({ summary }).where(eq(importBatches.id, batch.id))

  return { batchId: batch.id, summary, actions: preview.actions }
}
