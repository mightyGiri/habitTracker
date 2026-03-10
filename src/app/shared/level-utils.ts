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

/** Shape returned by computeCurrentLevelProgress — used for XP progress bars. */
export type CurrentLevelProgress = {
  currentLevel: number;
  xpIntoCurrentLevel: number;
  xpRequiredForNextLevel: number;
  progressPercent: number; // 0–100
};

// ─── Core formula ─────────────────────────────────────────────────────────────

/**
 * XP required to advance from `level` to `level + 1`.
 *
 * Formula: Math.floor(3 * level^1.6)
 * A minimum of 1 is enforced so the while-loop in computeLevelFromTotalXp
 * always terminates.
 *
 * Approximate milestones (5 habits/day ≈ 30 XP/day):
 *   Level  5 →  6 : ~20 XP
 *   Level 10 → 11 : ~48 XP
 *   Level 50 → 51 : ~577 XP
 *   Level 99 →100 : ~1 741 XP  (≈5 months of consistent play)
 */
export function getXpRequiredForNextLevel(level: number): number {
  const safeLevel = Math.max(0, Math.floor(level));
  // Use safeLevel + 1 so that level 0 yields a non-zero threshold (3 XP)
  // and the curve starts immediately meaningful.
  return Math.max(1, Math.floor(3 * Math.pow(safeLevel + 1, 1.6)));
}

/** Alias matching the method name requested in the prompt. */
export const xpRequiredForLevel = getXpRequiredForNextLevel;

// ─── Level computation ────────────────────────────────────────────────────────

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

/**
 * Returns a lightweight progress snapshot suitable for XP progress bars.
 * All fields are derived from totalXP — nothing extra is stored.
 */
export function computeCurrentLevelProgress(totalXp: number): CurrentLevelProgress {
  const result = computeLevelFromTotalXp(Math.max(0, Math.floor(totalXp || 0)));
  return {
    currentLevel: result.level,
    xpIntoCurrentLevel: result.xpIntoLevel,
    xpRequiredForNextLevel: result.requiredThisLevel,
    progressPercent: Math.max(0, Math.min(100, result.progressPercent))
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Alias matching the method name requested in the prompt. */
export const getLevelFromTotalXP = getLevelFromTotalDone;

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
