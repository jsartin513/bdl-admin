'use client'

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const PREFERRED_FOCUS =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  /** Extra classes for the panel. */
  className?: string
  /** When false, backdrop click does not close (Escape still does unless closeOnEscape is false). */
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
}

function getInitialFocus(panel: HTMLElement): HTMLElement {
  const preferred = panel.querySelector<HTMLElement>(PREFERRED_FOCUS)
  if (preferred) return preferred
  const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE)
  return focusables[0] ?? panel
}

/**
 * Accessible modal dialog with focus trap, Escape/backdrop dismiss, and focus restore.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const closeOnEscapeRef = useRef(closeOnEscape)

  useEffect(() => {
    onCloseRef.current = onClose
    closeOnEscapeRef.current = closeOnEscape
  })

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    if (panel) {
      getInitialFocus(panel).focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscapeRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)

      if (focusables.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus?.()
      previouslyFocused.current = null
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-4 shadow-xl focus:outline-none ${className ?? 'max-w-lg'}`.trim()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
