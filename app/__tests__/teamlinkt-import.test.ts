import { describe, expect, it } from 'vitest'
import { parseCsv, parseTeamlinktCsv } from '@/app/lib/players/teamlinkt-import'
import { parseSkillLevel } from '@/app/lib/players/skill'

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

  it('parses Excel floats and composite labels', () => {
    expect(parseSkillLevel('2.0')).toBe(2)
    expect(parseSkillLevel('3.0')).toBe(3)
    expect(parseSkillLevel('2 - Intermediate')).toBe(2)
    expect(parseSkillLevel('Intermediate (2)')).toBe(2)
    expect(parseSkillLevel('Level 3')).toBe(3)
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
    })
    expect(parsed.rows[1].email).toBeNull()
    expect(parsed.rows[1].jerseyNumber).toBeNull()
    expect(parsed.warnings.some((w) => /Skill/.test(w))).toBe(true)
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
    expect(parsed.warnings).toEqual([])
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
    })
    expect(parsed.warnings.some((w) => /No Skill/.test(w))).toBe(true)
  })

  it('strips a UTF-8 BOM from TeamLinkt exports', () => {
    const csv = '\uFEFFFirst Name,Last Name,Email\nJess,Sartin,jess@example.com\n'
    const parsed = parseTeamlinktCsv(csv)
    expect(parsed.error).toBeUndefined()
    expect(parsed.rows[0].firstName).toBe('Jess')
  })
})
