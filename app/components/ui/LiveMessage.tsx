import type { ReactNode } from 'react'

type LiveMessageProps = {
  children: ReactNode
  /** `alert` for errors (assertive); `status` for success/loading (polite). */
  variant?: 'alert' | 'status'
  className?: string
}

/**
 * Announces dynamic feedback to assistive tech via aria-live regions.
 */
export function LiveMessage({
  children,
  variant = 'status',
  className,
}: LiveMessageProps) {
  const role = variant === 'alert' ? 'alert' : 'status'
  const live = variant === 'alert' ? 'assertive' : 'polite'

  return (
    <p
      role={role}
      aria-live={live}
      className={className}
    >
      {children}
    </p>
  )
}
