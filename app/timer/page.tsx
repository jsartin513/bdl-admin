'use client'

import { useState, useEffect } from 'react';
import { TimerComponent } from '../components/timer';
import { GameInfo, NextGameInfo } from '../components/timer/types';
import { Game } from '../components/schedule/types';
import Link from 'next/link';

export default function TimerPage() {
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert Game objects from schedule API to GameInfo for timer
  const convertToGameInfo = (game: Game): GameInfo => {
    // Since we're only showing Week 4 for now, set week to 4
    const week = 4;
    
    return {
      gameNumber: game.gameNumber,
      court1Team1: game.court1Team1,
      court1Team2: game.court1Team2,
      court2Team1: game.court2Team1,
      court2Team2: game.court2Team2,
      week
    };
  };

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        // For now, only fetch Week 4 games
        const response = await fetch('/api/schedules-static?week=4');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch schedule');
        }

        // Parse CSV data to extract games
        const csvData = data.csvData || '';
        const lines = csvData.split('\n').filter((line: string) => line.trim() !== '');
        const gameList: Game[] = [];

        for (let i = 1; i < lines.length; i += 2) {
          const gameLine = lines[i];
          const refLine = lines[i + 1];

          if (!gameLine || !gameLine.includes('Game ')) {
            continue;
          }

          const gameData = gameLine.split(',');
          const refData = refLine ? refLine.split(',') : [];

          const game: Game = {
            gameNumber: gameData[0]?.trim() || '',
            court1Team1: gameData[1]?.trim() || '',
            court1Team2: gameData[3]?.trim() || '',
            court1Ref: refData[1]?.replace(/Refs:\s*/g, '')?.trim() || '',
            court2Team1: gameData[6]?.trim() || '',
            court2Team2: gameData[8]?.trim() || '',
            court2Ref: refData[6]?.replace(/Refs:\s*/g, '')?.trim() || ''
          };

          if (game.gameNumber) {
            gameList.push(game);
          }
        }

        const convertedGames = gameList.map(convertToGameInfo);
        setGames(convertedGames);
        setError(null);
      } catch (err) {
        console.error('Error fetching games:', err);
        setError(err instanceof Error ? err.message : 'Failed to load games');
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  const currentGame = games[currentGameIndex];
  const nextGame: NextGameInfo | undefined = games[currentGameIndex + 1] 
    ? { ...games[currentGameIndex + 1], timeUntilStart: 300 } // 5 minutes until next game
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
    if (index >= 0 && index < games.length) {
      setCurrentGameIndex(index);
    }
  };

  const goToPreviousGame = () => {
    goToGame(currentGameIndex - 1);
  };

  const goToNextGame = () => {
    goToGame(currentGameIndex + 1);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Loading Games...</h1>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Error Loading Games</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Navigation Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Dodgeball League Timer
              </h1>
              <p className="text-lg text-gray-600">Week 4 Games</p>
            </div>
            <Link 
              href="/schedules-static" 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Schedule
            </Link>
          </div>
          
          {/* TODO: After November 5, add week selector dropdown here for weeks 5 & 6 */}
          
          {/* Game Selection */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-center">
              {/* Game Selection Dropdown */}
              <div className="flex items-center gap-3">
                <label className="font-medium text-gray-700">Quick Jump:</label>
                <select
                  value={currentGameIndex}
                  onChange={(e) => goToGame(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  {games.map((game, index) => (
                    <option key={index} value={index}>
                      {game.gameNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Timer Component */}
        <TimerComponent
          currentGame={currentGame}
          nextGame={nextGame}
          onTimerComplete={handleTimerComplete}
          onTimerStart={handleTimerStart}
          onNextGame={currentGameIndex < games.length - 1 ? goToNextGame : undefined}
          onPreviousGame={currentGameIndex > 0 ? goToPreviousGame : undefined}
          canGoNext={currentGameIndex < games.length - 1}
          canGoPrevious={currentGameIndex > 0}
          currentGameIndex={currentGameIndex}
          totalGames={games.length}
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