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

export function getRequiredDone(level: number): number {
  if (level <= 0) return 0;
  return (level * (level + 1)) / 2;
}

export function getLevelFromTotalDone(totalDone: number): number {
  if (totalDone <= 0) return 0;
  return Math.floor((Math.sqrt(8 * totalDone + 1) - 1) / 2);
}

export function getLevelProgress(totalDone: number): LevelProgress {
  const level = getLevelFromTotalDone(totalDone);
  const nextLevel = level + 1;
  const requiredForNext = getRequiredDone(nextLevel);
  const requiredForCurrent = getRequiredDone(level);
  const progressInLevel = totalDone - requiredForCurrent;
  const requiredThisLevel = Math.max(requiredForNext - requiredForCurrent, 1);
  const progressPercent = Math.min(Math.max(progressInLevel / requiredThisLevel, 0), 1);
  const remainingToNext = Math.max(requiredForNext - totalDone, 0);

  return {
    totalDone,
    level,
    nextLevel,
    requiredForNext,
    progressInLevel,
    requiredThisLevel,
    progressPercent,
    remainingToNext
  };
}
