'use client';

import { useState } from 'react';
import type { AudioEvent, TimeSlot } from '@/app/lib/tournamentSchedule';
import { getTournamentDurationMs } from '@/app/lib/tournamentSchedule';
import { buildTournamentMp3 } from '@/app/lib/tournamentAudioBuilder';
import type { TournamentClip } from '../types';

interface AudioGeneratorProps {
  events: AudioEvent[];
  slots: TimeSlot[];
  clips: TournamentClip[];
  requiredKeys: string[];
}

export default function AudioGenerator({
  events,
  slots,
  clips,
  requiredKeys,
}: AudioGeneratorProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clipByKey = new Map(clips.map((c) => [c.key, c]));
  const missing = requiredKeys.filter((k) => !clipByKey.has(k));
  const canGenerate = missing.length === 0 && events.length > 0;

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setDownloadUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPercent(0);
    setStatus('Starting…');

    try {
      const storedClips = clips.map((c) => ({ key: c.key, url: c.url }));
      const totalMs = getTournamentDurationMs(slots);
      const blob = await buildTournamentMp3(events, storedClips, totalMs, (msg, pct) => {
        setStatus(msg);
        if (pct >= 0) setPercent(pct);
      });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus('Complete');
      setPercent(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      setStatus(null);
    } finally {
      setGenerating(false);
    }
  };

  const durationLabel = (() => {
    const ms = getTournamentDurationMs(slots);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `~${h}h ${m}m track (${events.length} events)`;
  })();

  return (
    <div className="space-y-6">
      <p className="text-gray-600 text-sm">
        Generates the full tournament MP3 in your browser using ffmpeg.wasm. Play the file at
        tournament start (first slot). {durationLabel}
      </p>

      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          <p className="font-semibold mb-2">Missing {missing.length} clip(s):</p>
          <ul className="font-mono text-xs max-h-32 overflow-y-auto list-disc pl-5">
            {missing.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!canGenerate || generating}
        onClick={() => void generate()}
        className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? 'Generating…' : 'Generate MP3'}
      </button>

      {generating && (
        <div className="space-y-2">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${Math.max(percent, 5)}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">{status}</p>
          <p className="text-xs text-gray-500">
            First run downloads ~30MB of ffmpeg.wasm (cached afterward). Long tournaments may take
            several minutes.
          </p>
        </div>
      )}

      {downloadUrl && !generating && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <p className="text-green-900 font-medium">MP3 ready</p>
          <a
            href={downloadUrl}
            download="throwdown_5_tournament_audio.mp3"
            className="inline-flex px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
          >
            Download tournament_audio.mp3
          </a>
          <p className="text-xs text-gray-600">
            Click Generate again anytime after replacing clips — no re-upload needed.
          </p>
        </div>
      )}
    </div>
  );
}
