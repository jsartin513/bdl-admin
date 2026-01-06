import { Game, TeamStats, Conflict } from '../components/schedule/types';

export interface ParseScheduleOptions {
  includeHomeAway?: boolean; // Track home/away games
  includeMatchups?: boolean; // Track matchup details
  selectedWeek?: string; // Only track matchups if 'all'
  detectCourtConflicts?: boolean; // Detect teams playing on both courts
}

export interface ParseScheduleResult {
  games: Game[];
  teamStats: Record<string, TeamStats>;
  conflicts: Conflict[];
}

/**
 * Parses schedule CSV data into games, team stats, and conflicts
 * This is a unified parser that replaces the duplicated parsing logic
 * across multiple schedule pages.
 */
export function parseScheduleCSV(
  csvData: string,
  options: ParseScheduleOptions = {}
): ParseScheduleResult {
  const {
    includeHomeAway = true,
    includeMatchups = true,
    selectedWeek = 'all',
    detectCourtConflicts = false,
  } = options;

  if (!csvData || csvData.trim() === '') {
    return { games: [], teamStats: {}, conflicts: [] };
  }

  const lines = csvData.split('\n').filter((line) => line.trim() !== '');
  const games: Game[] = [];
  const stats: Record<string, TeamStats> = {};
  const detectedConflicts: Conflict[] = [];

  const getInitialTeamStats = (): TeamStats => {
    // Note: homeGames and awayGames are always included because TeamStats type requires them
    // and components (TeamStatsTable, TeamStatsCards) use them. They will be 0 when
    // includeHomeAway is false, but only incremented when includeHomeAway is true.
    const base: TeamStats = {
      gamesPlayed: 0,
      gamesReffed: 0,
      homeGames: 0,
      awayGames: 0,
    };

    if (includeMatchups && selectedWeek === 'all') {
      base.matchups = {};
    }

    return base;
  };

  const initializeTeamStats = (team: string): string => {
    const cleanTeam = team.trim();
    // Don't initialize stats for special values that are filtered out later
    if (
      cleanTeam &&
      cleanTeam !== '' &&
      cleanTeam !== 'Refs:' &&
      cleanTeam !== 'BYE' &&
      cleanTeam !== 'TBD' &&
      !stats[cleanTeam]
    ) {
      stats[cleanTeam] = getInitialTeamStats();
    }
    return cleanTeam;
  };

  const recordMatchup = (
    team1: string,
    team2: string,
    team1IsHome: boolean = true
  ) => {
    if (
      includeMatchups &&
      selectedWeek === 'all' &&
      team1 &&
      team2 &&
      team1 !== team2 &&
      team1 !== 'BYE' &&
      team2 !== 'BYE' &&
      team1 !== 'TBD' &&
      team2 !== 'TBD'
    ) {
      if (stats[team1]?.matchups) {
        if (!stats[team1].matchups![team2]) {
          stats[team1].matchups![team2] = { total: 0, home: 0, away: 0 };
        }
        stats[team1].matchups![team2].total += 1;
        if (team1IsHome) {
          stats[team1].matchups![team2].home += 1;
        } else {
          stats[team1].matchups![team2].away += 1;
        }
      }
      if (stats[team2]?.matchups) {
        if (!stats[team2].matchups![team1]) {
          stats[team2].matchups![team1] = { total: 0, home: 0, away: 0 };
        }
        stats[team2].matchups![team1].total += 1;
        if (team1IsHome) {
          stats[team2].matchups![team1].away += 1;
        } else {
          stats[team2].matchups![team1].home += 1;
        }
      }
    }
  };

  // Parse games - handle both line-by-line and paired-line formats
  // Paired format: game line followed by ref line (i += 2)
  // Line-by-line format: check each line individually (i++)
  let i = 0;
  while (i < lines.length) {
    const gameLine = lines[i];

    if (!gameLine || !gameLine.includes('Game ')) {
      i++;
      continue;
    }

    // Look ahead for the ref line (should be the next line)
    const refLine = i + 1 < lines.length ? lines[i + 1] : '';
    
    // Check if we should skip the next line (paired format)
    // Treat it as paired only if the next line looks like a refs line
    const isPairedFormat = !!refLine && refLine.includes('Refs:');

    const gameData = gameLine.split(',');
    const refData = isPairedFormat ? refLine.split(',') : [];

    const gameNumber = gameData[0]?.trim() || '';

    // Extract team names - preserve BYE/TBD values for Game objects
    // but only initialize stats for real teams
    const court1Team1Raw = (gameData[1] || '').trim();
    const court1Team2Raw = (gameData[3] || '').trim();
    const court2Team1Raw = (gameData[6] || '').trim();
    const court2Team2Raw = (gameData[8] || '').trim();

    const court1RefRaw = (refData[1]?.replace(/Refs:\s*/g, '') || '').trim();
    const court2RefRaw = (refData[6]?.replace(/Refs:\s*/g, '') || '').trim();

    // Initialize stats only for real teams (not BYE, TBD, empty, or 'Refs:')
    const court1Team1 = initializeTeamStats(court1Team1Raw);
    const court1Team2 = initializeTeamStats(court1Team2Raw);
    const court2Team1 = initializeTeamStats(court2Team1Raw);
    const court2Team2 = initializeTeamStats(court2Team2Raw);
    const court1Ref = initializeTeamStats(court1RefRaw);
    const court2Ref = initializeTeamStats(court2RefRaw);

    // Skip if no teams found
    if (!court1Team1 && !court1Team2 && !court2Team1 && !court2Team2) {
      // Skip ref line in paired format, otherwise just increment
      if (isPairedFormat) {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    // Preserve original values for Game objects
    // - If CSV contains "BYE" or "TBD" as literal strings, they are preserved
    // - If CSV has empty values, they become empty strings
    // - UI components handle empty strings by displaying "BYE" or "TBD" as fallbacks
    // This allows UI components to display these special values correctly
    const game: Game = {
      gameNumber,
      court1Team1: court1Team1Raw || '',
      court1Team2: court1Team2Raw || '',
      court1Ref: court1RefRaw || '',
      court2Team1: court2Team1Raw || '',
      court2Team2: court2Team2Raw || '',
      court2Ref: court2RefRaw || '',
    };

    games.push(game);

    const teamsInGame = new Set<string>();

    // Count games played and track home/away
    // Use the cleaned team names (from initializeTeamStats) for stats tracking
    const processTeam = (team: string, isHome: boolean) => {
      if (team && team !== 'BYE' && team !== 'TBD' && stats[team]) {
        stats[team].gamesPlayed++;
        if (includeHomeAway) {
          if (isHome) {
            stats[team].homeGames++;
          } else {
            stats[team].awayGames++;
          }
        }
        teamsInGame.add(team);
      }
    };

    processTeam(court1Team1, true); // Court 1 Team 1 is home
    processTeam(court1Team2, false); // Court 1 Team 2 is away
    processTeam(court2Team1, true); // Court 2 Team 1 is home
    processTeam(court2Team2, false); // Court 2 Team 2 is away

    // Record matchups
    recordMatchup(court1Team1, court1Team2, true);
    recordMatchup(court2Team1, court2Team2, true);

    // Detect conflicts: teams playing on both courts simultaneously
    // Use cleaned team names for conflict detection
    if (detectCourtConflicts) {
      const court1Teams = new Set(
        [court1Team1, court1Team2].filter(
          (team) => team && team !== '' && team !== 'BYE' && team !== 'TBD'
        )
      );
      const court2Teams = new Set(
        [court2Team1, court2Team2].filter(
          (team) => team && team !== '' && team !== 'BYE' && team !== 'TBD'
        )
      );

      for (const team of court1Teams) {
        if (court2Teams.has(team)) {
          detectedConflicts.push({
            gameNumber,
            team,
            conflicts: ['Playing on both Court 1 and Court 2'],
          });
        }
      }
    }

    // Count games reffed and check for referee conflicts
    const processReferee = (ref: string, court: string) => {
      if (ref && ref !== 'TBD' && stats[ref]) {
        stats[ref].gamesReffed++;

        // Check if referee is also playing in this game
        if (teamsInGame.has(ref)) {
          detectedConflicts.push({
            gameNumber,
            team: ref,
            conflicts: [`Playing and reffing ${court}`],
          });
        }
      }
    };

    processReferee(court1Ref, 'Court 1');
    processReferee(court2Ref, 'Court 2');

    // Skip ref line in paired format, otherwise just increment
    if (isPairedFormat) {
      i += 2; // Skip both game and ref lines
    } else {
      i++; // Move to next line
    }
  }

  return { games, teamStats: stats, conflicts: detectedConflicts };
}

