import { Injectable } from '@angular/core';
import { Habit, HabitCompletion, HabitDifficulty } from '../models/habit.model';
import { LevelProgress, computeLevelFromTotalXp, getXpRequiredForNextLevel } from '../shared/level-utils';
import { GAMIFICATION_CONFIG, GamificationConfig } from '../config/gamification.config';

export type DayXpSummary = {
  dateKey: string;
  doneCount: number;
  goalCount: number;
  dayXP: number;
  isPerfectDay: boolean;
  hasAnyCompletion: boolean;
};

export type StreakSnapshot = {
  currentDailyStreak: number;
  currentPerfectStreak: number;
  bestDailyStreak: number;
  bestPerfectStreak: number;
};

export type WeekCompletionSummary = {
  completed: number;
  goal: number;
  percent: number;
  perfectDays: number;
  weeklyPerfectStreak: number;
  weekXP: number;
};

function xpByDifficultyFromConfig(config: Pick<GamificationConfig, 'xpPerDifficulty'>): Record<HabitDifficulty, number> {
  return {
    easy: config.xpPerDifficulty.EASY,
    medium: config.xpPerDifficulty.MEDIUM,
    hard: config.xpPerDifficulty.HARD
  };
}

export function isPerfectDay(completedCount: number, goalCount: number): boolean {
  return goalCount > 0 && completedCount === goalCount;
}

export function computeDayXP(
  completedHabits: Array<Pick<Habit, 'difficulty'>>,
  allHabits: Array<Pick<Habit, 'difficulty'>>,
  config: GamificationConfig = GAMIFICATION_CONFIG
): number {
  const xpByDifficulty = xpByDifficultyFromConfig(config);
  let xp = 0;
  for (const habit of completedHabits) {
    const difficulty = habit?.difficulty === 'medium' || habit?.difficulty === 'hard' ? habit.difficulty : 'easy';
    xp += xpByDifficulty[difficulty];
  }
  if (isPerfectDay(completedHabits.length, allHabits.length)) {
    xp += config.perfectDayBonusXP;
  }
  return xp;
}

export function computeWeeklyXP(
  dailyLogs: Array<Pick<DayXpSummary, 'dayXP'>>,
  _config: GamificationConfig = GAMIFICATION_CONFIG
): number {
  return dailyLogs.reduce((sum, day) => sum + Math.max(0, Math.floor(day.dayXP || 0)), 0);
}

export function computeStreaks(
  allDailyLogs: Array<Pick<DayXpSummary, 'doneCount' | 'isPerfectDay'>>,
  config: GamificationConfig = GAMIFICATION_CONFIG
): StreakSnapshot {
  let currentDailyStreak = 0;
  let currentPerfectStreak = 0;
  let bestDailyStreak = 0;
  let bestPerfectStreak = 0;
  let dailyRun = 0;
  let perfectRun = 0;

  for (const summary of allDailyLogs) {
    if (!summary) {
      dailyRun = 0;
      perfectRun = 0;
      continue;
    }

    if ((summary.doneCount || 0) >= config.streakRule.minCompletionsForDailyStreak) {
      dailyRun += 1;
      bestDailyStreak = Math.max(bestDailyStreak, dailyRun);
    } else {
      dailyRun = 0;
    }

    if (summary.isPerfectDay) {
      perfectRun += 1;
      bestPerfectStreak = Math.max(bestPerfectStreak, perfectRun);
    } else {
      perfectRun = 0;
    }
  }

  currentDailyStreak = dailyRun;
  currentPerfectStreak = perfectRun;

  return { currentDailyStreak, currentPerfectStreak, bestDailyStreak, bestPerfectStreak };
}

export function computeLevel(
  totalXP: number,
  levelCurve: GamificationConfig['levelCurve'] = GAMIFICATION_CONFIG.levelCurve
): { level: number; xpIntoLevel: number; xpNeededForNext: number; progressPercent: number } {
  void levelCurve;
  const result = computeLevelFromTotalXp(totalXP);
  return {
    level: result.level,
    xpIntoLevel: result.xpIntoLevel,
    xpNeededForNext: result.requiredThisLevel,
    progressPercent: Math.max(0, Math.min(1, result.progressPercent / 100))
  };
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
  readonly config = GAMIFICATION_CONFIG;

  normalizeDifficulty(value: unknown): HabitDifficulty {
    return value === 'medium' || value === 'hard' ? value : 'easy';
  }

  getHabitXpValue(habit: Pick<Habit, 'difficulty'> | null | undefined): number {
    const xpByDifficulty = xpByDifficultyFromConfig(this.config);
    return xpByDifficulty[this.normalizeDifficulty(habit?.difficulty)];
  }

  computeDayXP(
    dateKey: string,
    activeHabits: Habit[],
    completions: HabitCompletion,
    includePerfectBonus = true
  ): DayXpSummary {
    const dayMap = completions[dateKey] || {};
    let doneCount = 0;
    let xp = 0;
    for (const habit of activeHabits) {
      if (dayMap[habit.id] === true) {
        doneCount += 1;
        xp += this.getHabitXpValue(habit);
      }
    }
    const goalCount = activeHabits.length;
    const perfect = isPerfectDay(doneCount, goalCount);
    if (perfect && includePerfectBonus) {
      xp += this.config.perfectDayBonusXP;
    }
    return {
      dateKey,
      doneCount,
      goalCount,
      dayXP: xp,
      isPerfectDay: perfect,
      hasAnyCompletion: doneCount > 0
    };
  }

  computeWeekSummary(daySummaries: DayXpSummary[]): WeekCompletionSummary {
    let completed = 0;
    let goal = 0;
    let perfectDays = 0;
    let weekXP = 0;
    let weeklyPerfectStreak = 0;
    let currentPerfectRun = 0;

    for (const day of daySummaries) {
      completed += day.doneCount;
      goal += day.goalCount;
      weekXP += day.dayXP;
      if (day.isPerfectDay) {
        perfectDays += 1;
        currentPerfectRun += 1;
        weeklyPerfectStreak = Math.max(weeklyPerfectStreak, currentPerfectRun);
      } else {
        currentPerfectRun = 0;
      }
    }

    const percent = goal > 0 ? Math.round((completed / goal) * 100) : 0;
    return { completed, goal, percent, perfectDays, weeklyPerfectStreak, weekXP: computeWeeklyXP(daySummaries, this.config) };
  }

  computeStreaks(
    sortedDateKeysAsc: string[],
    summariesByDateKey: Record<string, Pick<DayXpSummary, 'doneCount' | 'isPerfectDay'>>
  ): StreakSnapshot {
    const ordered = sortedDateKeysAsc.map(dateKey => summariesByDateKey[dateKey]).filter(Boolean) as Array<Pick<DayXpSummary, 'doneCount' | 'isPerfectDay'>>;
    return computeStreaks(ordered, this.config);
  }

  computeLevelProgressFromTotalXP(totalXP: number): LevelProgress {
    const xp = Math.max(0, Math.floor(totalXP));
    const computed = computeLevel(xp, this.config.levelCurve);
    let floorXp = 0;
    for (let lvl = 0; lvl < computed.level; lvl++) {
      floorXp += this.xpNeededForNextLevel(lvl);
    }
    const progressInLevel = computed.xpIntoLevel;
    const requiredThisLevel = computed.xpNeededForNext || 1;
    const requiredForNext = floorXp + requiredThisLevel;
    const remainingToNext = Math.max(requiredForNext - xp, 0);
    const progressPercent = computed.progressPercent;

    return {
      totalDone: xp,
      totalXp: xp,
      level: computed.level,
      nextLevel: computed.level + 1,
      requiredForNext,
      progressInLevel,
      requiredThisLevel,
      progressPercent,
      remainingToNext
    };
  }

  xpNeededForNextLevel(level: number): number {
    return getXpRequiredForNextLevel(level);
  }

  getWeeklyQuote(percent: number): string {
    const safe = Math.max(0, Math.min(100, Math.round(percent)));
    if (safe === 100) {
      return 'Perfect week. Legendary discipline.';
    }
    if (safe > 70) {
      return "You're on fire. Keep it up.";
    }
    if (safe >= 30) {
      return 'Good momentum. Keep pushing.';
    }
    return 'Reset and rise.';
  }

  getPerfectDayBonusXp(): number {
    return this.config.perfectDayBonusXP;
  }
}
