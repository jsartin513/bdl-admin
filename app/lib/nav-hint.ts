export type NavHint = {
  title: string
  description: string
}

/** Plain-text label for accessible descriptions (title + explanation). */
export function navHintAccessibleText({ title, description }: NavHint): string {
  return `${title}. ${description}`
}
