'use client'

import { Game } from './types';

interface RoundRobinProgressProps {
  games: Game[];
  teams: string[];
  matchupsPerTeam?: number;
  roundDuration?: number;
}

export default function RoundRobinProgress({
  games,
  teams,
  matchupsPerTeam,
  roundDuration,
}: RoundRobinProgressProps) {
  // Calculate total possible matchups
  const totalPossibleMatchups = (teams.length * (teams.length - 1)) / 2;
  
  // Find all unique matchups in the schedule
  const uniqueMatchups = new Set<string>();
  games.forEach(game => {
    if (game.court1Team1 && game.court1Team2 && game.court1Team1 !== 'BYE' && game.court1Team2 !== 'BYE') {
      uniqueMatchups.add([game.court1Team1, game.court1Team2].sort().join(' vs '));
    }
    if (game.court2Team1 && game.court2Team2 && game.court2Team1 !== 'BYE' && game.court2Team2 !== 'BYE') {
      uniqueMatchups.add([game.court2Team1, game.court2Team2].sort().join(' vs '));
    }
  });

  const completeness = (uniqueMatchups.size / totalPossibleMatchups) * 100;
  const missingMatchups = totalPossibleMatchups - uniqueMatchups.size;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      <h3 className="font-bold text-lg mb-3 text-gray-900">Round-Robin Progress</h3>
      
      <div className="space-y-3">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">Completeness</span>
            <span className="font-semibold text-gray-900">{completeness.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                completeness === 100 ? 'bg-green-500' : completeness >= 75 ? 'bg-blue-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Matchups Completed:</span>
            <span className="font-semibold text-gray-900 ml-2">{uniqueMatchups.size} / {totalPossibleMatchups}</span>
          </div>
          {missingMatchups > 0 && (
            <div>
              <span className="text-gray-600">Remaining:</span>
              <span className="font-semibold text-red-600 ml-2">{missingMatchups}</span>
            </div>
          )}
        </div>

        {/* Additional Info */}
        {(matchupsPerTeam || roundDuration) && (
          <div className="pt-2 border-t border-gray-200 text-xs text-gray-600">
            {matchupsPerTeam && (
              <div>Matchups per team: <span className="font-semibold">{matchupsPerTeam}</span></div>
            )}
            {roundDuration && (
              <div>Round duration: <span className="font-semibold">{roundDuration} minutes</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

