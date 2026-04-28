'use client'

import { useState } from 'react';

export interface ScoreTrackerProps {
  team1Name: string;
  team2Name: string;
  onScoreUpdate?: (team1Score: number, team2Score: number) => void;
  initialScore1?: number;
  initialScore2?: number;
}

export default function ScoreTracker({
  team1Name,
  team2Name,
  onScoreUpdate,
  initialScore1 = 0,
  initialScore2 = 0,
}: ScoreTrackerProps) {
  const [score1, setScore1] = useState(initialScore1);
  const [score2, setScore2] = useState(initialScore2);

  const updateScore = (team: 1 | 2, delta: number) => {
    if (team === 1) {
      const newScore = Math.max(0, score1 + delta);
      setScore1(newScore);
      onScoreUpdate?.(newScore, score2);
    } else {
      const newScore = Math.max(0, score2 + delta);
      setScore2(newScore);
      onScoreUpdate?.(score1, newScore);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
      <h3 className="text-xl font-bold mb-4 text-center text-gray-900">Score</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Team 1 Score */}
        <div className="text-center">
          <div className="text-sm font-medium text-gray-600 mb-2">{team1Name}</div>
          <div className="text-4xl font-bold text-blue-600 mb-3">{score1}</div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => updateScore(1, -1)}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 active:bg-red-700 transition-colors"
              aria-label={`Decrease ${team1Name} score`}
            >
              −
            </button>
            <button
              onClick={() => updateScore(1, 1)}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 active:bg-green-700 transition-colors"
              aria-label={`Increase ${team1Name} score`}
            >
              +
            </button>
          </div>
        </div>

        {/* Team 2 Score */}
        <div className="text-center">
          <div className="text-sm font-medium text-gray-600 mb-2">{team2Name}</div>
          <div className="text-4xl font-bold text-purple-600 mb-3">{score2}</div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => updateScore(2, -1)}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 active:bg-red-700 transition-colors"
              aria-label={`Decrease ${team2Name} score`}
            >
              −
            </button>
            <button
              onClick={() => updateScore(2, 1)}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 active:bg-green-700 transition-colors"
              aria-label={`Increase ${team2Name} score`}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div className="mt-4 text-center">
        <button
          onClick={() => {
            setScore1(0);
            setScore2(0);
            onScoreUpdate?.(0, 0);
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 active:bg-gray-700 transition-colors text-sm"
        >
          Reset Scores
        </button>
      </div>
    </div>
  );
}

