'use client'

import React from 'react';
import DodgeballTimer from '../components/timer/DodgeballTimer';
import { TimerPhase } from '../components/timer/types';

export default function StandaloneTimerPage() {
  const timer = DodgeballTimer({
    // No game info needed for standalone timer
  });

  const {
    timerState,
    audioConfig,
    isAudioInitialized,
    isPlayingStartAnnouncement,
    startTimer,
    pauseTimer,
    resetTimer,
    skipToEnd,
    updateAudioConfig,
    formatTime,
    getPhaseText
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
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Round Timer
          </h1>
          <p className="text-lg text-gray-600">
            Standalone dodgeball round timer
          </p>
        </div>

        {/* External Music Reminder */}
        {audioConfig.externalMusicReminder && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-yellow-600 text-xl">🎵</div>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800 mb-1">Background Music Tip</h3>
                <p className="text-sm text-yellow-700">
                  For best announcement clarity, manually pause external music players (Spotify, Apple Music, etc.) 
                  before starting the timer.
                </p>
                <button
                  onClick={() => updateAudioConfig({ externalMusicReminder: false })}
                  className="mt-2 text-xs text-yellow-600 hover:text-yellow-800 underline"
                >
                  Hide this reminder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Starting Overlay */}
        {isPlayingStartAnnouncement && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-pulse">
            <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-12 rounded-2xl shadow-2xl transform scale-110">
              <div className="text-center">
                <div className="text-6xl font-bold mb-4 animate-bounce">🏁</div>
                <div className="text-4xl font-bold mb-2">ROUND STARTING!</div>
                <div className="text-2xl font-semibold opacity-90">
                  Side ready, side ready, dodgeball!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Timer Display */}
        <div className={`text-center p-8 rounded-lg border-2 mb-6 transition-all duration-300 ${
          isPlayingStartAnnouncement 
            ? 'bg-gradient-to-br from-green-50 to-blue-50 border-green-400 shadow-xl transform scale-105' 
            : getPhaseColors(timerState.phase)
        }`}>
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
              className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300 font-bold text-xl shadow-lg transform hover:scale-105 animate-pulse"
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

          {timerState.phase !== TimerPhase.FINISHED && (
            <button
              onClick={resetTimer}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold text-lg shadow-lg"
            >
              🔄 RESET
            </button>
          )}
        </div>

        {/* End of Round Section */}
        {timerState.phase === TimerPhase.FINISHED && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-yellow-800 mb-4">🏆 Round Complete!</h2>
              <button
                onClick={resetTimer}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-xl shadow-lg transform hover:scale-105"
              >
                🔄 START NEW ROUND
              </button>
            </div>
          </div>
        )}

        {/* Audio Controls */}
        <div className="bg-white rounded-lg p-6 shadow-lg">
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
          </div>

          {/* OS Audio Control Settings */}
          <div className="mt-6 space-y-3">
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

          {/* Audio Status */}
          <div className="mt-4 p-3 bg-gray-50 rounded border">
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

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-6">
          <h2 className="text-xl font-bold text-blue-900 mb-4">Timer Instructions</h2>
          <div className="grid md:grid-cols-2 gap-6 text-blue-800">
            <div>
              <h3 className="font-semibold mb-2">Round Sequence:</h3>
              <ul className="space-y-1 text-sm">
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
      </div>
    </div>
  );
}

