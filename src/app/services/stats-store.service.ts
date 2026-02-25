import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { Habit, HabitCompletion, HabitDifficulty, ProfileSettings } from '../models/habit.model';
import { HabitStoreService } from './habit-store.service';
import { GamificationService, computeStreaks as computeStreakSnapshot } from './gamification.service';

export type AppLevelInfo = {
  level: number;
  totalXP: number;
  xpIntoLevel: number;
  xpNeededForNext: number;
  progressPercent: number;
  nextLevel: number;
  remainingToNextXP: number;
};

export type AppStatsSnapshot = {
  totalXP: number;
  level: number;
  currentDailyStreak: number;
  currentPerfectStreak: number;
  bestDailyStreak: number;
  bestPerfectStreak: number;
  dailyGoalOverride: number | null;
};

@Injectable({ providedIn: 'root' })
export class StatsStoreService {
  private dailyGoalOverride$ = new BehaviorSubject<number | null>(null);

  readonly levelInfo$: Observable<AppLevelInfo>;
  readonly stats$: Observable<AppStatsSnapshot>;

  constructor(
    private habitStore: HabitStoreService,
    private gamification: GamificationService
  ) {
    this.levelInfo$ = this.habitStore.getLevelStats().pipe(
      map(levelStats => ({
        level: levelStats.level,
        totalXP: levelStats.totalXp,
        xpIntoLevel: levelStats.progressInLevel,
        xpNeededForNext: levelStats.requiredThisLevel,
        progressPercent: levelStats.progressPercent,
        nextLevel: levelStats.nextLevel,
        remainingToNextXP: levelStats.remainingToNext
      }))
    );

    this.stats$ = combineLatest([
      this.levelInfo$,
      this.habitStore.getProfile().pipe(map(profile => this.readDailyGoalOverride(profile))),
      this.habitStore.getSelectedDateKey(),
      this.habitStore.getHabits(),
      this.habitStore.getCompletions()
    ]).pipe(
      map(([levelInfo, profileGoalOverride, selectedDateKey, habits, completions]) => {
        const dayKeys = this.getTrackedDateKeys(habits, completions);
        const summaries = dayKeys.map(dateKey => {
          const activeHabits = this.habitStore.getHabitsActiveOn(dateKey);
          return this.gamification.computeDayXP(dateKey, activeHabits, completions, true);
        });
        const streaks = computeStreakSnapshot(summaries, this.gamification.config);
        const selectedDateSummary = selectedDateKey
          ? this.gamification.computeDayXP(selectedDateKey, this.habitStore.getHabitsActiveOn(selectedDateKey), completions, true)
          : null;

        return {
          totalXP: levelInfo.totalXP,
          level: levelInfo.level,
          currentDailyStreak: selectedDateKey ? this.habitStore.getStreakCount(selectedDateKey) : streaks.currentDailyStreak,
          currentPerfectStreak: selectedDateKey ? this.habitStore.getPerfectStreakCount(selectedDateKey) : streaks.currentPerfectStreak,
          bestDailyStreak: streaks.bestDailyStreak,
          bestPerfectStreak: streaks.bestPerfectStreak,
          dailyGoalOverride: profileGoalOverride ?? this.dailyGoalOverride$.value
        };
      })
    );
  }

  toggleHabitCompletion(dateISO: string, habitId: string, isCompleted: boolean): void {
    const date = this.dateFromKey(dateISO);
    if (!date) {
      return;
    }
    this.habitStore.setCompleted(habitId, date, isCompleted);
  }

  setHabitDifficulty(habitId: string, difficulty: HabitDifficulty): void {
    this.habitStore.updateHabit(habitId, { difficulty });
  }

  setDailyGoalOverride(value?: number | null): void {
    const normalized = value == null ? null : Math.max(1, Math.floor(value));
    this.dailyGoalOverride$.next(normalized);
    this.habitStore.updateProfileSettings({ dailyWinTarget: normalized ?? undefined });
  }

  getDailyGoalOverride(): Observable<number | null> {
    return combineLatest([this.dailyGoalOverride$, this.habitStore.getProfile()]).pipe(
      map(([localOverride, profile]) => localOverride ?? this.readDailyGoalOverride(profile))
    );
  }

  private readDailyGoalOverride(profile: ProfileSettings): number | null {
    const raw = Number(profile.dailyWinTarget ?? profile.requiredHabitsCount);
    if (!Number.isFinite(raw) || raw <= 0) {
      return null;
    }
    return Math.floor(raw);
  }

  private getTrackedDateKeys(habits: Habit[], completions: HabitCompletion): string[] {
    const keys = new Set<string>();
    Object.keys(completions || {}).forEach(key => keys.add(key));
    habits.forEach(habit => {
      if (habit.createdAtDateKey) {
        keys.add(habit.createdAtDateKey);
      }
    });
    keys.add(this.habitStore.toDateKey(new Date()));
    return [...keys].sort();
  }

  private dateFromKey(dateKey: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return null;
    }
    const [year, month, day] = dateKey.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }
}
