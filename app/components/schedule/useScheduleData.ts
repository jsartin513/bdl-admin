import { useState, useEffect, useCallback, useMemo } from 'react';
import { Game, TeamStats, Conflict } from './types';
import { parseScheduleCSV, ParseScheduleOptions } from '@/app/lib/scheduleParser';

export interface UseScheduleDataOptions {
  apiEndpoint: string; // e.g., '/api/schedules-live'
  selectedWeek: string;
  /** Optional league filename for static API (e.g. "Winter 2026 BYOT League.xlsx") */
  league?: string | null;
  /** Optional Google Sheets ID for the live API */
  sheetId?: string | null;
  parseOptions?: ParseScheduleOptions;
  onError?: (error: Error) => void;
}

export interface UseScheduleDataResult {
  games: Game[];
  teamStats: Record<string, TeamStats>;
  conflicts: Conflict[];
  loading: boolean;
  error: string | null;
  refetch: () => void; // Refetches schedule data, resetting retry count
}

/**
 * Custom hook for fetching and parsing schedule data
 * Replaces duplicated data fetching logic across schedule pages
 */
export function useScheduleData({
  apiEndpoint,
  selectedWeek,
  league = null,
  sheetId = null,
  parseOptions = {},
  onError,
}: UseScheduleDataOptions): UseScheduleDataResult {
  const [games, setGames] = useState<Game[]>([]);
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true); // Start with true for immediate loading indication
  const [error, setError] = useState<string | null>(null);

  // Memoize parseOptions to prevent unnecessary re-renders
  const memoizedParseOptions = useMemo(() => parseOptions, [
    parseOptions?.includeHomeAway,
    parseOptions?.includeMatchups,
    parseOptions?.detectCourtConflicts,
  ]);

  const fetchSchedule = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ week: selectedWeek });
      if (league) params.set('league', league);
      if (sheetId) params.set('sheetId', sheetId);
      const response = await fetch(`${apiEndpoint}?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Parse the CSV data using the shared parser
      const { games: parsedGames, teamStats: parsedStats, conflicts: parsedConflicts } =
        parseScheduleCSV(data.csvData || '', {
          ...memoizedParseOptions,
          selectedWeek,
        });

      setGames(parsedGames);
      setTeamStats(parsedStats);
      setConflicts(parsedConflicts);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setGames([]);
      setTeamStats({});
      setConflicts([]);
      
      if (onError && err instanceof Error) {
        onError(err);
      }
      
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, selectedWeek, league, sheetId, memoizedParseOptions, onError]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return {
    games,
    teamStats,
    conflicts,
    loading,
    error,
    refetch: () => fetchSchedule(), // Wrapper to ensure retry count is reset
  };
}

