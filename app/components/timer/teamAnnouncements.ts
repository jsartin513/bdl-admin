// Team name announcement utilities
import { GameInfo, NextGameInfo } from './types';

export interface TeamAnnouncementConfig {
  enableTeamAnnouncements: boolean;
  startFromWeek: number;
  announcementDelay: number; // seconds before round starts to announce teams
  includeByeTeams: boolean;
}

export const DEFAULT_TEAM_ANNOUNCEMENT_CONFIG: TeamAnnouncementConfig = {
  enableTeamAnnouncements: true,
  startFromWeek: 4,
  announcementDelay: 30, // Announce teams 30 seconds before round starts
  includeByeTeams: false
};

/**
 * Formats a team name for better pronunciation by text-to-speech
 */
export function formatTeamNameForSpeech(teamName: string): string {
  if (!teamName || teamName === 'BYE' || teamName === 'TBD') {
    return teamName;
  }

  // Handle common abbreviations and formatting
  const formatted = teamName
    // Handle numbers at the end of team names
    .replace(/(\d+)$/, ' $1')
    // Add spaces before capital letters in camelCase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Handle common dodgeball team name patterns
    .replace(/\bFC\b/gi, 'Football Club')
    .replace(/\bSC\b/gi, 'Sports Club')
    .replace(/\bDD\b/gi, 'Dodgeball')
    .replace(/\bDB\b/gi, 'Dodgeball')
    .replace(/\bDDG\b/gi, 'Dodgeball')
    // Handle punctuation for better speech
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return formatted;
}

/**
 * Creates announcement text for team matchups
 */
export function createTeamAnnouncementText(game: GameInfo, includeByeTeams: boolean = false): string {
  const announcements: string[] = [];
  
  // Court 1 announcement
  if (game.court1Team1 && game.court1Team2) {
    const team1 = formatTeamNameForSpeech(game.court1Team1);
    const team2 = formatTeamNameForSpeech(game.court1Team2);
    
    if (includeByeTeams || (team1 !== 'BYE' && team2 !== 'BYE')) {
      if (team1 === 'BYE' || team2 === 'BYE') {
        const playingTeam = team1 === 'BYE' ? team2 : team1;
        announcements.push(`Court 1: ${playingTeam} has a bye`);
      } else {
        announcements.push(`Court 1: ${team1} versus ${team2}`);
      }
    }
  }

  // Court 2 announcement
  if (game.court2Team1 && game.court2Team2) {
    const team1 = formatTeamNameForSpeech(game.court2Team1);
    const team2 = formatTeamNameForSpeech(game.court2Team2);
    
    if (includeByeTeams || (team1 !== 'BYE' && team2 !== 'BYE')) {
      if (team1 === 'BYE' || team2 === 'BYE') {
        const playingTeam = team1 === 'BYE' ? team2 : team1;
        announcements.push(`Court 2: ${playingTeam} has a bye`);
      } else {
        announcements.push(`Court 2: ${team1} versus ${team2}`);
      }
    }
  }

  if (announcements.length === 0) {
    return '';
  }

  const intro = announcements.length > 1 
    ? `Next round: ${game.gameNumber}. ` 
    : `Next round: ${game.gameNumber}. `;
    
  return intro + announcements.join('. ');
}

/**
 * Determines if team announcements should be enabled for a given week
 */
export function shouldAnnounceTeams(week: number | undefined, config: TeamAnnouncementConfig): boolean {
  if (!config.enableTeamAnnouncements || !week) {
    return false;
  }
  
  return week >= config.startFromWeek;
}

/**
 * Creates a comprehensive announcement including game number and teams
 */
export function createFullGameAnnouncement(
  currentGame: GameInfo | undefined,
  nextGame: NextGameInfo | undefined,
  week: number | undefined,
  config: TeamAnnouncementConfig = DEFAULT_TEAM_ANNOUNCEMENT_CONFIG
): string | null {
  
  // Only announce if we're in week 4 or later
  if (!shouldAnnounceTeams(week, config) || !nextGame) {
    return null;
  }

  const teamAnnouncement = createTeamAnnouncementText(nextGame, config.includeByeTeams);
  
  if (!teamAnnouncement) {
    return null;
  }

  // Add timing information if available
  let timeInfo = '';
  if (nextGame.timeUntilStart && nextGame.timeUntilStart > 0) {
    const minutes = Math.floor(nextGame.timeUntilStart / 60);
    const seconds = nextGame.timeUntilStart % 60;
    
    if (minutes > 0) {
      timeInfo = ` in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      if (seconds > 0) {
        timeInfo += ` and ${seconds} second${seconds !== 1 ? 's' : ''}`;
      }
    } else if (seconds > 0) {
      timeInfo = ` in ${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
  }

  return `${teamAnnouncement}${timeInfo}`;
}

/**
 * Parses week number from game number or other identifiers
 */
export function extractWeekFromGame(game: GameInfo): number | undefined {
  if (game.week) {
    return game.week;
  }

  // Try to extract week from game number (e.g., "Week 4 Game 1")
  const weekMatch = game.gameNumber.match(/week\s*(\d+)/i);
  if (weekMatch) {
    return parseInt(weekMatch[1], 10);
  }

  // Try to extract from other patterns
  const gameMatch = game.gameNumber.match(/(\d+)/);
  if (gameMatch) {
    const gameNum = parseInt(gameMatch[1], 10);
    // Assume games 1-8 are week 1, 9-16 are week 2, etc. (adjust based on your schedule)
    return Math.ceil(gameNum / 8);
  }

  return undefined;
}

/**
 * Enhanced team name processing for common dodgeball team naming patterns
 */
export function enhanceTeamNamePronunciation(teamName: string): string {
  const formatted = formatTeamNameForSpeech(teamName);
  
  // Add custom pronunciation rules for specific team names or patterns
  const pronunciationMap: Record<string, string> = {
    // Add specific team name pronunciations here
    'BAMF': 'B A M F',
    'MVP': 'M V P',
    'FAQ': 'F A Q',
    'DIY': 'D I Y',
    'PDF': 'P D F',
    'SQL': 'S Q L',
    'API': 'A P I',
    'CEO': 'C E O',
    'FBI': 'F B I',
    'CIA': 'C I A',
    // Add more as needed
  };

  // Check if the team name (or part of it) needs special pronunciation
  for (const [original, pronunciation] of Object.entries(pronunciationMap)) {
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    if (regex.test(formatted)) {
      return formatted.replace(regex, pronunciation);
    }
  }

  return formatted;
}