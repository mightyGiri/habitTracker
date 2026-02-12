import { computeLevelStats, getRequiredDone } from './level-utils';

export type LevelProgressState = {
  level: number;
  nextLevel: number;
  currentThreshold: number;
  nextThreshold: number;
  remaining: number;
  progressPct: number;
};

export function threshold(level: number): number {
  return getRequiredDone(level);
}

export function getLevelFromCount(count: number): number {
  return computeLevelStats(count).level;
}

export function getLevelProgressFromCount(count: number): LevelProgressState {
  const progress = computeLevelStats(count);
  const currentThreshold = progress.requiredForNext - progress.requiredThisLevel;
  const nextThreshold = progress.requiredForNext;
  const progressPct = progress.progressPercent * 100;
  const remaining = progress.remainingToNext;

  return {
    level: progress.level,
    nextLevel: progress.nextLevel,
    currentThreshold,
    nextThreshold,
    remaining,
    progressPct
  };
}
