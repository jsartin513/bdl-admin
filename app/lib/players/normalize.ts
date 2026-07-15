export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeNamePart(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeAlias(alias: string): string {
  return alias.trim().replace(/\s+/g, ' ')
}

export function nameKey(firstName: string, lastName: string): string {
  return `${normalizeNamePart(firstName).toLowerCase()}|${normalizeNamePart(lastName).toLowerCase()}`
}
