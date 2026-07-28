'use client'

import { useEffect, useState } from 'react'
import {
  SKILL_VIEW_MODES,
  SKILL_VIEW_MODE_LABELS,
  SKILL_VIEW_MODE_STORAGE_KEY,
  isValidSkillViewMode,
  type SkillViewMode,
} from '@/app/lib/players/skill'
import { Tooltip } from '@/app/components/ui'

function readStoredSkillViewMode(): SkillViewMode {
  if (typeof window === 'undefined') return 'linear'
  try {
    const raw = window.localStorage.getItem(SKILL_VIEW_MODE_STORAGE_KEY)
    if (isValidSkillViewMode(raw)) return raw
  } catch {
    // ignore storage errors
  }
  return 'linear'
}

export function useSkillViewMode(): [SkillViewMode, (mode: SkillViewMode) => void] {
  const [mode, setModeState] = useState<SkillViewMode>('linear')

  useEffect(() => {
    setModeState(readStoredSkillViewMode())
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SKILL_VIEW_MODE_STORAGE_KEY, mode)
    } catch {
      // ignore storage errors
    }
  }, [mode])

  return [mode, setModeState]
}

export function SkillViewModeToggle(props: {
  mode: SkillViewMode
  onChange: (mode: SkillViewMode) => void
  className?: string
}) {
  const { mode, onChange, className } = props
  return (
    <label
      className={`inline-flex items-center gap-2 text-sm text-gray-700 ${className ?? ''}`}
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        Skill view
        <Tooltip
          label="About skill view"
          content="Controls how skill is shown in lists and drafts: Linear (1–100), Fibonacci, or by skill area when set."
        />
      </span>
      <select
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        value={mode}
        onChange={(e) => {
          const next = e.target.value
          if (isValidSkillViewMode(next)) onChange(next)
        }}
        aria-label="Skill view mode"
      >
        {SKILL_VIEW_MODES.map((m) => (
          <option key={m} value={m}>
            {SKILL_VIEW_MODE_LABELS[m]}
          </option>
        ))}
      </select>
    </label>
  )
}
