'use client'

import { useEffect, useState } from 'react'
import {
  FIB_SKILL_LEVELS,
  LINEAR_SKILL_MAX,
  LINEAR_SKILL_MIN,
  SKILL_AREA_KEYS,
  SKILL_AREA_LABELS,
  SKILL_LEVELS,
  type SkillAreas,
} from '@/app/lib/players/skill'
import { FieldHelp, Tooltip } from '@/app/components/ui'

export type SkillFieldsValue = {
  skillLevel: string
  skillLevelFib: string
  skillAreas: Record<(typeof SKILL_AREA_KEYS)[number], string>
}

export function emptySkillFieldsValue(): SkillFieldsValue {
  return {
    skillLevel: '',
    skillLevelFib: '',
    skillAreas: {
      offense: '',
      defense: '',
      stayingAlive: '',
      courtPresence: '',
    },
  }
}

export function skillFieldsFromPlayer(player: {
  skillLevel: number | null
  skillLevelFib?: number | null
  skillAreas?: SkillAreas | null
}): SkillFieldsValue {
  return {
    skillLevel: player.skillLevel != null ? String(player.skillLevel) : '',
    skillLevelFib: player.skillLevelFib != null ? String(player.skillLevelFib) : '',
    skillAreas: {
      offense:
        player.skillAreas?.offense != null ? String(player.skillAreas.offense) : '',
      defense:
        player.skillAreas?.defense != null ? String(player.skillAreas.defense) : '',
      stayingAlive:
        player.skillAreas?.stayingAlive != null
          ? String(player.skillAreas.stayingAlive)
          : '',
      courtPresence:
        player.skillAreas?.courtPresence != null
          ? String(player.skillAreas.courtPresence)
          : '',
    },
  }
}

export function skillFieldsToPatch(fields: SkillFieldsValue): {
  skillLevel: number | null
  skillLevelFib: number | null
  skillAreas: SkillAreas | null
} {
  const skillLevel = fields.skillLevel === '' ? null : Number(fields.skillLevel)
  const skillLevelFib =
    fields.skillLevelFib === '' ? null : Number(fields.skillLevelFib)

  const areas: SkillAreas = {
    offense: fields.skillAreas.offense === '' ? null : Number(fields.skillAreas.offense),
    defense: fields.skillAreas.defense === '' ? null : Number(fields.skillAreas.defense),
    stayingAlive:
      fields.skillAreas.stayingAlive === ''
        ? null
        : Number(fields.skillAreas.stayingAlive),
    courtPresence:
      fields.skillAreas.courtPresence === ''
        ? null
        : Number(fields.skillAreas.courtPresence),
  }
  const skillAreas = SKILL_AREA_KEYS.every((k) => areas[k] == null) ? null : areas

  return { skillLevel, skillLevelFib, skillAreas }
}

function hasAlternateSkillData(value: SkillFieldsValue): boolean {
  if (value.skillLevelFib !== '') return true
  return SKILL_AREA_KEYS.some((key) => value.skillAreas[key] !== '')
}

export function SkillFieldsEditor(props: {
  value: SkillFieldsValue
  onChange: (next: SkillFieldsValue) => void
  disabled?: boolean
  idPrefix?: string
}) {
  const { value, onChange, disabled, idPrefix = 'skill' } = props
  const mainHint =
    value.skillLevel !== '' ? value.skillLevel : 'main normal skill'
  const [moreSystemsOpen, setMoreSystemsOpen] = useState(() =>
    hasAlternateSkillData(value)
  )

  useEffect(() => {
    if (hasAlternateSkillData(value)) setMoreSystemsOpen(true)
  }, [value])

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={`${idPrefix}-linear`}
          className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700"
        >
          Normal skill (1–100)
          <Tooltip
            label="About normal skill"
            content="Primary 1–100 rating used for drafting and filters. Presets map common labels (e.g. Intermediate) to a number."
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={`${idPrefix}-linear`}
            type="number"
            min={LINEAR_SKILL_MIN}
            max={LINEAR_SKILL_MAX}
            className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            value={value.skillLevel}
            disabled={disabled}
            placeholder="e.g. 40"
            aria-describedby={`${idPrefix}-linear-help`}
            onChange={(e) => onChange({ ...value, skillLevel: e.target.value })}
          />
          <select
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            value=""
            disabled={disabled}
            aria-label="Set normal skill preset"
            onChange={(e) => {
              if (!e.target.value) return
              onChange({ ...value, skillLevel: e.target.value })
            }}
          >
            <option value="">Presets…</option>
            {Object.entries(SKILL_LEVELS).map(([v, label]) => (
              <option key={v} value={v}>
                {v} — {label}
              </option>
            ))}
          </select>
        </div>
        <FieldHelp id={`${idPrefix}-linear-help`}>
          Use presets for common levels, or type any value from 1–100.
        </FieldHelp>
      </div>

      <details
        open={moreSystemsOpen}
        onToggle={(e) => setMoreSystemsOpen(e.currentTarget.open)}
        className="rounded border border-gray-200"
      >
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          More skill systems
        </summary>
        <div className="space-y-3 border-t border-gray-200 px-3 py-3">
          <div>
            <label
              htmlFor={`${idPrefix}-fib`}
              className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700"
            >
              Fibonacci skill
              <Tooltip
                label="About Fibonacci skill"
                content="Optional coarser skill scale (Fibonacci numbers). Used when Skill view is set to Fibonacci."
              />
            </label>
            <select
              id={`${idPrefix}-fib`}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              value={value.skillLevelFib}
              disabled={disabled}
              aria-describedby={`${idPrefix}-fib-help`}
              onChange={(e) => onChange({ ...value, skillLevelFib: e.target.value })}
            >
              <option value="">Unset</option>
              {FIB_SKILL_LEVELS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <FieldHelp id={`${idPrefix}-fib-help`}>
              Leave unset if you only track normal skill.
            </FieldHelp>
          </div>

          <fieldset className="rounded border border-gray-200 p-3">
            <legend className="inline-flex items-center gap-1.5 px-1 text-sm font-medium text-gray-700">
              Skill areas
              <Tooltip
                label="About skill areas"
                content="Break out offense, defense, staying alive, and court presence. Blank areas fall back to the main normal skill."
              />
            </legend>
            <FieldHelp className="mb-2 mt-0">
              Leave blank to use the main normal skill ({mainHint}).
            </FieldHelp>
            <div className="grid gap-2 sm:grid-cols-2">
              {SKILL_AREA_KEYS.map((key) => (
                <label key={key} className="block text-sm text-gray-700">
                  <span className="mb-1 block">{SKILL_AREA_LABELS[key]}</span>
                  <input
                    type="number"
                    min={LINEAR_SKILL_MIN}
                    max={LINEAR_SKILL_MAX}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={value.skillAreas[key]}
                    disabled={disabled}
                    placeholder={`Default: ${mainHint}`}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        skillAreas: { ...value.skillAreas, [key]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>
    </div>
  )
}
