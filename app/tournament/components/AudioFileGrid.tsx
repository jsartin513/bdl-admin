'use client';

import { useCallback, useRef, useState } from 'react';
import {
  GENERIC_CLIP_SLUGS,
  TEAM_SLUGS,
  clipKey,
  type ClipRef,
} from '@/app/lib/tournamentSchedule';
import type { TournamentClip } from '../types';

function slugToLabel(slug: string): string {
  return slug
    .split(/[-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface ClipCardProps {
  ref_: ClipRef;
  clip?: TournamentClip;
  onUploaded: () => void;
}

function ClipCard({ ref_, clip, onUploaded }: ClipCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = clipKey(ref_);
  const label = slugToLabel(ref_.slug);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('category', ref_.category);
        form.append('slug', ref_.slug);
        const res = await fetch('/api/tournament-clips', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        onUploaded();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [ref_, onUploaded]
  );

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const remove = async () => {
    if (!clip?.url) return;
    setUploading(true);
    try {
      const res = await fetch('/api/tournament-clips', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clip.url, pathname: clip.pathname }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`border rounded-lg p-3 flex flex-col gap-2 ${
        clip ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900 text-sm">{label}</p>
          <p className="text-xs text-gray-500 font-mono">{key}</p>
        </div>
        {clip ? (
          <span className="text-green-600 text-lg" title="Uploaded">
            ✓
          </span>
        ) : (
          <span className="text-gray-400 text-lg" title="Missing">
            ○
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2 mt-auto">
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,.mp3,audio/mp3"
          className="hidden"
          onChange={onFile}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? '…' : clip ? 'Replace' : 'Upload'}
        </button>
        {clip && (
          <>
            <a
              href={clip.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
            >
              Preview
            </a>
            <button
              type="button"
              disabled={uploading}
              onClick={() => void remove()}
              className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface AudioFileGridProps {
  clips: TournamentClip[];
  requiredKeys: string[];
  onRefresh: () => void;
}

export default function AudioFileGrid({ clips, requiredKeys, onRefresh }: AudioFileGridProps) {
  const clipByKey = new Map(clips.map((c) => [c.key, c]));
  const uploadedRequired = requiredKeys.filter((k) => clipByKey.has(k)).length;

  const teamRefs: ClipRef[] = TEAM_SLUGS.map((slug) => ({ category: 'teams', slug }));
  const genericRefs: ClipRef[] = GENERIC_CLIP_SLUGS.map((slug) => ({
    category: 'generic',
    slug,
  }));

  return (
    <div className="space-y-6">
      <div
        className={`rounded-lg px-4 py-3 text-sm font-medium ${
          uploadedRequired === requiredKeys.length
            ? 'bg-green-100 text-green-900'
            : 'bg-amber-100 text-amber-900'
        }`}
      >
        {uploadedRequired} / {requiredKeys.length} required clips uploaded
      </div>

      <section>
        <h3 className="font-semibold text-gray-900 mb-3">Team names ({TEAM_SLUGS.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {teamRefs.map((ref_) => (
            <ClipCard
              key={clipKey(ref_)}
              ref_={ref_}
              clip={clipByKey.get(clipKey(ref_))}
              onUploaded={onRefresh}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 mb-3">Generic clips ({GENERIC_CLIP_SLUGS.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {genericRefs.map((ref_) => (
            <ClipCard
              key={clipKey(ref_)}
              ref_={ref_}
              clip={clipByKey.get(clipKey(ref_))}
              onUploaded={onRefresh}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
