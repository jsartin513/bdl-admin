/**
 * Example usage of the schedule generation functions
 * This file demonstrates how to use the new schedule generation features
 */

import { generateEvenDistributionSchedule, validateRoundRobinCompleteness } from './scheduleGenerator';
import { GameFormat } from '../components/timer/types';

// Example 1: Generate schedule with 1 matchup per team (3 games total)
export function example1MatchupPerTeam() {
  const teams = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'];
  
  const result = generateEvenDistributionSchedule(teams, {
    matchupsPerTeam: 1,
    availableTime: 120, // 2 hours total
    setupBreakdownTime: 30, // 30 min setup/breakdown
  });

  console.log('Schedule with 1 matchup per team:');
  console.log(`Total games: ${result.games.length}`);
  console.log(`Total rounds: ${result.rounds.length}`);
  console.log(`Round duration: ${result.roundDuration} minutes`);
  console.log(`Round-robin completeness: ${result.roundRobinCompleteness.toFixed(1)}%`);
  console.log('Rounds:');
  result.rounds.forEach(round => {
    console.log(`  Round ${round.roundNumber}: ${round.courtsUsed} court(s), ${round.duration} min`);
  });

  return result;
}

// Example 2: Generate schedule with 2 matchups per team (6 games total)
export function example2MatchupsPerTeam() {
  const teams = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'];
  
  const result = generateEvenDistributionSchedule(teams, {
    matchupsPerTeam: 2,
    availableTime: 120,
    setupBreakdownTime: 30,
  });

  console.log('Schedule with 2 matchups per team:');
  console.log(`Total games: ${result.games.length}`);
  console.log(`Total rounds: ${result.rounds.length}`);
  console.log(`Round duration: ${result.roundDuration} minutes`);
  console.log(`Round-robin completeness: ${result.roundRobinCompleteness.toFixed(1)}%`);

  return result;
}

// Example 3: Validate round-robin completeness
export function exampleValidateSchedule(games: any[], teams: string[]) {
  const validation = validateRoundRobinCompleteness(games, teams);
  
  console.log('Round-robin validation:');
  console.log(`Is valid: ${validation.isValid}`);
  console.log(`Completeness: ${validation.completeness.toFixed(1)}%`);
  if (validation.missingMatchups.length > 0) {
    console.log(`Missing matchups: ${validation.missingMatchups.join(', ')}`);
  }

  return validation;
}

// Example 4: Using different game formats in timer
export function exampleGameFormats() {
  // Standard format (4 min + 1 min no-block)
  const standardGame = {
    gameNumber: 'Game 1',
    court1Team1: 'Team A',
    court1Team2: 'Team B',
    court2Team1: 'Team C',
    court2Team2: 'Team D',
    court1Ref: 'Team E',
    court2Ref: 'Team F',
    format: GameFormat.STANDARD,
  };

  // Double format (20 min continuous)
  const doubleGame = {
    ...standardGame,
    gameNumber: 'Game 2',
    format: GameFormat.DOUBLE,
  };

  // Extended format (35 min continuous)
  const extendedGame = {
    ...standardGame,
    gameNumber: 'Game 3',
    format: GameFormat.EXTENDED,
  };

  return { standardGame, doubleGame, extendedGame };
}

