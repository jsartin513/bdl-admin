'use client'

import React from 'react';
import { TimerPhase, GameInfo } from './types';
import DodgeballTimer from './DodgeballTimer';

interface TimerDisplayProps {
  timer: ReturnType<typeof DodgeballTimer>;
  currentGame?: GameInfo;
  onNextGame?: () => void;
}

export default function TimerDisplay({ timer, currentGame, onNextGame }: TimerDisplayProps) {
  const {
    timerState,
    audioConfig,
    isAudioInitialized,
    startTimer,
    pauseTimer,
    resetTimer,
    skipToEnd,
    updateAudioConfig,
    formatTime,
    getPhaseText,
    nextGame
  } = timer;

  // Get display colors based on timer phase
  const getPhaseColors = (phase: TimerPhase) => {
    switch (phase) {
      case TimerPhase.READY:
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case TimerPhase.GAME_ACTIVE:
        return 'text-green-600 bg-green-50 border-green-200';
      case TimerPhase.NO_BLOCKING:
        return 'text-red-600 bg-red-50 border-red-200';
      case TimerPhase.FINISHED:
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTimeDisplaySize = (phase: TimerPhase) => {
    if (phase === TimerPhase.NO_BLOCKING) {
      return 'text-8xl font-bold animate-pulse';
    }
    return 'text-6xl font-bold';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dodgeball Round Timer
        </h1>
        {currentGame && (
          <div className="text-lg text-gray-700">
            {currentGame.gameNumber}
          </div>
        )}
      </div>

      {/* Current Teams Playing - Prominent Display */}
      {currentGame && (
        <div className="bg-blue-600 text-white rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-2xl font-bold text-center mb-4">🏐 CURRENTLY PLAYING</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-700 rounded-lg p-4 text-center">
              <h3 className="text-lg font-bold mb-2">🏀 COURT 1</h3>
              <div className="text-xl font-semibold">
                {currentGame.court1Team1}
              </div>
              <div className="text-lg text-blue-200 my-1">VS</div>
              <div className="text-xl font-semibold">
                {currentGame.court1Team2}
              </div>
            </div>
            <div className="bg-blue-700 rounded-lg p-4 text-center">
              <h3 className="text-lg font-bold mb-2">🏀 COURT 2</h3>
              <div className="text-xl font-semibold">
                {currentGame.court2Team1}
              </div>
              <div className="text-lg text-blue-200 my-1">VS</div>
              <div className="text-xl font-semibold">
                {currentGame.court2Team2}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Timer Display */}
      <div className={`text-center p-8 rounded-lg border-2 mb-6 ${getPhaseColors(timerState.phase)}`}>
        <div className={`${getTimeDisplaySize(timerState.phase)} mb-4`}>
          {formatTime(timerState.currentTime)}
        </div>
        <div className="text-2xl font-semibold mb-2">
          {getPhaseText(timerState.phase)}
        </div>
        {timerState.phase === TimerPhase.NO_BLOCKING && (
          <div className="text-lg animate-bounce">
            NO BLOCKING!
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-4 mb-6">
        {!timerState.isRunning && timerState.currentTime > 0 && (
          <button
            onClick={startTimer}
            className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-xl shadow-lg transform hover:scale-105"
          >
            🏁 START ROUND
          </button>
        )}
        
        {timerState.isRunning && (
          <button
            onClick={pauseTimer}
            className={`px-6 py-3 rounded-lg transition-colors font-semibold text-lg shadow-lg ${
              timerState.isPaused 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-yellow-600 text-white hover:bg-yellow-700'
            }`}
          >
            {timerState.isPaused ? '▶️ RESUME' : '⏸️ PAUSE'}
          </button>
        )}

        {timerState.isRunning && (
          <button
            onClick={skipToEnd}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold text-lg shadow-lg"
          >
            ⏭️ SKIP TO END
          </button>
        )}

        <button
          onClick={resetTimer}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold text-lg shadow-lg"
        >
          🔄 RESET
        </button>
      </div>

      {/* End of Round - Next Game Section */}
      {timerState.phase === TimerPhase.FINISHED && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-yellow-800 mb-4">🏆 Round Complete!</h2>
            
            {/* Score Recording Reminder */}
            <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center mb-2">
                <span className="text-2xl mr-2">⚠️</span>
                <span className="font-bold text-red-800 text-lg">IMPORTANT</span>
              </div>
              <p className="text-red-700 font-medium">
                Make sure all scores have been written down before proceeding to the next game!
              </p>
            </div>

            {/* Next Game Button */}
            {onNextGame && (
              <button
                onClick={onNextGame}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-xl shadow-lg transform hover:scale-105"
              >
                ➡️ PROCEED TO NEXT GAME
              </button>
            )}
          </div>
        </div>
      )}

      {/* Team Names Display During Game */}
      {(timerState.phase === TimerPhase.GAME_ACTIVE || timerState.phase === TimerPhase.NO_BLOCKING) && currentGame && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-blue-800 mb-4 text-center">🏐 Current Teams Playing</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
              <h3 className="font-bold text-xl mb-3 text-blue-800 text-center">Court 1</h3>
              <div className="text-center">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-center flex-1">
                    <div className="font-bold text-lg text-gray-800">{currentGame.court1Team1 || 'BYE'}</div>
                    <div className="text-sm text-blue-600 font-medium">HOME</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-600 mx-4">VS</div>
                  <div className="text-center flex-1">
                    <div className="font-bold text-lg text-gray-800">{currentGame.court1Team2 || 'BYE'}</div>
                    <div className="text-sm text-purple-600 font-medium">AWAY</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
              <h3 className="font-bold text-xl mb-3 text-blue-800 text-center">Court 2</h3>
              <div className="text-center">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-center flex-1">
                    <div className="font-bold text-lg text-gray-800">{currentGame.court2Team1 || 'BYE'}</div>
                    <div className="text-sm text-blue-600 font-medium">HOME</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-600 mx-4">VS</div>
                  <div className="text-center flex-1">
                    <div className="font-bold text-lg text-gray-800">{currentGame.court2Team2 || 'BYE'}</div>
                    <div className="text-sm text-purple-600 font-medium">AWAY</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next Game Preview */}
      {nextGame && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-lg mb-3 text-blue-900">Next Round</h3>
          <div className="text-blue-800">
            <div className="font-medium mb-2">{nextGame.gameNumber}</div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                Court 1: {nextGame.court1Team1} vs {nextGame.court1Team2}
              </div>
              <div>
                Court 2: {nextGame.court2Team1} vs {nextGame.court2Team2}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Controls */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-4 text-gray-900">Audio Settings</h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Volume Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Master Volume
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audioConfig.masterVolume}
                onChange={(e) => updateAudioConfig({ masterVolume: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(audioConfig.masterVolume * 100)}%
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Announcements
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audioConfig.announcementVolume}
                onChange={(e) => updateAudioConfig({ announcementVolume: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(audioConfig.announcementVolume * 100)}%
              </div>
            </div>
          </div>

          {/* Speech Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speech Rate
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={audioConfig.speechRate}
                onChange={(e) => updateAudioConfig({ speechRate: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                {audioConfig.speechRate.toFixed(1)}x
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speech Pitch
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={audioConfig.speechPitch}
                onChange={(e) => updateAudioConfig({ speechPitch: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                {audioConfig.speechPitch.toFixed(1)}
              </div>
            </div>
          </div>

          {/* OS Audio Control Settings */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">System Audio Control</h4>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="requestAudioFocus"
                checked={audioConfig.requestAudioFocus}
                onChange={(e) => updateAudioConfig({ requestAudioFocus: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="requestAudioFocus" className="text-sm text-gray-700">
                Request audio focus during announcements
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="quietOtherApps"
                checked={audioConfig.quietOtherApps}
                onChange={(e) => updateAudioConfig({ quietOtherApps: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="quietOtherApps" className="text-sm text-gray-700">
                Try to quiet other applications during announcements
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="externalMusicReminder"
                checked={audioConfig.externalMusicReminder}
                onChange={(e) => updateAudioConfig({ externalMusicReminder: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="externalMusicReminder" className="text-sm text-gray-700">
                Show external music reminder
              </label>
            </div>
          </div>
        </div>

        {/* External Music Reminder */}
        {audioConfig.externalMusicReminder && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm text-blue-800">
              <strong>🎵 External Music Setup:</strong>
              <ul className="mt-2 space-y-1">
                <li>• Start your music (Spotify, Apple Music, etc.) before beginning the timer</li>
                <li>• The timer will attempt to take audio focus during announcements</li>
                <li>• You may need to manually adjust music volume for best results</li>
                <li>• Some browsers may show notifications to help manage audio</li>
              </ul>
            </div>
          </div>
        )}

        {/* Audio Status */}
        <div className="mt-4 p-3 bg-white rounded border">
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Audio Status: </span>
              <span className={isAudioInitialized ? 'text-green-600' : 'text-yellow-600'}>
                {isAudioInitialized ? 'Ready' : 'Click Start to initialize audio'}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              Audio focus and system integration will be attempted when starting the timer
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}