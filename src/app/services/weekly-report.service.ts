import { Injectable } from '@angular/core';
import { Habit, HabitCompletion } from '../models/habit.model';
import { GamificationService, DayXpSummary, WeekCompletionSummary } from './gamification.service';

export type WeeklyHabitProgress = {
  id: string;
  name: string;
  doneCount: number;
  daysActive: number;
};

export type WeeklyReportComputedStats = WeekCompletionSummary & {
  perHabit: WeeklyHabitProgress[];
};

@Injectable({ providedIn: 'root' })
export class WeeklyReportService {
  constructor(private gamification: GamificationService) {}

  computeWeekStats(
    dateKeys: string[],
    completions: HabitCompletion,
    getActiveHabitsOnDateKey: (dateKey: string) => Habit[],
    dailyGoalOverride?: number | null
  ): WeeklyReportComputedStats {
    const sortedKeys = [...dateKeys].sort();
    const daySummaries: DayXpSummary[] = [];
    const habitStats = new Map<string, WeeklyHabitProgress>();

    for (const dateKey of sortedKeys) {
      const activeHabits = getActiveHabitsOnDateKey(dateKey);
      const rawDay = this.gamification.computeDayXP(dateKey, activeHabits, completions, true);
      const effectiveGoal = dailyGoalOverride && dailyGoalOverride > 0 ? dailyGoalOverride : rawDay.goalCount;
      const normalizedDoneForGoal = effectiveGoal > 0 ? Math.min(rawDay.doneCount, effectiveGoal) : rawDay.doneCount;
      const isPerfectForGoal = effectiveGoal > 0 && normalizedDoneForGoal === effectiveGoal;
      daySummaries.push({
        ...rawDay,
        goalCount: effectiveGoal,
        doneCount: normalizedDoneForGoal,
        isPerfectDay: isPerfectForGoal
      });

      const dayMap = completions[dateKey] || {};
      for (const habit of activeHabits) {
        const current = habitStats.get(habit.id) ?? {
          id: habit.id,
          name: habit.name,
          doneCount: 0,
          daysActive: 0
        };
        current.daysActive += 1;
        if (dayMap[habit.id] === true) {
          current.doneCount += 1;
        }
        habitStats.set(habit.id, current);
      }
    }

    const summary = this.gamification.computeWeekSummary(daySummaries);
    const perHabit = [...habitStats.values()].sort((a, b) => {
      if (b.doneCount !== a.doneCount) {
        return b.doneCount - a.doneCount;
      }
      return a.name.localeCompare(b.name);
    });

    return { ...summary, perHabit };
  }
}
