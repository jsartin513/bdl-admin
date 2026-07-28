'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type TooltipProps = {
  content: ReactNode
  children?: ReactNode
  /** Accessible name for the default "?" trigger when children are omitted. */
  label?: string
  className?: string
}

/**
 * Keyboard-accessible tooltip. Hover or focus to show; Escape to dismiss.
 * Prefer this over native `title` for meaningful help content.
 */
export function Tooltip({
  content,
  children,
  label = 'More information',
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const tipId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  const trigger = children ?? (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[10px] font-semibold leading-none text-gray-600"
      aria-hidden="true"
    >
      ?
    </span>
  )

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex items-center align-middle ${className ?? ''}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex cursor-help items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget as Node)) {
            close()
          }
        }}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1 w-max max-w-xs -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-left text-xs font-normal text-white shadow-lg"
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}
