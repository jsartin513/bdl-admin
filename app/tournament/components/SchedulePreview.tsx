'use client';

import {
  COUNTDOWN_CLIP_SLUGS,
  clipKey,
  formatMsFromStart,
  getCourtCallMs,
  getNextRoundStartMs,
  getNoBlockingEndMs,
  getNoBlockingStartMs,
  type AudioEvent,
  type CountdownClipSlug,
  type ScheduleConfig,
  type TimeSlot,
} from '@/app/lib/tournamentSchedule';

function slugToLabel(slug: string): string {
  return slug
    .split(/[-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface SchedulePreviewProps {
  slots: TimeSlot[];
  events: AudioEvent[];
  filename: string;
  config: ScheduleConfig;
  onConfigChange: (c: ScheduleConfig) => void;
}

function toggleCountdown(
  list: CountdownClipSlug[],
  slug: CountdownClipSlug,
  checked: boolean
): CountdownClipSlug[] {
  if (checked) {
    return list.includes(slug) ? list : [...list, slug];
  }
  return list.filter((s) => s !== slug);
}

function CountdownCheckboxes({
  id,
  label,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  selected: CountdownClipSlug[];
  onChange: (next: CountdownClipSlug[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-900">{label}</legend>
      <div className="flex flex-wrap gap-3">
        {COUNTDOWN_CLIP_SLUGS.map((slug) => (
          <label key={`${id}-${slug}`} className="flex items-center gap-1.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={selected.includes(slug)}
              onChange={(e) =>
                onChange(toggleCountdown(selected, slug, e.target.checked))
              }
              className="rounded border-gray-300"
            />
            {slugToLabel(slug)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function SchedulePreview({
  slots,
  events,
  filename,
  config,
  onConfigChange,
}: SchedulePreviewProps) {
  const patch = (partial: Partial<ScheduleConfig>) => onConfigChange({ ...config, ...partial });

  return (
    <div className="space-y-6">
      <p className="text-gray-600 text-sm">
        Loaded <span className="font-mono font-medium">{filename}</span> — {slots.length} time
        slots, {events.length} audio events.
      </p>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Round timeline</h3>
        <p className="text-xs text-gray-500">
          Key timestamps per round based on your configuration below.
        </p>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Round</th>
                <th className="px-3 py-2 text-left">Round starts</th>
                <th className="px-3 py-2 text-left">No-blocking starts</th>
                <th className="px-3 py-2 text-left">No-blocking ends</th>
                <th className="px-3 py-2 text-left">Next round</th>
                <th className="px-3 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slots.map((slot, i) => {
                const nextStart = getNextRoundStartMs(i, slots);
                return (
                  <tr key={`${slot.round}-${slot.startMs}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{slot.round}</td>
                    <td className="px-3 py-2 font-mono">{formatMsFromStart(slot.startMs)}</td>
                    <td className="px-3 py-2 font-mono">
                      {formatMsFromStart(getNoBlockingStartMs(slot, config))}
                      <span className="text-gray-400 text-xs ml-1">
                        (+{config.noBlockingStartMin}m)
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatMsFromStart(getNoBlockingEndMs(slot, config))}
                      <span className="text-gray-400 text-xs ml-1">
                        (+{config.noBlockingDurationMin}m)
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {nextStart != null ? (
                        <>
                          {formatMsFromStart(nextStart)}
                          <span className="text-gray-400 text-xs ml-1 block">
                            Court call{' '}
                            {formatMsFromStart(getCourtCallMs(slots[i + 1], config))}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {slot.hasPlaceholderTeams ? (
                        <span className="text-amber-700 text-xs">
                          Playoff teams TBD — uses playoff_match clip
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-6 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Audio configuration</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="font-medium text-gray-900">No-blocking starts (min after round)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={config.noBlockingStartMin}
              onChange={(e) =>
                patch({ noBlockingStartMin: Math.max(1, parseInt(e.target.value, 10) || 15) })
              }
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-900">No-blocking duration (min)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={config.noBlockingDurationMin}
              onChange={(e) =>
                patch({
                  noBlockingDurationMin: Math.max(1, parseInt(e.target.value, 10) || 3),
                })
              }
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-900">Court call lead time (seconds)</span>
            <input
              type="number"
              min={30}
              max={300}
              value={Math.round(config.courtAssignOffsetMs / 1000)}
              onChange={(e) =>
                patch({
                  courtAssignOffsetMs: Math.max(30, parseInt(e.target.value, 10) || 90) * 1000,
                })
              }
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-900">Team names in court announcements</legend>
          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="teamNameMode"
                checked={config.teamNameMode === 'separate'}
                onChange={() => patch({ teamNameMode: 'separate' })}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Separate clips</span> — Team A + vs + Team B
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="teamNameMode"
                checked={config.teamNameMode === 'compound'}
                onChange={() => patch({ teamNameMode: 'compound' })}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Compound clip</span> — one clip per matchup (e.g.
                black-panther-vs-proud-family)
              </span>
            </label>
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={config.includeRefs}
            onChange={(e) => patch({ includeRefs: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span>Include referee names in court announcements</span>
        </label>

        <CountdownCheckboxes
          id="nb-start"
          label="Countdowns before no-blocking starts"
          selected={config.countdownsBeforeNoBlockingStart}
          onChange={(countdownsBeforeNoBlockingStart) => patch({ countdownsBeforeNoBlockingStart })}
        />

        <CountdownCheckboxes
          id="nb-end"
          label="Countdowns before no-blocking ends (buzzer)"
          selected={config.countdownsBeforeNoBlockingEnd}
          onChange={(countdownsBeforeNoBlockingEnd) => patch({ countdownsBeforeNoBlockingEnd })}
        />

        <CountdownCheckboxes
          id="court"
          label="Countdowns before court call (get to your next court)"
          selected={config.countdownsBeforeCourtCall}
          onChange={(countdownsBeforeCourtCall) => patch({ countdownsBeforeCourtCall })}
        />
      </div>

      <details className="border border-gray-200 rounded-lg">
        <summary className="px-4 py-3 cursor-pointer font-semibold text-gray-900 bg-gray-50 rounded-lg">
          Full event timeline ({events.length} events)
        </summary>
        <div className="max-h-96 overflow-y-auto p-2">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-2 py-1">Time</th>
                <th className="px-2 py-1">Event</th>
                <th className="px-2 py-1">Clips</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={`${e.absoluteMs}-${e.label}`} className="border-t border-gray-100">
                  <td className="px-2 py-1 font-mono whitespace-nowrap">
                    {formatMsFromStart(e.absoluteMs)}
                  </td>
                  <td className="px-2 py-1">{e.label}</td>
                  <td className="px-2 py-1 font-mono text-gray-600">
                    {e.clips.map(clipKey).join(' → ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
