export type LevelProgressState = {
  level: number;
  nextLevel: number;
  currentThreshold: number;
  nextThreshold: number;
  remaining: number;
  progressPct: number;
};

export function threshold(level: number): number {
  const safeLevel = Math.floor(level);
  if (safeLevel <= 0) return 0;
  if (safeLevel <= 5) return (safeLevel * (safeLevel + 1)) / 2;
  return 15 + (safeLevel - 5) * 5;
}

export function getLevelFromCount(count: number): number {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount <= 0) return 0;
  let level = 0;
  while (safeCount >= threshold(level + 1)) {
    level += 1;
  }
  return level;
}

export function getLevelProgressFromCount(count: number): LevelProgressState {
  const safeCount = Math.max(0, Math.floor(count));
  const level = getLevelFromCount(safeCount);
  const nextLevel = level + 1;
  const currentThreshold = threshold(level);
  const nextThreshold = threshold(nextLevel);
  const span = Math.max(1, nextThreshold - currentThreshold);
  const progressPct = Math.min(100, Math.max(0, ((safeCount - currentThreshold) / span) * 100));
  const remaining = Math.max(0, nextThreshold - safeCount);

  return {
    level,
    nextLevel,
    currentThreshold,
    nextThreshold,
    remaining,
    progressPct
  };
}
