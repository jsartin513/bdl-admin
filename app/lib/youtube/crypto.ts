import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'

function getTokenSecret(): Buffer {
  const raw =
    process.env.YOUTUBE_TOKEN_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim()
  if (!raw) {
    throw new Error('YOUTUBE_TOKEN_SECRET or ADMIN_SESSION_SECRET is required')
  }
  return createHash('sha256').update(raw).digest()
}

/** Encrypt a refresh token for DB storage. Format: iv.tag.ciphertext (base64url). */
export function encryptSecret(plaintext: string): string {
  const key = getTokenSecret()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted secret format')
  }
  const key = getTokenSecret()
  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const data = Buffer.from(dataB64, 'base64url')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
