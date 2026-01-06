import { useState, useEffect, useCallback } from 'react';
import { Game, TeamStats, Conflict } from './types';
import { parseScheduleCSV, ParseScheduleOptions } from '@/app/lib/scheduleParser';

export interface UseScheduleDataOptions {
  apiEndpoint: string; // e.g., '/api/schedules' or '/api/schedules-static'
  selectedWeek: string;
  parseOptions?: ParseScheduleOptions;
  onError?: (error: Error) => void;
}

export interface UseScheduleDataResult {
  games: Game[];
  teamStats: Record<string, TeamStats>;
  conflicts: Conflict[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Custom hook for fetching and parsing schedule data
 * Replaces duplicated data fetching logic across schedule pages
 */
export function useScheduleData({
  apiEndpoint,
  selectedWeek,
  parseOptions = {},
  onError,
}: UseScheduleDataOptions): UseScheduleDataResult {
  const [games, setGames] = useState<Game[]>([]);
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiEndpoint}?week=${selectedWeek}`);
      const data = await response.json();

      if (!response.ok) {
        // Handle authentication errors for live schedules
        if (response.status === 401 && data.message?.includes('Please log in')) {
          if (apiEndpoint.includes('/schedules') && !apiEndpoint.includes('static')) {
            window.location.href =
              '/login?redirect=' +
              encodeURIComponent(window.location.pathname + window.location.search);
            return;
          }
        }
        // For session expired, try once more to allow JWT callback to refresh token
        if (response.status === 401 && retryCount === 0 && apiEndpoint.includes('/schedules') && !apiEndpoint.includes('static')) {
          console.log('Session may have expired, retrying...');
          return fetchSchedule(1);
        }
        // For session expired after retry, suggest refresh
        if (response.status === 401 && data.message?.includes('Session expired')) {
          throw new Error(data.message + ' (Try refreshing the page)');
        }
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Parse the CSV data using the shared parser
      const { games: parsedGames, teamStats: parsedStats, conflicts: parsedConflicts } =
        parseScheduleCSV(data.csvData || '', {
          ...parseOptions,
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
  }, [apiEndpoint, selectedWeek, parseOptions, onError]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return {
    games,
    teamStats,
    conflicts,
    loading,
    error,
    refetch: fetchSchedule,
  };
}

