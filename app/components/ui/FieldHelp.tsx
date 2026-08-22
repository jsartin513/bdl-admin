import type { ReactNode } from 'react'

type FieldHelpProps = {
  children: ReactNode
  id?: string
  className?: string
}

/**
 * Inline help text under a form control.
 * Pass the same `id` to the control's `aria-describedby` when wiring a11y.
 */
export function FieldHelp({ children, id, className }: FieldHelpProps) {
  return (
    <p
      id={id}
      className={`mt-1 text-xs text-[var(--tm-muted,#4b5563)] ${className ?? ''}`.trim()}
    >
      {children}
    </p>
  )
}
