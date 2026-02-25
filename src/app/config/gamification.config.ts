export type GamificationConfig = {
  habitsPerDayGoal: number;
  xpPerDifficulty: { EASY: number; MEDIUM: number; HARD: number };
  perfectDayBonusXP: number;
  streakRule: { minCompletionsForDailyStreak: number };
  levelCurve: {
    baseXP: number;
    incrementXP: number;
    maxLevel?: number;
  };
};

export const GAMIFICATION_CONFIG: GamificationConfig = {
  habitsPerDayGoal: 0,
  xpPerDifficulty: {
    EASY: 1,
    MEDIUM: 2,
    HARD: 3
  },
  perfectDayBonusXP: 5,
  streakRule: {
    minCompletionsForDailyStreak: 1
  },
  levelCurve: {
    baseXP: 50,
    incrementXP: 10
  }
};
