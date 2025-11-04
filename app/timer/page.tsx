'use client'

import { useState } from 'react';
import { TimerComponent } from '../components/timer';
import { GameInfo, NextGameInfo } from '../components/timer/types';
import Link from 'next/link';

// Mock data for demonstration - in real implementation, this would come from your schedule API
const MOCK_GAMES: GameInfo[] = [
  {
    gameNumber: "Week 4 Game 1",
    court1Team1: "Thunder Bolts",
    court1Team2: "Lightning Strike", 
    court2Team1: "Storm Chasers",
    court2Team2: "Wind Riders",
    week: 4
  },
  {
    gameNumber: "Week 4 Game 2", 
    court1Team1: "Fire Dragons",
    court1Team2: "Ice Phoenix",
    court2Team1: "Earth Movers", 
    court2Team2: "Water Warriors",
    week: 4
  },
  {
    gameNumber: "Week 4 Game 3",
    court1Team1: "Speed Demons", 
    court1Team2: "Power Rangers",
    court2Team1: "Night Hawks",
    court2Team2: "Day Walkers", 
    week: 4
  }
];

export default function TimerPage() {
  const [currentGameIndex, setCurrentGameIndex] = useState(0);

  const currentGame = MOCK_GAMES[currentGameIndex];
  const nextGame: NextGameInfo | undefined = MOCK_GAMES[currentGameIndex + 1] 
    ? { ...MOCK_GAMES[currentGameIndex + 1], timeUntilStart: 300 } // 5 minutes until next game
    : undefined;

  const handleTimerComplete = () => {
    console.log('Round completed!');
    // Timer complete - user will manually advance using the Next Game button
  };

  const handleTimerStart = () => {
    console.log('Round started!');
  };

  // Manual game navigation
  const goToGame = (index: number) => {
    if (index >= 0 && index < MOCK_GAMES.length) {
      setCurrentGameIndex(index);
    }
  };

  const goToPreviousGame = () => {
    goToGame(currentGameIndex - 1);
  };

  const goToNextGame = () => {
    goToGame(currentGameIndex + 1);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Navigation Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Dodgeball League Timer
            </h1>
            <Link 
              href="/schedules-static" 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Schedule
            </Link>
          </div>
          
          {/* Game Navigation */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={goToPreviousGame}
                  disabled={currentGameIndex === 0}
                  className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  ← Previous Game
                </button>
                
                <div className="text-lg font-semibold text-gray-900">
                  Game {currentGameIndex + 1} of {MOCK_GAMES.length}
                </div>
                
                <button
                  onClick={goToNextGame}
                  disabled={currentGameIndex === MOCK_GAMES.length - 1}
                  className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Next Game →
                </button>
              </div>
              
              {/* Game Selection Dropdown */}
              <select
                value={currentGameIndex}
                onChange={(e) => goToGame(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                {MOCK_GAMES.map((game, index) => (
                  <option key={index} value={index}>
                    {game.gameNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Timer Component */}
        <TimerComponent
          currentGame={currentGame}
          nextGame={nextGame}
          onTimerComplete={handleTimerComplete}
          onTimerStart={handleTimerStart}
          onNextGame={currentGameIndex < MOCK_GAMES.length - 1 ? goToNextGame : undefined}
          className="mb-6"
        />

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h2 className="text-xl font-bold text-blue-900 mb-4">Timer Instructions</h2>
          <div className="grid md:grid-cols-2 gap-6 text-blue-800">
            <div>
              <h3 className="font-semibold mb-2">Round Sequence:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Starting from Week 4, team names will be announced before each round</li>
                <li>• &ldquo;Side ready, side ready, dodgeball!&rdquo; announces round start</li>
                <li>• Time warnings at 2 min, 90s, 1 min, 30s, 20s until no blocking</li>
                <li>• &ldquo;No blocking in 10, 9, 8...&rdquo; countdown to end</li>
                <li>• Buzzer sounds at round completion</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Audio Features:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Start external music (Spotify, Apple Music, etc.) before beginning timer</li>
                <li>• Timer will attempt to take audio focus during announcements</li>
                <li>• System may show notifications to help manage audio control</li>
                <li>• Some browsers support automatic volume ducking of other apps</li>
                <li>• You may need to manually adjust music volume for best experience</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Audio Setup Instructions */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Audio Setup</h3>
          <p className="text-yellow-700 text-sm">
            <strong>Note:</strong> To use background music, add your audio file to <code>public/audio/background-music.mp3</code>. 
            The timer will work without background music, using only text-to-speech announcements and the generated buzzer sound.
          </p>
        </div>
      </div>
    </div>
  );
}