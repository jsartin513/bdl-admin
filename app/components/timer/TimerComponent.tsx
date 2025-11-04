'use client'

import React from 'react';
import DodgeballTimer from './DodgeballTimer';
import TimerDisplay from './TimerDisplay';
import { GameInfo, NextGameInfo } from './types';

interface TimerComponentProps {
  currentGame?: GameInfo;
  nextGame?: NextGameInfo;
  onTimerComplete?: () => void;
  onTimerStart?: () => void;
  onNextGame?: () => void;
  className?: string;
}

export default function TimerComponent({
  currentGame,
  nextGame,
  onTimerComplete,
  onTimerStart,
  onNextGame,
  className = ''
}: TimerComponentProps) {
  const timer = DodgeballTimer({
    currentGame,
    nextGame,
    onTimerComplete,
    onTimerStart
  });

  // Create enhanced onNextGame that also resets timer
  const handleNextGame = () => {
    if (onNextGame) {
      onNextGame();
      // Reset timer after advancing to next game
      setTimeout(() => {
        timer.resetTimer();
      }, 50); // Small delay to ensure game change is processed
    }
  };

  return (
    <div className={className}>
      <TimerDisplay timer={timer} currentGame={currentGame} onNextGame={handleNextGame} />
    </div>
  );
}