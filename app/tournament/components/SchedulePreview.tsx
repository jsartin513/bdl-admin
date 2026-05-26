'use client';

import type { AudioEvent, TimeSlot } from '@/app/lib/tournamentSchedule';
import { formatMsFromStart } from '@/app/lib/tournamentSchedule';
import { clipKey } from '@/app/lib/tournamentSchedule';

interface SchedulePreviewProps {
  slots: TimeSlot[];
  events: AudioEvent[];
  filename: string;
}

export default function SchedulePreview({ slots, events, filename }: SchedulePreviewProps) {
  return (
    <div className="space-y-6">
      <p className="text-gray-600 text-sm">
        Loaded <span className="font-mono font-medium">{filename}</span> — {slots.length} time
        slots, {events.length} audio events.
      </p>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Time slots</h3>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Start</th>
                <th className="px-3 py-2 text-left">Round</th>
                <th className="px-3 py-2 text-left">Phase</th>
                <th className="px-3 py-2 text-left">Courts</th>
                <th className="px-3 py-2 text-left">Duration</th>
                <th className="px-3 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slots.map((slot) => (
                <tr key={`${slot.round}-${slot.startMs}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono">{formatMsFromStart(slot.startMs)}</td>
                  <td className="px-3 py-2">{slot.round}</td>
                  <td className="px-3 py-2">{slot.phase}</td>
                  <td className="px-3 py-2">{slot.matches.length}</td>
                  <td className="px-3 py-2">{Math.round(slot.durationMs / 60000)} min</td>
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
              ))}
            </tbody>
          </table>
        </div>
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
              {events.map((e, i) => (
                <tr key={i} className="border-t border-gray-100">
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
