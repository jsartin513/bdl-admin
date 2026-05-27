'use client';

import { useCallback, useRef, useState, type ChangeEvent } from 'react';

export default function ThrowdownTeamSchedulesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [csvFilename, setCsvFilename] = useState('');
  const [outputName, setOutputName] = useState('Throw_Down_Team_Schedules');
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  const onFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setCsv(text);
      setCsvFilename(file.name);
    } catch {
      setError('Could not read the uploaded file.');
    }
  }, []);

  const loadSample = useCallback(async () => {
    setError(null);
    setIsLoadingSample(true);
    try {
      const res = await fetch('/api/throwdown-team-schedules');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sample CSV');
      setCsv(data.csv);
      setCsvFilename(data.filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sample CSV');
    } finally {
      setIsLoadingSample(false);
    }
  }, []);

  const generate = useCallback(async () => {
    setError(null);
    if (!csv.trim()) {
      setError('Upload a Throw Down schedule CSV or load the sample export.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/throwdown-team-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, outputName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const downloadName = match?.[1] ?? `${outputName.replace(/\s+/g, '_')}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate workbook');
    } finally {
      setIsGenerating(false);
    }
  }, [csv, outputName]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Throw Down Team Schedules</h1>
        <p className="mt-2 text-gray-600">
          Upload a Throw Down schedule CSV export to generate an Excel workbook with a summary tab
          plus one sheet per team (group phase rounds, reffing/off status, and playoff blocks).
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">1. Schedule CSV</h2>
        <p className="text-sm text-gray-600">
          Use the CSV export from Throw Down (columns like Date, Court, Phase, Home Team, Away
          Team, Referees).
        </p>

        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Choose CSV file
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void onFileChange(e)}
            />
          </label>
          <button
            type="button"
            onClick={() => void loadSample()}
            disabled={isLoadingSample}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoadingSample ? 'Loading sample…' : 'Load sample CSV'}
          </button>
        </div>

        {csvFilename ? (
          <p className="text-sm text-green-700">
            Loaded: <span className="font-medium">{csvFilename}</span>
            {csv.trim() ? ` (${csv.split('\n').filter((l) => l.trim()).length - 1} games)` : ''}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">2. Output</h2>
        <label className="block text-sm font-medium text-gray-700" htmlFor="output-name">
          Download filename
        </label>
        <input
          id="output-name"
          type="text"
          value={outputName}
          onChange={(e) => setOutputName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Throw_Down_Team_Schedules"
        />
        <p className="text-xs text-gray-500">.xlsx will be appended automatically if missing.</p>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={isGenerating || !csv.trim()}
        className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? 'Generating…' : 'Generate & download XLSX'}
      </button>

      <p className="text-sm text-gray-500">
        Same logic as{' '}
        <code className="rounded bg-gray-100 px-1">schedule_data/build_team_schedules.py</code> —
        run locally with{' '}
        <code className="rounded bg-gray-100 px-1">
          python3 schedule_data/build_team_schedules.py --csv your.csv --out out.xlsx
        </code>{' '}
        for styled Excel output with color-coded rows.
      </p>
    </div>
  );
}
