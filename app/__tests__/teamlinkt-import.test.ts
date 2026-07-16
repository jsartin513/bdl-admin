import { describe, expect, it } from 'vitest'
import {
  parseCsv,
  parseTeamlinktCsv,
  playerIdForRegistration,
  shouldApplyProfileField,
  summarizeRegistrationPreview,
  type ImportPreviewAction,
  type TeamlinktRow,
} from '@/app/lib/players/teamlinkt-import'
import {
  defaultJerseyName,
  defaultNickname,
  normalizeStoredJerseyName,
  normalizeStoredNickname,
  parseSkillLevel,
  resolveJerseyName,
  resolveNickname,
} from '@/app/lib/players/skill'
import { genderGroup, parseGender } from '@/app/lib/players/gender'

function sampleRow(overrides: Partial<TeamlinktRow> = {}): TeamlinktRow {
  return {
    rowNumber: 2,
    firstName: 'Jess',
    lastName: 'Sartin',
    email: 'jess@example.com',
    jerseyNumber: null,
    skillLevel: null,
    gender: null,
    raw: {},
    ...overrides,
  }
}

describe('parseSkillLevel', () => {
  it('maps intermediate/advanced and numeric levels', () => {
    expect(parseSkillLevel('2')).toBe(2)
    expect(parseSkillLevel('Intermediate')).toBe(2)
    expect(parseSkillLevel('3')).toBe(3)
    expect(parseSkillLevel('advanced')).toBe(3)
    expect(parseSkillLevel('Beginner')).toBe(1)
    expect(parseSkillLevel('Worlds level')).toBe(4)
    expect(parseSkillLevel('')).toBeNull()
    expect(parseSkillLevel('unknown')).toBeNull()
  })
})

describe('nickname defaults', () => {
  it('builds first name + last initial', () => {
    expect(defaultNickname('Jess', 'Sartin')).toBe('Jess S')
    expect(defaultNickname('alex', 'player')).toBe('alex P')
  })

  it('uses custom nickname until cleared back to default', () => {
    expect(resolveNickname(null, 'Jess', 'Sartin')).toBe('Jess S')
    expect(resolveNickname('JC', 'Jess', 'Sartin')).toBe('JC')
    expect(normalizeStoredNickname('Jess S', 'Jess', 'Sartin')).toBeNull()
    expect(normalizeStoredNickname('JC', 'Jess', 'Sartin')).toBe('JC')
    expect(normalizeStoredNickname('', 'Jess', 'Sartin')).toBeNull()
  })
})

describe('jersey name defaults', () => {
  it('defaults to last name and stores custom overrides', () => {
    expect(defaultJerseyName('Sartin')).toBe('Sartin')
    expect(resolveJerseyName(null, 'Sartin')).toBe('Sartin')
    expect(resolveJerseyName('Jet', 'Sartin')).toBe('Jet')
    expect(normalizeStoredJerseyName('Sartin', 'Sartin')).toBeNull()
    expect(normalizeStoredJerseyName('Jet', 'Sartin')).toBe('Jet')
  })
})

describe('parseGender', () => {
  it('maps TeamLinkt gender labels', () => {
    expect(parseGender('Female')).toBe('woman')
    expect(parseGender('Male')).toBe('man')
    expect(parseGender('Other')).toBe('other')
    expect(parseGender('Cisgender Woman')).toBe('woman')
    expect(parseGender('Non-binary')).toBe('nonbinary')
    expect(parseGender('')).toBeNull()
  })

  it('groups woman/nonbinary/other together', () => {
    expect(genderGroup('woman')).toBe('w_nb_o')
    expect(genderGroup('nonbinary')).toBe('w_nb_o')
    expect(genderGroup('other')).toBe('w_nb_o')
    expect(genderGroup('man')).toBe('men')
    expect(genderGroup(null)).toBe('unset')
  })
})

describe('shouldApplyProfileField', () => {
  it('skips profile fields by default mode', () => {
    expect(shouldApplyProfileField(3, null, 'skip')).toBe(false)
    expect(shouldApplyProfileField(3, 2, 'skip')).toBe(false)
  })

  it('fill_blank only applies when existing is unset', () => {
    expect(shouldApplyProfileField(3, null, 'fill_blank')).toBe(true)
    expect(shouldApplyProfileField(3, 2, 'fill_blank')).toBe(false)
    expect(shouldApplyProfileField(null, null, 'fill_blank')).toBe(false)
  })

  it('overwrite replaces differing existing values', () => {
    expect(shouldApplyProfileField(3, null, 'overwrite')).toBe(true)
    expect(shouldApplyProfileField(3, 2, 'overwrite')).toBe(true)
    expect(shouldApplyProfileField(3, 3, 'overwrite')).toBe(false)
  })
})

describe('teamlinkt csv parse', () => {
  it('parses quoted CSV fields', () => {
    const rows = parseCsv('a,b\n"1,2",3\n')
    expect(rows).toEqual([
      ['a', 'b'],
      ['1,2', '3'],
    ])
  })

  it('maps TeamLinkt-style headers', () => {
    const csv = [
      'First Name,Last Name,Email,Jersey Number',
      'Jess,Sartin,jess@example.com,7',
      'Alex,Player,,',
    ].join('\n')

    const parsed = parseTeamlinktCsv(csv)
    expect(parsed.error).toBeUndefined()
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0]).toMatchObject({
      firstName: 'Jess',
      lastName: 'Sartin',
      email: 'jess@example.com',
      jerseyNumber: 7,
      skillLevel: null,
      gender: null,
    })
    expect(parsed.rows[1].email).toBeNull()
    expect(parsed.rows[1].jerseyNumber).toBeNull()
  })

  it('maps skill level from CSV labels or numbers', () => {
    const csv = [
      'First Name,Last Name,Email,Skill Level',
      'Jess,Sartin,jess@example.com,2',
      'Alex,Player,alex@example.com,Advanced',
      'Sam,Beginner,sam@example.com,Intermediate',
    ].join('\n')

    const parsed = parseTeamlinktCsv(csv)
    expect(parsed.error).toBeUndefined()
    expect(parsed.rows).toHaveLength(3)
    expect(parsed.rows[0].skillLevel).toBe(2)
    expect(parsed.rows[1].skillLevel).toBe(3)
    expect(parsed.rows[2].skillLevel).toBe(2)
  })

  it('errors when name columns are missing', () => {
    const parsed = parseTeamlinktCsv('Email\na@b.com\n')
    expect(parsed.error).toMatch(/First Name/)
  })

  it('parses association members export and keeps active players only', () => {
    const csv = [
      'First Name,Last Name,Player,Coach,Official,Volunteer,Gender,Birthdate,City,Email,Phone,Health Insurance ID,Emergency Contact Name,Emergency Contact Phone,Member Since,Status',
      'Abby,Lee,Yes,No,No,No,Female,June 5 1993,Boston,lee@example.com,(949) 742-1789,,Bradford Lee,(949) 232-2403,August 24 2025,active',
      'Skip,Me,No,Yes,No,No,Female,June 5 1993,Boston,coach@example.com,,,,,,active',
      'Gone,Away,Yes,No,No,No,Female,June 5 1993,Boston,old@example.com,,,,,,inactive',
    ].join('\n')

    const parsed = parseTeamlinktCsv(csv)
    expect(parsed.error).toBeUndefined()
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0]).toMatchObject({
      firstName: 'Abby',
      lastName: 'Lee',
      email: 'lee@example.com',
      gender: 'woman',
    })
    // Birthdate is in raw CSV but not mapped onto the player row
    expect(parsed.rows[0]).not.toHaveProperty('birthdate')
  })

  it('strips a UTF-8 BOM from TeamLinkt exports', () => {
    const csv = '\uFEFFFirst Name,Last Name,Email\nJess,Sartin,jess@example.com\n'
    const parsed = parseTeamlinktCsv(csv)
    expect(parsed.error).toBeUndefined()
    expect(parsed.rows[0].firstName).toBe('Jess')
  })
})

describe('event-scoped registration preview', () => {
  it('resolves player ids for update and matched skip rows', () => {
    const update: ImportPreviewAction = {
      action: 'update',
      row: sampleRow(),
      playerId: 'p1',
      notes: ['Add email'],
    }
    const matchedSkip: ImportPreviewAction = {
      action: 'skip',
      row: sampleRow({ rowNumber: 3 }),
      reason: 'Already up to date',
      playerId: 'p2',
    }
    const create: ImportPreviewAction = {
      action: 'create',
      row: sampleRow({ rowNumber: 4 }),
    }
    const ambiguous: ImportPreviewAction = {
      action: 'ambiguous',
      row: sampleRow({ rowNumber: 5 }),
      reason: 'Multiple players',
      playerIds: ['a', 'b'],
    }

    expect(playerIdForRegistration(update)).toBe('p1')
    expect(playerIdForRegistration(matchedSkip)).toBe('p2')
    expect(playerIdForRegistration(create)).toBeNull()
    expect(playerIdForRegistration(ambiguous)).toBeNull()
    expect(
      playerIdForRegistration({
        action: 'skip',
        row: sampleRow({ rowNumber: 8 }),
        reason: 'Matched a merged player record',
        playerId: 'merged-p',
        excludeFromRegistration: true,
      })
    ).toBeNull()
  })

  it('counts new vs already-registered players for event imports', () => {
    const actions: ImportPreviewAction[] = [
      { action: 'create', row: sampleRow() },
      {
        action: 'update',
        row: sampleRow({ rowNumber: 3, firstName: 'Alex' }),
        playerId: 'existing-new',
        notes: ['Add email'],
      },
      {
        action: 'skip',
        row: sampleRow({ rowNumber: 4, firstName: 'Sam' }),
        reason: 'Already up to date',
        playerId: 'already-on-event',
      },
      {
        action: 'skip',
        row: sampleRow({ rowNumber: 5, firstName: 'Pat' }),
        reason: 'Already up to date',
        playerId: 'already-on-event',
      },
      {
        action: 'ambiguous',
        row: sampleRow({ rowNumber: 6 }),
        reason: 'dup',
        playerIds: ['x', 'y'],
      },
      {
        action: 'skip',
        row: sampleRow({ rowNumber: 7 }),
        reason: 'Missing first or last name',
      },
    ]

    const summary = summarizeRegistrationPreview(
      actions,
      new Set(['already-on-event'])
    )
    expect(summary).toEqual({ register: 2, alreadyRegistered: 1 })
  })

  it('without event-linked players treats matched skips as new registrations', () => {
    const actions: ImportPreviewAction[] = [
      {
        action: 'skip',
        row: sampleRow(),
        reason: 'Already up to date',
        playerId: 'p1',
      },
    ]
    expect(summarizeRegistrationPreview(actions, new Set())).toEqual({
      register: 1,
      alreadyRegistered: 0,
    })
  })
})
