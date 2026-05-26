'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { AudioEvent } from './tournamentSchedule';
import { clipKey, formatMsFromStart } from './tournamentSchedule';

export interface StoredClip {
  key: string;
  url: string;
}

export type ProgressCallback = (message: string, percent: number) => void;

const SAMPLE_RATE = 44100;
const FFMPEG_CORE_VERSION = '0.12.10';
const SILENCE_PAD_FILE = 'silence_pad.mp3';
const DURATION_CONCURRENCY = 6;

async function loadFFmpeg(onProgress?: ProgressCallback): Promise<FFmpeg> {
  const ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => {
    if (message.includes('silence')) return;
    onProgress?.(message, -1);
  });
  ffmpeg.on('progress', ({ progress }) => {
    if (progress >= 0 && progress <= 1) {
      onProgress?.('Encoding…', Math.round(progress * 100));
    }
  });

  const baseURL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;
  onProgress?.('Loading ffmpeg…', 5);
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ffmpeg;
}

function getAudioDurationMs(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audio.onloadedmetadata = () => {
      const ms = audio.duration * 1000;
      if (Number.isFinite(ms) && ms > 0) resolve(ms);
      else reject(new Error('Invalid audio duration'));
    };
    audio.onerror = () => reject(new Error('Failed to load audio metadata'));
    audio.src = url;
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

function mergeAdjacentSilence(segments: TimelineSegment[]): TimelineSegment[] {
  const merged: TimelineSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (seg.type === 'silence' && last?.type === 'silence') {
      last.durationMs += seg.durationMs;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

interface TimelineSegment {
  type: 'silence' | 'clip';
  durationMs: number;
  inputName?: string;
  label?: string;
}

function rawFileName(key: string): string {
  return `raw_${key.replace(/\//g, '_')}`;
}

function normFileName(key: string): string {
  return `norm_${key.replace(/\//g, '_')}.mp3`;
}

async function createSilencePad(ffmpeg: FFmpeg): Promise<void> {
  await ffmpeg.exec([
    '-f',
    'lavfi',
    '-i',
    `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
    '-t',
    '0.1',
    '-q:a',
    '9',
    '-acodec',
    'libmp3lame',
    SILENCE_PAD_FILE,
  ]);
}

async function normalizeClip(
  ffmpeg: FFmpeg,
  key: string,
  url: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const rawName = rawFileName(key);
  const normName = normFileName(key);
  onProgress?.(`Normalizing ${key}…`, -1);
  const data = await fetchFile(url);
  await ffmpeg.writeFile(rawName, data);
  await ffmpeg.exec([
    '-i',
    rawName,
    '-ar',
    String(SAMPLE_RATE),
    '-ac',
    '1',
    '-c:a',
    'libmp3lame',
    '-q:a',
    '4',
    normName,
  ]);
  return normName;
}

/** Build ffconcat list: each silence is an explicit silence_pad entry (never padded onto clip duration). */
function buildConcatList(
  segments: TimelineSegment[],
  normByKey: Map<string, string>
): string {
  const lines = ['ffconcat version 1.0'];

  for (const seg of segments) {
    if (seg.type === 'silence') {
      if (seg.durationMs >= 10) {
        lines.push(`file '${SILENCE_PAD_FILE}'`);
        lines.push(`duration ${(seg.durationMs / 1000).toFixed(3)}`);
      }
    } else if (seg.inputName) {
      lines.push(`file '${normByKey.get(seg.inputName)!}'`);
    }
  }

  return lines.join('\n');
}

export async function buildTournamentMp3(
  events: AudioEvent[],
  clips: StoredClip[],
  totalDurationMs: number,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const clipMap = new Map(clips.map((c) => [c.key, c.url]));
  const uniqueKeys = [...new Set(events.flatMap((e) => e.clips.map(clipKey)))];
  for (const key of uniqueKeys) {
    if (!clipMap.has(key)) {
      throw new Error(`Missing audio clip: ${key}`);
    }
  }

  onProgress?.('Loading clip durations…', 10);
  const durationEntries = await mapWithConcurrency(
    uniqueKeys,
    DURATION_CONCURRENCY,
    async (key) => {
      const ms = await getAudioDurationMs(clipMap.get(key)!);
      return [key, ms] as const;
    }
  );
  const durationByKey = new Map(durationEntries);

  const segments: TimelineSegment[] = [];
  let cursorMs = 0;

  for (const event of events) {
    if (event.absoluteMs < cursorMs) {
      throw new Error(
        `Schedule timeline overlap: "${event.label}" is scheduled at ${formatMsFromStart(event.absoluteMs)}, ` +
          `but the previous audio ends at ${formatMsFromStart(cursorMs)}. ` +
          `Check warning offsets or slot spacing in the schedule.`
      );
    }

    if (event.absoluteMs > cursorMs) {
      segments.push({
        type: 'silence',
        durationMs: event.absoluteMs - cursorMs,
        label: `Silence before ${event.label}`,
      });
      cursorMs = event.absoluteMs;
    }

    for (const ref of event.clips) {
      const key = clipKey(ref);
      const dur = durationByKey.get(key)!;
      segments.push({
        type: 'clip',
        durationMs: dur,
        inputName: key,
        label: event.label,
      });
      cursorMs += dur;
    }
  }

  if (cursorMs < totalDurationMs) {
    segments.push({
      type: 'silence',
      durationMs: totalDurationMs - cursorMs,
      label: 'Trailing silence',
    });
  }

  const mergedSegments = mergeAdjacentSilence(segments);

  onProgress?.('Loading ffmpeg…', 15);
  const ffmpeg = await loadFFmpeg(onProgress);

  onProgress?.('Preparing silence pad…', 18);
  await createSilencePad(ffmpeg);

  const normByKey = new Map<string, string>();
  let normIndex = 0;
  for (const key of uniqueKeys) {
    normIndex++;
    const pct = 20 + Math.round((normIndex / uniqueKeys.length) * 50);
    onProgress?.(`Normalizing clips (${normIndex}/${uniqueKeys.length})…`, pct);
    const normName = await normalizeClip(ffmpeg, key, clipMap.get(key)!, onProgress);
    normByKey.set(key, normName);
  }

  const listContent = buildConcatList(mergedSegments, normByKey);
  await ffmpeg.writeFile('concat_list.txt', listContent);

  onProgress?.('Stitching final MP3…', 85);
  await ffmpeg.exec([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'concat_list.txt',
    '-ar',
    String(SAMPLE_RATE),
    '-ac',
    '1',
    '-c:a',
    'libmp3lame',
    '-q:a',
    '4',
    'output.mp3',
  ]);

  onProgress?.('Done', 100);
  const out = await ffmpeg.readFile('output.mp3');
  const bytes = out instanceof Uint8Array ? out : new TextEncoder().encode(out as string);
  return new Blob([bytes], { type: 'audio/mpeg' });
}
