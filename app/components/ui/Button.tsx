import type { ButtonHTMLAttributes } from 'react'
import { FOCUS_RING } from './focusRing'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'outline'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40',
  secondary:
    'border border-[var(--tm-border,#d1d5db)] bg-[var(--tm-surface,#fff)] text-[var(--tm-fg,#111827)] hover:bg-[var(--tm-surface-2,#f9fafb)] disabled:opacity-40',
  outline:
    'border border-blue-600 bg-transparent text-blue-700 hover:bg-blue-50 disabled:opacity-40',
  danger:
    'border border-red-300 bg-transparent text-red-700 hover:bg-red-50 disabled:opacity-40',
  ghost:
    'bg-transparent text-[var(--tm-muted,#4b5563)] hover:underline disabled:opacity-40',
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded px-3 py-2 text-sm md:min-h-9 ${FOCUS_RING} ${VARIANT_CLASS[variant]} ${className ?? ''}`.trim()}
      {...props}
    />
  )
}
