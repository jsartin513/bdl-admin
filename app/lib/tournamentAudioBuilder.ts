'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { AudioEvent } from './tournamentSchedule';
import { clipKey } from './tournamentSchedule';

export interface StoredClip {
  key: string;
  url: string;
}

export type ProgressCallback = (message: string, percent: number) => void;

const SAMPLE_RATE = 44100;
const FFMPEG_CORE_VERSION = '0.12.10';

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

async function fetchClipBlob(url: string): Promise<Uint8Array> {
  const data = await fetchFile(url);
  return data;
}

interface TimelineSegment {
  type: 'silence' | 'clip';
  durationMs: number;
  inputName?: string;
  label?: string;
}

function safeFileName(key: string, index: number): string {
  return `clip_${index}_${key.replace(/\//g, '_')}.mp3`;
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
  const durationByKey = new Map<string, number>();
  for (const key of uniqueKeys) {
    const url = clipMap.get(key)!;
    durationByKey.set(key, await getAudioDurationMs(url));
  }

  const segments: TimelineSegment[] = [];
  let cursorMs = 0;

  for (const event of events) {
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

  const keyToFile = new Map<string, string>();
  let fileIndex = 0;
  for (const key of uniqueKeys) {
    const fileName = safeFileName(key, fileIndex++);
    keyToFile.set(key, fileName);
    const data = await fetchClipBlob(clipMap.get(key)!);
    await ffmpeg.writeFile(fileName, data);
  }

  const concatLines: string[] = [];
  let segIndex = 0;
  const totalSegs = mergedSegments.length;

  for (const seg of mergedSegments) {
    segIndex++;
    const pct = 20 + Math.round((segIndex / totalSegs) * 60);
    if (seg.type === 'silence') {
      const silenceSec = seg.durationMs / 1000;
      if (silenceSec < 0.01) continue;
      const silenceName = `silence_${segIndex}.mp3`;
      onProgress?.(`Silence ${silenceSec.toFixed(1)}s…`, pct);
      await ffmpeg.exec([
        '-f',
        'lavfi',
        '-i',
        `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
        '-t',
        String(silenceSec),
        '-q:a',
        '9',
        '-acodec',
        'libmp3lame',
        silenceName,
      ]);
      concatLines.push(`file '${silenceName}'`);
    } else if (seg.inputName) {
      const fileName = keyToFile.get(seg.inputName)!;
      concatLines.push(`file '${fileName}'`);
    }
  }

  const listContent = concatLines.join('\n');
  await ffmpeg.writeFile('concat_list.txt', listContent);

  onProgress?.('Stitching final MP3…', 85);
  await ffmpeg.exec([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'concat_list.txt',
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
