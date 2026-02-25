export type LevelProgress = {
  totalDone: number;
  totalXp: number;
  level: number;
  nextLevel: number;
  requiredForNext: number;
  progressInLevel: number;
  requiredThisLevel: number;
  progressPercent: number;
  remainingToNext: number;
};

export function getXpRequiredForNextLevel(level: number): number {
  const safeLevel = Math.max(0, Math.floor(level));
  if (safeLevel <= 0) {
    return 3;
  }
  if (safeLevel === 1) {
    return 5;
  }
  if (safeLevel === 2) {
    return 10;
  }
  return 10;
}

export function computeLevelFromTotalXp(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  requiredThisLevel: number;
  progressPercent: number;
  nextLevel: number;
  remainingToNext: number;
} {
  let level = 0;
  let remaining = Math.max(0, Math.floor(totalXp || 0));

  while (true) {
    const req = getXpRequiredForNextLevel(level);
    if (remaining < req) {
      const progressPercent = req <= 0 ? 100 : Math.round((remaining / req) * 100);
      return {
        level,
        xpIntoLevel: remaining,
        requiredThisLevel: req,
        progressPercent: Math.max(0, Math.min(100, progressPercent)),
        nextLevel: level + 1,
        remainingToNext: Math.max(req - remaining, 0)
      };
    }
    remaining -= req;
    level += 1;
  }
}

export function getRequiredDone(level: number): number {
  if (level <= 0) {
    return 0;
  }
  let total = 0;
  for (let current = 0; current < Math.floor(level); current++) {
    total += getXpRequiredForNextLevel(current);
  }
  return total;
}

export function getLevelFromTotalDone(totalDone: number): number {
  return computeLevelFromTotalXp(totalDone).level;
}

export function computeLevelStats(totalWins: number): LevelProgress {
  const safeTotalDone = Math.max(0, Math.floor(totalWins));
  const computed = computeLevelFromTotalXp(safeTotalDone);
  const requiredForCurrent = getRequiredDone(computed.level);
  const requiredForNext = requiredForCurrent + computed.requiredThisLevel;
  const progressInLevel = computed.xpIntoLevel;
  const requiredThisLevel = Math.max(computed.requiredThisLevel, 1);
  const progressPercent = Math.max(0, Math.min(1, computed.progressPercent / 100));
  const remainingToNext = Math.max(computed.remainingToNext, 0);

  return {
    totalDone: safeTotalDone,
    totalXp: safeTotalDone,
    level: computed.level,
    nextLevel: computed.nextLevel,
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
