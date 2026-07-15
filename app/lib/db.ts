import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '@/app/db/schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (!_db) {
    const sql = neon(url)
    _db = drizzle(sql, { schema })
  }
  return _db
}
