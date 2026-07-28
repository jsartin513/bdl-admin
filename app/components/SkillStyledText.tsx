'use client'

import type { ReactNode } from 'react'
import {
  skillStyleKind,
  type SkillViewMode,
} from '@/app/lib/players/skill'

export function SkillStyledText(props: {
  score: number | null
  mode: SkillViewMode
  children: ReactNode
}) {
  const kind = skillStyleKind(props.score, props.mode)
  if (kind === 'beginner') {
    return <span className="italic">({props.children})</span>
  }
  if (kind === 'advanced') {
    return <span className="font-bold">{props.children}</span>
  }
  if (kind === 'worlds') {
    return <span className="font-bold underline">{props.children}</span>
  }
  return <span>{props.children}</span>
}
