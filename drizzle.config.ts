import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config({ path: '.env.local' })
config()

export default defineConfig({
  schema: './app/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: (() => {
      const url = process.env.DATABASE_URL
      if (!url) throw new Error('DATABASE_URL environment variable is not set')
      return url
    })(),
  },
})
