'use client'

import {
  FIB_SKILL_LEVELS,
  LINEAR_SKILL_MAX,
  LINEAR_SKILL_MIN,
  SKILL_AREA_KEYS,
  SKILL_AREA_LABELS,
  SKILL_LEVELS,
  type SkillAreas,
} from '@/app/lib/players/skill'

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

export function SkillFieldsEditor(props: {
  value: SkillFieldsValue
  onChange: (next: SkillFieldsValue) => void
  disabled?: boolean
  idPrefix?: string
}) {
  const { value, onChange, disabled, idPrefix = 'skill' } = props
  const mainHint =
    value.skillLevel !== '' ? value.skillLevel : 'main linear skill'

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={`${idPrefix}-linear`}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Linear skill (1–100)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={`${idPrefix}-linear`}
            type="number"
            min={LINEAR_SKILL_MIN}
            max={LINEAR_SKILL_MAX}
            className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={value.skillLevel}
            disabled={disabled}
            placeholder="e.g. 40"
            onChange={(e) => onChange({ ...value, skillLevel: e.target.value })}
          />
          <select
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            value=""
            disabled={disabled}
            aria-label="Set linear skill preset"
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
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-fib`}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Fibonacci skill
        </label>
        <select
          id={`${idPrefix}-fib`}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          value={value.skillLevelFib}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, skillLevelFib: e.target.value })}
        >
          <option value="">Unset</option>
          {FIB_SKILL_LEVELS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium text-gray-700">
          Skill areas
        </legend>
        <p className="mb-2 text-xs text-gray-500">
          Leave blank to use the main linear skill ({mainHint}).
        </p>
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
  )
}
