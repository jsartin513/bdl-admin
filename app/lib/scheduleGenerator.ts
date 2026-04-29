import { Game } from '../components/schedule/types';

export interface ScheduleGenerationOptions {
  matchupsPerTeam: number; // Each team must play this many matchups (even distribution)
  availableTime?: number; // Total available time in minutes (default: 90)
  setupBreakdownTime?: number; // Setup + breakdown time in minutes (default: 30)
}

export interface ScheduleResult {
  games: Game[];
  rounds: RoundInfo[];
  totalTime: number; // in minutes
  roundRobinCompleteness: number; // percentage (0-100)
  teamStats: {
    team: string;
    gamesPlayed: number;
    gamesReffed: number;
  }[];
  roundDuration: number; // Calculated duration per round in minutes
}

export interface RoundInfo {
  roundNumber: number;
  games: Game[];
  duration: number; // in minutes
  courtsUsed: number; // 1 or 2
}

/**
 * Generates a schedule with even distribution of matchups per team
 * Each team plays the same number of matchups
 * 
 * Rules:
 * - Each team must play an even amount during the night
 * - 1 matchup per team = 1 round on 2 courts + 1 round on 1 court (3 games total)
 * - 2 matchups per team = 3 rounds on 2 courts (6 games total)
 * - Calculates round duration to fit within available time
 */
export function generateEvenDistributionSchedule(
  teams: string[],
  options: ScheduleGenerationOptions
): ScheduleResult {
  const {
    matchupsPerTeam,
    availableTime = 90,
    setupBreakdownTime = 30,
  } = options;

  if (teams.length !== 6) {
    throw new Error('Schedule generation currently requires exactly 6 teams');
  }

  // Calculate total games needed
  // Each team plays matchupsPerTeam games, so total games = (teams.length * matchupsPerTeam) / 2
  const totalGames = (teams.length * matchupsPerTeam) / 2;

  // Determine round structure
  // With 2 courts, we can have 2 games per round (4 teams playing, 2 reffing)
  // If totalGames is odd, last round will have 1 game on 1 court
  const roundsWithTwoCourts = Math.floor(totalGames / 2);
  const hasSingleCourtRound = totalGames % 2 === 1;
  const totalRounds = roundsWithTwoCourts + (hasSingleCourtRound ? 1 : 0);

  // Calculate round duration to fit in available time
  // Available play time = availableTime - setupBreakdownTime
  const playTime = availableTime - setupBreakdownTime;
  const roundDuration = Math.floor(playTime / totalRounds);

  // Generate all possible matchups
  const allMatchups: Array<[string, string]> = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      allMatchups.push([teams[i], teams[j]]);
    }
  }

  // Select matchups ensuring each team plays exactly matchupsPerTeam games
  const selectedMatchups: Array<[string, string]> = [];
  const teamGameCount: Record<string, number> = {};
  teams.forEach(team => { teamGameCount[team] = 0; });

  // Shuffle for variety, then select matchups that maintain even distribution
  const shuffledMatchups = [...allMatchups].sort(() => Math.random() - 0.5);
  
  for (const matchup of shuffledMatchups) {
    const [team1, team2] = matchup;
    
    // Check if both teams can still play more games
    if (teamGameCount[team1] < matchupsPerTeam && teamGameCount[team2] < matchupsPerTeam) {
      selectedMatchups.push(matchup);
      teamGameCount[team1]++;
      teamGameCount[team2]++;
      
      if (selectedMatchups.length >= totalGames) {
        break;
      }
    }
  }

  // If we didn't get enough matchups, fill with remaining (shouldn't happen with proper matchupsPerTeam)
  if (selectedMatchups.length < totalGames) {
    for (const matchup of shuffledMatchups) {
      if (selectedMatchups.includes(matchup)) continue;
      selectedMatchups.push(matchup);
      if (selectedMatchups.length >= totalGames) break;
    }
  }

  // Distribute matchups across rounds
  const games: Game[] = [];
  const rounds: RoundInfo[] = [];
  const teamActivity: Record<string, { played: number; reffed: number }> = {};
  
  // Initialize team activity tracking
  teams.forEach(team => {
    teamActivity[team] = { played: 0, reffed: 0 };
  });

  let matchupIndex = 0;
  let gameNumber = 1;

  // Create rounds with 2 courts
  for (let roundNum = 1; roundNum <= roundsWithTwoCourts; roundNum++) {
    const roundGames: Game[] = [];
    
    // Get 2 matchups for this round
    const matchup1 = selectedMatchups[matchupIndex++];
    const matchup2 = selectedMatchups[matchupIndex++];

    // Find refs (teams not in either matchup)
    const teamsInMatchups = new Set([...matchup1, ...matchup2]);
    const availableRefs = teams.filter(t => !teamsInMatchups.has(t));
    
    if (availableRefs.length < 2) {
      throw new Error('Not enough teams available for reffing');
    }

    const game: Game = {
      gameNumber: `Game ${gameNumber++}`,
      court1Team1: matchup1[0],
      court1Team2: matchup1[1],
      court1Ref: availableRefs[0],
      court2Team1: matchup2[0],
      court2Team2: matchup2[1],
      court2Ref: availableRefs[1],
    };

    roundGames.push(game);
    games.push(game);

    // Update activity
    teamActivity[matchup1[0]].played++;
    teamActivity[matchup1[1]].played++;
    teamActivity[availableRefs[0]].reffed++;
    teamActivity[matchup2[0]].played++;
    teamActivity[matchup2[1]].played++;
    teamActivity[availableRefs[1]].reffed++;

    rounds.push({
      roundNumber: roundNum,
      games: roundGames,
      duration: roundDuration,
      courtsUsed: 2,
    });
  }

  // Create single court round if needed
  // In this case, 2 teams play, 1 team refs, and 3 teams have a break (acceptable for single court round)
  if (hasSingleCourtRound) {
    const matchup = selectedMatchups[matchupIndex];
    const teamsInMatchup = new Set(matchup);
    const availableRefs = teams.filter(t => !teamsInMatchup.has(t));
    
    if (availableRefs.length < 1) {
      throw new Error('Not enough teams available for reffing');
    }

    const game: Game = {
      gameNumber: `Game ${gameNumber++}`,
      court1Team1: matchup[0],
      court1Team2: matchup[1],
      court1Ref: availableRefs[0],
      court2Team1: 'BYE',
      court2Team2: 'BYE',
      court2Ref: 'BYE',
    };

    games.push(game);

    // Update activity
    teamActivity[matchup[0]].played++;
    teamActivity[matchup[1]].played++;
    teamActivity[availableRefs[0]].reffed++;

    rounds.push({
      roundNumber: roundsWithTwoCourts + 1,
      games: [game],
      duration: roundDuration,
      courtsUsed: 1,
    });
  }

  // Calculate round-robin completeness
  const totalPossibleMatchups = (teams.length * (teams.length - 1)) / 2;
  const uniqueMatchups = new Set<string>();
  
  games.forEach(game => {
    if (game.court1Team1 && game.court1Team2 && game.court1Team1 !== 'BYE' && game.court1Team2 !== 'BYE') {
      uniqueMatchups.add([game.court1Team1, game.court1Team2].sort().join(' vs '));
    }
    if (game.court2Team1 && game.court2Team2 && game.court2Team1 !== 'BYE' && game.court2Team2 !== 'BYE') {
      uniqueMatchups.add([game.court2Team1, game.court2Team2].sort().join(' vs '));
    }
  });

  const roundRobinCompleteness = (uniqueMatchups.size / totalPossibleMatchups) * 100;

  // Build team stats
  const teamStats = teams.map(team => ({
    team,
    gamesPlayed: teamActivity[team].played,
    gamesReffed: teamActivity[team].reffed,
  }));

  return {
    games,
    rounds,
    totalTime: playTime,
    roundRobinCompleteness,
    teamStats,
    roundDuration,
  };
}

/**
 * Legacy function - kept for backwards compatibility
 * @deprecated Use generateEvenDistributionSchedule instead
 */
export function generateBalancedRotationSchedule(
  teams: string[],
  options: Partial<ScheduleGenerationOptions> = {}
): ScheduleResult {
  return generateEvenDistributionSchedule(teams, {
    matchupsPerTeam: 5,
    ...options,
  });
}

/**
 * Validates that a schedule completes a full round-robin
 */
export function validateRoundRobinCompleteness(
  games: Game[],
  teams: string[]
): { isValid: boolean; missingMatchups: string[]; completeness: number } {
  const totalPossibleMatchups = (teams.length * (teams.length - 1)) / 2;
  const requiredMatchups = new Set<string>();

  // Generate all required matchups
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      requiredMatchups.add([teams[i], teams[j]].sort().join(' vs '));
    }
  }

  // Find all matchups in the schedule
  const foundMatchups = new Set<string>();
  
  games.forEach(game => {
    // Court 1
    if (game.court1Team1 && game.court1Team2 && 
        game.court1Team1 !== 'BYE' && game.court1Team2 !== 'BYE') {
      foundMatchups.add([game.court1Team1, game.court1Team2].sort().join(' vs '));
    }
    // Court 2
    if (game.court2Team1 && game.court2Team2 && 
        game.court2Team1 !== 'BYE' && game.court2Team2 !== 'BYE') {
      foundMatchups.add([game.court2Team1, game.court2Team2].sort().join(' vs '));
    }
  });

  // Find missing matchups
  const missingMatchups = Array.from(requiredMatchups).filter(
    matchup => !foundMatchups.has(matchup)
  );

  const completeness = ((totalPossibleMatchups - missingMatchups.length) / totalPossibleMatchups) * 100;

  return {
    isValid: missingMatchups.length === 0,
    missingMatchups,
    completeness,
  };
}

