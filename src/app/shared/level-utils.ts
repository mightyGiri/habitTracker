export type LevelProgress = {
  totalDone: number;
  level: number;
  nextLevel: number;
  requiredForNext: number;
  progressInLevel: number;
  requiredThisLevel: number;
  progressPercent: number;
  remainingToNext: number;
};

const FLAT_STEP_START_LEVEL = 5;
const FLAT_STEP_SIZE = 5;

export function getRequiredDone(level: number): number {
  const safeLevel = Math.max(0, Math.floor(level));
  if (safeLevel <= 0) {
    return 0;
  }
  if (safeLevel <= FLAT_STEP_START_LEVEL) {
    return (safeLevel * (safeLevel + 1)) / 2;
  }
  const levelFiveThreshold = (FLAT_STEP_START_LEVEL * (FLAT_STEP_START_LEVEL + 1)) / 2;
  return levelFiveThreshold + (safeLevel - FLAT_STEP_START_LEVEL) * FLAT_STEP_SIZE;
}

export function getLevelFromTotalDone(totalDone: number): number {
  const safeTotalDone = Math.max(0, Math.floor(totalDone));
  if (safeTotalDone <= 0) {
    return 0;
  }
  let level = 0;
  while (safeTotalDone >= getRequiredDone(level + 1)) {
    level += 1;
  }
  return level;
}

export function computeLevelStats(totalWins: number): LevelProgress {
  const safeTotalDone = Math.max(0, Math.floor(totalWins));
  const level = getLevelFromTotalDone(safeTotalDone);
  const nextLevel = level + 1;
  const requiredForNext = getRequiredDone(nextLevel);
  const requiredForCurrent = getRequiredDone(level);
  const progressInLevel = safeTotalDone - requiredForCurrent;
  const requiredThisLevel = Math.max(requiredForNext - requiredForCurrent, 1);
  const progressPercent = Math.min(Math.max(progressInLevel / requiredThisLevel, 0), 1);
  const remainingToNext = Math.max(requiredForNext - safeTotalDone, 0);

  return {
    totalDone: safeTotalDone,
    level,
    nextLevel,
    requiredForNext,
    progressInLevel,
    requiredThisLevel,
    progressPercent,
    remainingToNext
  };
}

export function getLevelProgress(totalDone: number): LevelProgress {
  return computeLevelStats(totalDone);
}
