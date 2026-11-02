import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as sensitiveSchema from '@/app/db/sensitive-schema'

let _db: ReturnType<typeof drizzle<typeof sensitiveSchema>> | null = null

export function isSensitiveDatabaseConfigured(): boolean {
  return Boolean(process.env.SENSITIVE_DATABASE_URL?.trim())
}

export function getSensitiveDb() {
  const url = process.env.SENSITIVE_DATABASE_URL?.trim()
  if (!url) {
    throw new Error('SENSITIVE_DATABASE_URL is not configured')
  }
  if (!_db) {
    const sql = neon(url)
    _db = drizzle(sql, { schema: sensitiveSchema })
  }
  return _db
}
