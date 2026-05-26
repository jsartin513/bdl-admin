'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SchedulePreview from './components/SchedulePreview';
import AudioFileGrid from './components/AudioFileGrid';
import AudioGenerator from './components/AudioGenerator';
import type { WizardStep, TournamentClip } from './types';
import {
  buildAudioEvents,
  buildTimeSlots,
  getRequiredClipKeys,
  getUniqueClipKeysFromEvents,
  parseTournamentCsv,
} from '@/app/lib/tournamentSchedule';

const STEPS: { n: WizardStep; title: string }[] = [
  { n: 1, title: 'Schedule' },
  { n: 2, title: 'Audio files' },
  { n: 3, title: 'Generate' },
];

export default function TournamentPage() {
  const [step, setStep] = useState<WizardStep>(1);
  const [csv, setCsv] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [clips, setClips] = useState<TournamentClip[]>([]);
  const [clipsLoading, setClipsLoading] = useState(true);

  const loadSchedule = useCallback(async () => {
    setScheduleError(null);
    try {
      const res = await fetch('/api/tournament-schedule');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load schedule');
      setCsv(data.csv);
      setFilename(data.filename);
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Failed to load schedule');
    }
  }, []);

  const loadClips = useCallback(async () => {
    setClipsLoading(true);
    try {
      const res = await fetch('/api/tournament-clips');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load clips');
      setClips(data.clips ?? []);
    } catch {
      setClips([]);
    } finally {
      setClipsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
    void loadClips();
  }, [loadSchedule, loadClips]);

  const { slots, events, requiredKeys } = useMemo(() => {
    if (!csv) {
      return { slots: [], events: [], requiredKeys: getRequiredClipKeys() };
    }
    const rows = parseTournamentCsv(csv);
    const slots = buildTimeSlots(rows);
    const events = buildAudioEvents(slots);
    const requiredKeys = getUniqueClipKeysFromEvents(events);
    return { slots, events, requiredKeys };
  }, [csv]);

  const clipByKey = new Map(clips.map((c) => [c.key, c]));
  const uploadedRequired = requiredKeys.filter((k) => clipByKey.has(k)).length;
  const allClipsReady = uploadedRequired === requiredKeys.length && requiredKeys.length > 0;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tournament Audio</h1>
          <p className="text-gray-600 mt-1">
            Throw Down 5th Edition — upload clips, then generate the full tournament MP3.
          </p>
        </div>

        <nav className="flex gap-2 mb-8">
          {STEPS.map(({ n, title }) => (
            <button
              key={n}
              type="button"
              onClick={() => setStep(n)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                step === n
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {n}. {title}
              {n === 2 && !clipsLoading && (
                <span className="ml-2 opacity-80">
                  ({uploadedRequired}/{requiredKeys.length})
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {step === 1 && (
            <>
              {scheduleError && (
                <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg text-sm">
                  {scheduleError}
                </div>
              )}
              {!csv && !scheduleError && (
                <p className="text-gray-500">Loading schedule…</p>
              )}
              {csv && (
                <SchedulePreview slots={slots} events={events} filename={filename} />
              )}
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!csv}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Next: Audio files →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {clipsLoading ? (
                <p className="text-gray-500">Loading uploaded clips…</p>
              ) : (
                <AudioFileGrid
                  clips={clips}
                  requiredKeys={requiredKeys}
                  onRefresh={loadClips}
                />
              )}
              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  ← Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Next: Generate →
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <AudioGenerator
                events={events}
                slots={slots}
                clips={clips}
                requiredKeys={requiredKeys}
              />
              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  ← Audio files
                </button>
                {!allClipsReady && (
                  <span className="text-sm text-amber-700 self-center">
                    Upload all required clips to enable generation
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Clips are stored in Vercel Blob (<code className="bg-gray-200 px-1 rounded">BLOB_READ_WRITE_TOKEN</code>{' '}
          required). Schedule is read from{' '}
          <code className="bg-gray-200 px-1 rounded">throwdown_5_schedule.csv</code> in the repo root. MP3
          generation uses ffmpeg.wasm (<code className="bg-gray-200 px-1 rounded">@ffmpeg/core</code>, GPL-2.0+) in
          the browser only.
        </p>
      </div>
    </div>
  );
}
