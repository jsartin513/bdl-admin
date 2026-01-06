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
    const base: TeamStats = {
      gamesPlayed: 0,
      gamesReffed: 0,
    };

    if (includeHomeAway) {
      base.homeGames = 0;
      base.awayGames = 0;
    }

    if (includeMatchups && selectedWeek === 'all') {
      base.matchups = {};
    }

    return base;
  };

  const initializeTeamStats = (team: string): string => {
    const cleanTeam = team.trim();
    if (
      cleanTeam &&
      cleanTeam !== '' &&
      cleanTeam !== 'Refs:' &&
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
      team2 !== 'BYE'
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
    const isPairedFormat = refLine && !refLine.includes('Game ');

    const gameData = gameLine.split(',');
    const refData = refLine ? refLine.split(',') : [];

    const gameNumber = gameData[0]?.trim() || '';

    const court1Team1 = initializeTeamStats(gameData[1] || '');
    const court1Team2 = initializeTeamStats(gameData[3] || '');
    const court2Team1 = initializeTeamStats(gameData[6] || '');
    const court2Team2 = initializeTeamStats(gameData[8] || '');

    const court1Ref = initializeTeamStats(
      refData[1]?.replace(/Refs:\s*/g, '') || ''
    );
    const court2Ref = initializeTeamStats(
      refData[6]?.replace(/Refs:\s*/g, '') || ''
    );

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

    const game: Game = {
      gameNumber,
      court1Team1,
      court1Team2,
      court1Ref,
      court2Team1,
      court2Team2,
      court2Ref,
    };

    games.push(game);

    const teamsInGame = new Set<string>();

    // Count games played and track home/away
    const processTeam = (team: string, isHome: boolean) => {
      if (team && team !== 'BYE' && team !== 'TBD' && stats[team]) {
        stats[team].gamesPlayed++;
        if (includeHomeAway) {
          if (isHome) {
            stats[team].homeGames!++;
          } else {
            stats[team].awayGames!++;
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

