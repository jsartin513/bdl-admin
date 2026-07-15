import { describe, expect, it } from 'vitest'
import { parseCsv, parseTeamlinktCsv } from '@/app/lib/players/teamlinkt-import'

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
    })
    expect(parsed.rows[1].email).toBeNull()
    expect(parsed.rows[1].jerseyNumber).toBeNull()
  })

  it('errors when name columns are missing', () => {
    const parsed = parseTeamlinktCsv('Email\na@b.com\n')
    expect(parsed.error).toMatch(/First Name/)
  })
})
