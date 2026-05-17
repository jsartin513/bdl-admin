'use client'

import { useState } from 'react'
import { getConfigs, describeConfig, sizeLabel } from './splits'

// ── Types & constants ─────────────────────────────────────────────────────

type Tab =
  | 'Team Splits'
  | '2 Teams'
  | '3 Teams'
  | '4 Teams'
  | '5 Teams'
  | '6 Teams'
  | 'Attendance'

const TABS: Tab[] = [
  'Team Splits',
  '2 Teams',
  '3 Teams',
  '4 Teams',
  '5 Teams',
  '6 Teams',
  'Attendance',
]

const ROTATION_META: Record<number, { range: string; perfect: string }> = {
  2: { range: '10–16', perfect: '10 · 12 · 14 · 16' },
  3: { range: '15–24', perfect: '15 · 18 · 21 · 24' },
  4: { range: '20–32', perfect: '20 · 24 · 28 · 32' },
  5: { range: '25–40', perfect: '25 · 30 · 35 · 40' },
  6: { range: '30–48', perfect: '30 · 36 · 42 · 48' },
}

// ── Team splits view ──────────────────────────────────────────────────────

function TeamSplitsView() {
  const [input, setInput] = useState('24')
  const n = parseInt(input, 10)
  const valid = !isNaN(n) && n >= 10 && n <= 48
  const configs = valid ? getConfigs(n) : []
  const best = configs[0] ?? null

  const tableRows = Array.from({ length: 39 }, (_, i) => {
    const pn = i + 10
    return { pn, rec: getConfigs(pn)[0] ?? null }
  })

  return (
    <div className="space-y-8">
      {/* Size legend */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { size: '5v5', note: 'Minimizes rest time' },
            { size: '6v6', note: 'Normal — preferred' },
            { size: '7v7', note: 'Doable' },
            { size: '8v8', note: 'Acceptable' },
          ] as const
        ).map(({ size, note }) => (
          <div key={size} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="font-bold text-lg text-gray-900">{size}</div>
            <div className="text-sm text-gray-500">{note}</div>
          </div>
        ))}
      </div>

      {/* Interactive finder */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Find split for tonight</h2>
        <div className="flex items-center gap-3 mb-4">
          <label htmlFor="player-count" className="text-gray-700 font-medium">Players tonight:</label>
          <input
            id="player-count"
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            min={10}
            max={48}
            className="w-24 border border-gray-300 rounded px-3 py-1.5 text-gray-900"
          />
          {input !== '' && !valid && (
            <span className="text-sm text-gray-400">Enter a number 10–48</span>
          )}
        </div>

        {valid && configs.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
            No valid split for {n} players with teams of 5–8.
          </div>
        )}

        {valid && best && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Recommended split', value: describeConfig(best) },
              { label: 'Game format', value: sizeLabel(best) },
              { label: 'Schedule rotation', value: `${best.numTeams}-team` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className="font-semibold text-gray-900">{value}</div>
              </div>
            ))}
          </div>
        )}

        {valid && configs.length > 1 && (
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                {['Teams', 'Split', 'Format', 'Notes'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {configs.map((c, i) => (
                <tr key={c.numTeams} className={i === 0 ? 'bg-green-50' : 'even:bg-gray-50'}>
                  <td className="px-3 py-2">{c.numTeams}</td>
                  <td className="px-3 py-2">{describeConfig(c)}</td>
                  <td className="px-3 py-2">{sizeLabel(c)}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {i === 0
                      ? 'Recommended'
                      : c.numTeams > (best?.numTeams ?? 0)
                        ? 'More teams, less rest'
                        : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reference table */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Reference — 10 to 48 players</h2>
        <p className="text-sm text-gray-500 mb-3">
          Green = perfect 6v6. Yellow = 7v7 or 8v8 involved.
        </p>
        <div className="overflow-auto max-h-96 border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                {['Players', 'Recommended split', 'Format', 'Schedule'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ pn, rec }) => (
                <tr
                  key={pn}
                  className={
                    !rec
                      ? ''
                      : rec.baseSize === 6 && rec.large === 0
                        ? 'bg-green-50'
                        : rec.baseSize >= 7
                          ? 'bg-yellow-50'
                          : ''
                  }
                >
                  <td className="px-3 py-1.5 font-medium text-gray-900">{pn}</td>
                  <td className="px-3 py-1.5">{rec ? describeConfig(rec) : '—'}</td>
                  <td className="px-3 py-1.5">{rec ? sizeLabel(rec) : '—'}</td>
                  <td className="px-3 py-1.5">{rec ? `${rec.numTeams}-team` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Team sheet view ───────────────────────────────────────────────────────

function TeamSheet({ numTeams }: { numTeams: number }) {
  const meta = ROTATION_META[numTeams]
  return (
    <div>
      <div className="mb-4 print:mb-2">
        <h2 className="text-xl font-semibold text-gray-900">{numTeams}-Team Rotation</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Works well for {meta.range} players · Perfect splits: {meta.perfect}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Lines 7–8 (faded) for 7v7 / 8v8 · S/T = she/they count, H = he/him count
        </p>
      </div>

      <div className="flex gap-3">
        {Array.from({ length: numTeams }).map((_, i) => (
          <div key={i} className="flex-1 border border-gray-400 rounded-lg p-3 min-w-0">
            <div className="text-sm font-semibold text-center mb-3">Team {i + 1}</div>

            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-6 border-b border-gray-400 mb-2" />
            ))}
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="h-6 border-b border-gray-200 mb-2 opacity-40" />
            ))}

            <div className="mt-2 bg-gray-100 rounded px-2 py-1 flex gap-4 text-xs text-gray-500">
              <span>S/T ___</span>
              <span>H ___</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Attendance view ───────────────────────────────────────────────────────

function AttendanceSheet() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Attendance</h2>
      <p className="text-xs text-gray-400 italic mb-4">* = brand new player</p>

      <div className="flex gap-6" style={{ height: 540 }}>
        {/* Left column: she/they */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex flex-col" style={{ flex: 3 }}>
            <div className="mb-2">
              <div className="text-sm font-semibold text-gray-900">
                She/They League — staying for open gym
              </div>
              <div className="text-xs text-gray-400">
                Players fill in their own names as league ends
              </div>
            </div>
            <div className="flex-1 border border-gray-400 rounded-lg" />
          </div>

          <div className="flex flex-col" style={{ flex: 1 }}>
            <div className="mb-2">
              <div className="text-sm font-semibold text-gray-900">Other She/They</div>
            </div>
            <div className="flex-1 border border-gray-400 rounded-lg" />
          </div>
        </div>

        {/* Right column: date + men */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-600">Date:</span>
            <div className="flex-1 border-b border-gray-400 h-5" />
          </div>
          <div className="flex flex-col flex-1 gap-2">
            <div className="text-sm font-semibold text-gray-900">Men</div>
            <div className="flex-1 border border-gray-400 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function OpenGymPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Team Splits')
  const isPrintTab = activeTab !== 'Team Splits'
  const numTeams =
    activeTab !== 'Team Splits' && activeTab !== 'Attendance'
      ? parseInt(activeTab, 10)
      : null

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-3xl font-bold text-gray-900">Open Gym</h1>
        {isPrintTab && (
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
          >
            Print
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              tab === activeTab
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'Team Splits' && <TeamSplitsView />}
      {numTeams !== null && <TeamSheet numTeams={numTeams} />}
      {activeTab === 'Attendance' && <AttendanceSheet />}
    </div>
  )
}
