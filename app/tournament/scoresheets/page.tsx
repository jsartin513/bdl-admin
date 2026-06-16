'use client';

import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  buildScoresheetCards,
  filterCardsByCourt,
  uniqueCourts,
  type ScoresheetCard,
} from '@/app/lib/throwdownScoresheets';

type PerPage = 2 | 4;

function ScoresheetCardView({ card }: { card: ScoresheetCard }) {
  return (
    <article className="scoresheet-card">
      <header className="scoresheet-court">{card.courtLabel}</header>
      <div className="scoresheet-round-row">
        <span>Round</span>
        <span className="scoresheet-round-num">{card.round}</span>
        <span className="scoresheet-time">{card.time}</span>
      </div>
      <div className="scoresheet-refs">
        <span>
          <strong>Ref:</strong> {card.ref}
        </span>
        <span>
          <strong>Next:</strong> {card.refWhereNext}
        </span>
      </div>
      <div className="scoresheet-teams">
        <div className="scoresheet-team-col">
          <div className="scoresheet-team-name">{card.homeTeam}</div>
          <div className="scoresheet-score-box">
            <span className="scoresheet-score-label">Score</span>
          </div>
          <div className="scoresheet-where-next">
            Where to next: <strong>{card.homeWhereNext}</strong>
          </div>
        </div>
        <div className="scoresheet-team-col">
          <div className="scoresheet-team-name">{card.awayTeam}</div>
          <div className="scoresheet-score-box">
            <span className="scoresheet-score-label">Score</span>
          </div>
          <div className="scoresheet-where-next">
            Where to next: <strong>{card.awayWhereNext}</strong>
          </div>
        </div>
      </div>
      <div className="scoresheet-field">Comments:</div>
      <div className="scoresheet-blank" />
      <div className="scoresheet-field">Penalties or cards:</div>
      <div className="scoresheet-blank scoresheet-blank-sm" />
      <div className="scoresheet-signatures">
        <div className="scoresheet-sig-col">
          <div className="scoresheet-sig-box">Signatures</div>
          <div className="scoresheet-player">Player:</div>
        </div>
        <div className="scoresheet-sig-col">
          <div className="scoresheet-sig-box">Signatures</div>
          <div className="scoresheet-player">Player:</div>
        </div>
      </div>
    </article>
  );
}

export default function ThrowdownScoresheetsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [csvFilename, setCsvFilename] = useState('');
  const [outputName, setOutputName] = useState('Throw_Down_Scoresheets');
  const [error, setError] = useState<string | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [perPage, setPerPage] = useState<PerPage>(2);
  const [courtFilter, setCourtFilter] = useState<number | 'all'>('all');

  const allCards = useMemo(() => (csv.trim() ? buildScoresheetCards(csv) : []), [csv]);
  const courts = useMemo(() => uniqueCourts(allCards), [allCards]);
  const cards = useMemo(
    () => filterCardsByCourt(allCards, courtFilter === 'all' ? null : courtFilter),
    [allCards, courtFilter]
  );

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
      const res = await fetch('/api/throwdown-scoresheets');
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

  const downloadExcel = useCallback(async () => {
    setError(null);
    if (!csv.trim()) {
      setError('Upload a Throw Down schedule CSV or load the sample export.');
      return;
    }
    setIsDownloading(true);
    try {
      const res = await fetch('/api/throwdown-scoresheets', {
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
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download workbook');
    } finally {
      setIsDownloading(false);
    }
  }, [csv, outputName]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="scoresheets-page max-w-5xl mx-auto p-6 space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-gray-900">Throw Down Scoresheets</h1>
        <p className="mt-2 text-gray-600">
          Printable round-robin scoresheets for group phase games — one card per game, sorted by
          court for clipboard stacks.
        </p>
      </div>

      <section className="no-print rounded-lg border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">1. Schedule CSV</h2>
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
            {allCards.length > 0 ? ` (${allCards.length} group-phase games)` : ''}
          </p>
        ) : null}
      </section>

      <section className="no-print rounded-lg border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">2. Print options</h2>
        <div className="flex flex-wrap gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Cards per page</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="perPage"
                  checked={perPage === 2}
                  onChange={() => setPerPage(2)}
                />
                2 per page
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="perPage"
                  checked={perPage === 4}
                  onChange={() => setPerPage(4)}
                />
                4 per page
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Court filter</legend>
            <select
              value={courtFilter}
              onChange={(e) =>
                setCourtFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All courts</option>
              {courts.map((c) => (
                <option key={c} value={c}>
                  Court {c} only
                </option>
              ))}
            </select>
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={cards.length === 0}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Print scoresheets
          </button>
          <button
            type="button"
            onClick={() => void downloadExcel()}
            disabled={isDownloading || !csv.trim()}
            className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDownloading ? 'Downloading…' : 'Download Excel'}
          </button>
        </div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="output-name">
          Excel filename
        </label>
        <input
          id="output-name"
          type="text"
          value={outputName}
          onChange={(e) => setOutputName(e.target.value)}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-500">
          Styled Excel (matches 4th Edition &quot;Court Assignment Printouts&quot;):{' '}
          <code className="rounded bg-gray-100 px-1">
            python3 schedule_data/build_throwdown_scoresheets.py --tabs-only
          </code>{' '}
          or{' '}
          <code className="rounded bg-gray-100 px-1">
            python3 schedule_data/build_throwdown_scoresheets.py --merge-into &quot;schedule_data/The
            Throw Down_ 5th Edition Team Schedules_may_27.xlsx&quot;
          </code>
        </p>
      </section>

      {error ? (
        <div className="no-print rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {cards.length === 0 && csv.trim() ? (
        <p className="no-print text-sm text-amber-700">No group-phase games found in this CSV.</p>
      ) : null}

      <div className={`scoresheet-grid scoresheet-grid-${perPage}`}>
        {cards.map((card) => (
          <ScoresheetCardView key={`${card.court}-${card.round}`} card={card} />
        ))}
      </div>

      <style jsx global>{`
        .scoresheet-grid {
          display: grid;
          gap: 1rem;
        }
        .scoresheet-grid-2 {
          grid-template-columns: 1fr;
        }
        .scoresheet-grid-4 {
          grid-template-columns: repeat(2, 1fr);
        }
        .scoresheet-card {
          border: 2px solid #000;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 11pt;
          color: #000;
          background: #fff;
          padding: 0;
          overflow: hidden;
        }
        .scoresheet-court {
          text-align: center;
          font-weight: bold;
          font-size: 18pt;
          padding: 0.35rem 0.5rem;
          border-bottom: 2px solid #000;
        }
        .scoresheet-round-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 0.25rem 0.75rem;
          border-bottom: 1px solid #000;
          font-size: 11pt;
        }
        .scoresheet-round-num {
          text-align: center;
          font-weight: bold;
        }
        .scoresheet-time {
          text-align: right;
        }
        .scoresheet-refs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          border-bottom: 1px solid #000;
        }
        .scoresheet-teams {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .scoresheet-team-col {
          border-right: 1px solid #000;
          padding: 0.35rem 0.5rem 0.5rem;
        }
        .scoresheet-team-col:last-child {
          border-right: none;
        }
        .scoresheet-team-name {
          text-align: center;
          font-weight: bold;
          font-size: 12pt;
          margin-bottom: 0.35rem;
          min-height: 2.5em;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .scoresheet-score-box {
          border: 1px solid #000;
          min-height: 3.5rem;
          margin-bottom: 0.35rem;
          position: relative;
        }
        .scoresheet-score-label {
          position: absolute;
          top: 0.15rem;
          left: 0;
          right: 0;
          text-align: center;
          text-decoration: underline;
          font-size: 10pt;
        }
        .scoresheet-where-next {
          font-size: 10pt;
          padding-top: 0.15rem;
        }
        .scoresheet-field {
          padding: 0.2rem 0.75rem;
          border-top: 1px solid #000;
          font-weight: bold;
        }
        .scoresheet-blank {
          min-height: 1.75rem;
          border-top: 1px solid #000;
        }
        .scoresheet-blank-sm {
          min-height: 1.25rem;
        }
        .scoresheet-signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-top: 1px solid #000;
        }
        .scoresheet-sig-col {
          border-right: 1px solid #000;
          padding: 0.35rem 0.5rem;
        }
        .scoresheet-sig-col:last-child {
          border-right: none;
        }
        .scoresheet-sig-box {
          border: 1px solid #000;
          min-height: 2.5rem;
          text-align: center;
          text-decoration: underline;
          font-size: 10pt;
          padding-top: 0.15rem;
          margin-bottom: 0.25rem;
        }
        .scoresheet-player {
          font-size: 10pt;
        }

        @media print {
          @page {
            size: letter portrait;
            margin: 0.3in;
          }
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .scoresheets-page {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .scoresheet-grid {
            gap: 0;
          }
          .scoresheet-grid-2 .scoresheet-card {
            height: 4.85in;
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 0.15in;
          }
          .scoresheet-grid-2 .scoresheet-card:nth-child(2n) {
            page-break-after: always;
          }
          .scoresheet-grid-4 {
            grid-template-columns: 1fr 1fr;
            gap: 0.12in;
          }
          .scoresheet-grid-4 .scoresheet-card {
            height: 4.6in;
            break-inside: avoid;
            page-break-inside: avoid;
            font-size: 9pt;
          }
          .scoresheet-grid-4 .scoresheet-court {
            font-size: 14pt;
          }
          .scoresheet-grid-4 .scoresheet-team-name {
            font-size: 10pt;
          }
          .scoresheet-grid-4 .scoresheet-score-box {
            min-height: 2.25rem;
          }
          .scoresheet-grid-4 .scoresheet-card:nth-child(4n) {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}
