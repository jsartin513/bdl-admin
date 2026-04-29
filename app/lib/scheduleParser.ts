import { Game, TeamStats, Conflict } from '../components/schedule/types';

/**
 * Splits a single CSV line, respecting standard quoting rules:
 * - Cells may be wrapped in double quotes (gviz always wraps every cell)
 * - A `""` inside a quoted cell is an escaped double quote
 * - Commas inside quoted cells are part of the value, not separators
 * Returns an array of unquoted cell values.
 */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cells.push(current);
  return cells;
}

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

    if (includeMatchups) {
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

    const gameData = splitCsvLine(gameLine);
    const refData = isPairedFormat ? splitCsvLine(refLine) : [];

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
            severity: 'error',
            conflictType: 'double-court',
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
            severity: 'error',
            conflictType: 'ref-and-play',
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

  /** Bucket so "one night" = one league week (single-week views use selectedWeek). */
  function weekBucketKey(gameNumber: string): string {
    const m = gameNumber.match(/^Week\s*(\d+)\s+Game\s*/i);
    if (m) return `week-${m[1]}`;
    if (selectedWeek !== 'all' && selectedWeek !== 'weeks5-6' && /^\d+$/.test(selectedWeek)) {
      return `week-${selectedWeek}`;
    }
    return 'week-combined';
  }

  function validMatchupSide(home: string, away: string): boolean {
    return (
      !!home &&
      !!away &&
      home !== 'BYE' &&
      away !== 'BYE' &&
      home !== 'TBD' &&
      away !== 'TBD'
    );
  }

  function teamIsPlaying(team: string, g: Game): boolean {
    const slots = [g.court1Team1, g.court1Team2, g.court2Team1, g.court2Team2].map((s) =>
      (s || '').trim()
    );
    return slots.some((s) => s === team && s !== '' && s !== 'BYE' && s !== 'TBD');
  }

  function roundHasTwoCourts(g: Game): boolean {
    return validMatchupSide(g.court1Team1, g.court1Team2) && validMatchupSide(g.court2Team1, g.court2Team2);
  }

  const isTwoCourtLeague = games.some(roundHasTwoCourts);

  /**
   * Two-court leagues: each row with both courts active = one round (both courts run at once).
   * Warn if a team plays neither court in 2+ consecutive two-court rounds; error at 3+.
   * Rows that are not two-court rounds end the streak (flush if already 2+).
   */
  if (isTwoCourtLeague) {
    const byWeek = new Map<string, Game[]>();
    for (const g of games) {
      const wk = weekBucketKey(g.gameNumber);
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk)!.push(g);
    }

    const idleOffTeamStatus = (team: string, g: Game): string => {
      const r1 = (g.court1Ref || '').trim();
      const r2 = (g.court2Ref || '').trim();
      if (team === r1) return 'Reffing Court 1 (not playing this round)';
      if (team === r2) return 'Reffing Court 2 (not playing this round)';
      return 'Off — not on either court or ref line';
    };

    const buildIdleStreakRounds = (team: string, streakRounds: Game[]): NonNullable<Conflict['idleStreakRounds']> =>
      streakRounds.map((g) => ({
        gameNumber: g.gameNumber,
        offTeam: team,
        offTeamStatus: idleOffTeamStatus(team, g),
        court1: { home: g.court1Team1, away: g.court1Team2, ref: g.court1Ref },
        court2: { home: g.court2Team1, away: g.court2Team2, ref: g.court2Ref },
      }));

    const flushStreak = (team: string, streakRounds: Game[]) => {
      const n = streakRounds.length;
      if (n < 2) return;
      const roundList = streakRounds.map((g) => g.gameNumber).join(', ');
      const severity: Conflict['severity'] = n >= 3 ? 'error' : 'warning';
      const label = n >= 3 ? `${n} consecutive two-court rounds` : '2 consecutive two-court rounds';
      detectedConflicts.push({
        gameNumber: streakRounds[n - 1]!.gameNumber,
        team,
        conflicts: [
          `${label} without playing on either court (${roundList}) — breaks player rest fairness. See rounds below.`,
        ],
        severity,
        conflictType: 'consecutive-without-playing',
        idleStreakRounds: buildIdleStreakRounds(team, streakRounds),
      });
    };

    for (const [, weekGames] of byWeek) {
      const weekUsesTwoCourts = weekGames.some(roundHasTwoCourts);
      if (!weekUsesTwoCourts) continue;

      for (const team of Object.keys(stats)) {
        let streakRounds: Game[] = [];
        for (const g of weekGames) {
          if (!roundHasTwoCourts(g)) {
            flushStreak(team, streakRounds);
            streakRounds = [];
            continue;
          }
          if (teamIsPlaying(team, g)) {
            flushStreak(team, streakRounds);
            streakRounds = [];
          } else {
            streakRounds.push(g);
          }
        }
        flushStreak(team, streakRounds);
      }
    }
  }

  // Same two teams, same home/away columns, twice (or more) in the same week/night
  type MatchupOccurrence = {
    gameNumber: string;
    court: 1 | 2;
    home: string;
    away: string;
  };
  const orientationGroups = new Map<string, MatchupOccurrence[]>();
  for (const g of games) {
    const wk = weekBucketKey(g.gameNumber);
    if (validMatchupSide(g.court1Team1, g.court1Team2)) {
      const key = `${wk}\0${g.court1Team1}\0${g.court1Team2}`;
      const list = orientationGroups.get(key) ?? [];
      list.push({
        gameNumber: g.gameNumber,
        court: 1,
        home: g.court1Team1,
        away: g.court1Team2,
      });
      orientationGroups.set(key, list);
    }
    if (validMatchupSide(g.court2Team1, g.court2Team2)) {
      const key = `${wk}\0${g.court2Team1}\0${g.court2Team2}`;
      const list = orientationGroups.get(key) ?? [];
      list.push({
        gameNumber: g.gameNumber,
        court: 2,
        home: g.court2Team1,
        away: g.court2Team2,
      });
      orientationGroups.set(key, list);
    }
  }
  for (const [, occ] of orientationGroups) {
    if (occ.length < 2) continue;
    const { home, away } = occ[0];
    const where = occ
      .map((o) => `${o.gameNumber} (court ${o.court})`)
      .join(', ');
    detectedConflicts.push({
      gameNumber: occ[0].gameNumber,
      team: `${home} (home) & ${away} (away)`,
      conflicts: [
        `Same home/away matchup ${occ.length} times in one night: ${where}`,
      ],
      severity: 'warning',
      conflictType: 'duplicate-orientation-same-night',
    });
  }

  // Detect same two teams playing each other in consecutive games.
  // Note: "consecutive" only applies WITHIN a single week — the gap between weeks
  // is days/weeks of real time, not back-to-back rounds.
  const sameMatchup = (a: Set<string>, b: Set<string>) =>
    a.size === 2 && b.size === 2 && [...a].every((t) => b.has(t));
  for (let idx = 0; idx < games.length - 1; idx++) {
    const curr = games[idx];
    const next = games[idx + 1];
    if (weekBucketKey(curr.gameNumber) !== weekBucketKey(next.gameNumber)) {
      continue;
    }
    const currC1 = new Set([curr.court1Team1, curr.court1Team2].filter(Boolean));
    const currC2 = new Set([curr.court2Team1, curr.court2Team2].filter(Boolean));
    const nextC1 = new Set([next.court1Team1, next.court1Team2].filter(Boolean));
    const nextC2 = new Set([next.court2Team1, next.court2Team2].filter(Boolean));
    let currCourt: 1 | 2 | null = null;
    let nextCourt: 1 | 2 | null = null;
    if (sameMatchup(currC1, nextC1)) {
      currCourt = 1;
      nextCourt = 1;
    } else if (sameMatchup(currC1, nextC2)) {
      currCourt = 1;
      nextCourt = 2;
    } else if (sameMatchup(currC2, nextC1)) {
      currCourt = 2;
      nextCourt = 1;
    } else if (sameMatchup(currC2, nextC2)) {
      currCourt = 2;
      nextCourt = 2;
    }
    if (currCourt !== null && nextCourt !== null) {
      const courtDetails: Conflict['courtDetails'] = [
        {
          gameNumber: curr.gameNumber,
          court: currCourt,
          home: currCourt === 1 ? curr.court1Team1 : curr.court2Team1,
          away: currCourt === 1 ? curr.court1Team2 : curr.court2Team2,
          ref: currCourt === 1 ? curr.court1Ref : curr.court2Ref,
        },
        {
          gameNumber: next.gameNumber,
          court: nextCourt,
          home: nextCourt === 1 ? next.court1Team1 : next.court2Team1,
          away: nextCourt === 1 ? next.court1Team2 : next.court2Team2,
          ref: nextCourt === 1 ? next.court1Ref : next.court2Ref,
        },
      ];
      const matchup = [...(currCourt === 1 ? currC1 : currC2)].sort();
      detectedConflicts.push({
        gameNumber: next.gameNumber,
        team: `${matchup[0]} & ${matchup[1]}`,
        conflicts: [
          `Played each other in consecutive games (${curr.gameNumber} and ${next.gameNumber})`,
        ],
        severity: 'warning',
        conflictType: 'consecutive-matchup',
        courtDetails,
      });
    }
  }

  // Home/away imbalance over the selected scope (e.g. full season on "All weeks"):
  // - Strictly more than half of slots on one side, OR
  // - At least 2 more games on one side than the other (catches 6–4, 7–3, etc. on even totals
  //   where floating half can edge-case miss in weird data, and matches "skewed season" intent).
  if (includeHomeAway) {
    const minSlots = 4;
    for (const [team, s] of Object.entries(stats)) {
      const { gamesPlayed, homeGames, awayGames } = s;
      const slots = homeGames + awayGames;
      if (slots < minSlots) continue;
      const diff = Math.abs(homeGames - awayGames);
      const moreThanHalf = homeGames > slots / 2 || awayGames > slots / 2;
      const skewByAtLeastTwo = diff >= 2;
      if (!moreThanHalf && !skewByAtLeastTwo) continue;

      let reason: string;
      if (moreThanHalf && skewByAtLeastTwo) {
        reason =
          homeGames > awayGames
            ? 'more than half at home, and 2+ games off an even split'
            : 'more than half away, and 2+ games off an even split';
      } else if (moreThanHalf) {
        reason = homeGames > awayGames ? 'more than half at home' : 'more than half away';
      } else {
        reason = '2+ more games on one side than the other (off an even split)';
      }

      detectedConflicts.push({
        gameNumber: games[0]?.gameNumber ?? '',
        team,
        conflicts: [
          `Home/away imbalance: ${homeGames} home / ${awayGames} away (${slots} games with home/away recorded${gamesPlayed !== slots ? `; ${gamesPlayed} games played total` : ''}) — ${reason}`,
        ],
        severity: 'alert',
        conflictType: 'home-away-imbalance',
      });
    }
  }

  return { games, teamStats: stats, conflicts: detectedConflicts };
}

