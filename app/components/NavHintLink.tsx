'use client'

import Link from 'next/link'
import {
  useId,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import type { NavHint } from '@/app/lib/nav-hint'

export type { NavHint } from '@/app/lib/nav-hint'

export function NavHintTooltipBody({ title, description }: NavHint) {
  return (
    <>
      <span className="block font-semibold text-white">{title}</span>
      <span className="mt-0.5 block font-normal text-gray-200">
        {description}
      </span>
    </>
  )
}

type NavHintLinkProps = NavHint & {
  href: string
  className?: string
  children: ReactNode
  onClick?: () => void
}

function isAppRelativeHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

/**
 * Nav link with title + description on hover and keyboard focus.
 */
export function NavHintLink({
  href,
  className,
  title,
  description,
  children,
  onClick,
}: NavHintLinkProps) {
  const tipId = useId()
  const [open, setOpen] = useState(false)
  const hintProps = {
    className,
    'aria-describedby': open ? tipId : undefined,
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    onClick,
  }

  return (
    <span
      className="relative inline-flex max-w-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {isAppRelativeHref(href) ? (
        <Link href={href} {...hintProps}>
          {children}
        </Link>
      ) : (
        <a href={href} {...hintProps}>
          {children}
        </a>
      )}
      <span
        id={tipId}
        role="tooltip"
        hidden={!open}
        className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-1 w-max max-w-xs -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-left text-xs shadow-lg"
      >
        <NavHintTooltipBody title={title} description={description} />
      </span>
    </span>
  )
}

type NavHintButtonProps = NavHint & {
  className?: string
  children: ReactNode
  onClick?: () => void
  'aria-expanded'?: boolean
  'aria-haspopup'?: boolean | 'true' | 'false' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
  'aria-controls'?: string
  'aria-label'?: string
  buttonRef?: RefObject<HTMLButtonElement | null>
}

/** Dropdown trigger with the same hover/focus hint behavior as NavHintLink. */
export function NavHintButton({
  title,
  description,
  className,
  children,
  onClick,
  buttonRef,
  ...aria
}: NavHintButtonProps) {
  const tipId = useId()
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        className={className}
        aria-describedby={open ? tipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={onClick}
        {...aria}
      >
        {children}
      </button>
      <span
        id={tipId}
        role="tooltip"
        hidden={!open}
        className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-1 w-max max-w-xs -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-left text-xs shadow-lg"
      >
        <NavHintTooltipBody title={title} description={description} />
      </span>
    </span>
  )
}
