import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Habit, MonthKey, HabitCompletion, DayCheck, MonthlyTotals, TopHabit, MonthInsights } from '../models/habit.model';
import { DateUtils } from '../shared/date-utils';

const STORAGE_KEY = 'habit_tracker_data';

interface StorageData {
  habits: Habit[];
  completions: { [key: string]: HabitCompletion };
  selectedMonthYear: MonthKey;
}

@Injectable({
  providedIn: 'root'
})
export class HabitStoreService {
  private habits$ = new BehaviorSubject<Habit[]>([]);
  private completions$ = new BehaviorSubject<{ [key: string]: HabitCompletion }>({});
  private selectedMonthYear$ = new BehaviorSubject<MonthKey>({ year: 2026, month: 0 });

  constructor() {
    this.loadFromStorage();
    if (this.habits$.value.length === 0) {
      this.seedHabits();
    }
  }

  private seedHabits(): void {
    const habits: Habit[] = [
      { id: '1', name: 'Drink Water', goalDays: 30, color: '#4A90E2' },
      { id: '2', name: 'Exercise', goalDays: 21, color: '#7B68EE' },
      { id: '3', name: 'Meditation', goalDays: 30, color: '#50C878' },
      { id: '4', name: 'Read', goalDays: 20, color: '#FFB347' },
      { id: '5', name: 'Sleep 8h', goalDays: 30, color: '#98D8C8' },
      { id: '6', name: 'Coding', goalDays: 25, color: '#F7DC6F' },
      { id: '7', name: 'Walk', goalDays: 28, color: '#BB8FCE' },
      { id: '8', name: 'Journal', goalDays: 15, color: '#85C1E2' },
      { id: '9', name: 'Stretch', goalDays: 30, color: '#F8B88B' },
      { id: '10', name: 'Learn', goalDays: 20, color: '#ABEBC6' },
      { id: '11', name: 'Healthy Eating', goalDays: 25, color: '#F1948A' },
      { id: '12', name: 'No Phone', goalDays: 14, color: '#D7BDE2' },
    ];
    this.habits$.next(habits);
    this.saveToStorage();
  }

  setSelectedMonthYear(year: number, monthIndex: number): void {
    this.selectedMonthYear$.next({ year, month: monthIndex });
    this.saveToStorage();
  }

  getSelectedMonthYear(): Observable<MonthKey> {
    return this.selectedMonthYear$.asObservable();
  }

  getSelectedMonthYearSync(): MonthKey {
    return this.selectedMonthYear$.value;
  }

  getHabits(): Observable<Habit[]> {
    return this.habits$.asObservable();
  }

  getHabitsSync(): Habit[] {
    return this.habits$.value;
  }

  getCompletions(): Observable<{ [key: string]: HabitCompletion }> {
    return this.completions$.asObservable();
  }

  addHabit(name: string, goalDays: number): void {
    const habits = this.habits$.value;
    const id = Date.now().toString();
    this.habits$.next([...habits, { id, name, goalDays }]);
    this.saveToStorage();
  }

  deleteHabit(habitId: string): void {
    const habits = this.habits$.value.filter(h => h.id !== habitId);
    this.habits$.next(habits);
    this.saveToStorage();
  }

  renameHabit(habitId: string, newName: string): void {
    const habits = this.habits$.value.map(h => h.id === habitId ? { ...h, name: newName } : h);
    this.habits$.next(habits);
    this.saveToStorage();
  }

  updateGoalDays(habitId: string, goalDays: number): void {
    const habits = this.habits$.value.map(h => h.id === habitId ? { ...h, goalDays } : h);
    this.habits$.next(habits);
    this.saveToStorage();
  }

  setAllForDay(dayNumber: number, checked: boolean): void {
    const monthKey = this.selectedMonthYear$.value;
    const key = this.monthKeyToString(monthKey);
    const completions = { ...this.completions$.value };
    if (!completions[key]) {
      completions[key] = {};
    }

    if (checked) {
      completions[key][dayNumber] = this.habits$.value.map(habit => ({
        habitId: habit.id,
        checked: true
      }));
    } else {
      delete completions[key][dayNumber];
    }

    this.completions$.next(completions);
    this.saveToStorage();
  }

  toggleCheck(dayNumber: number, habitId: string): void {
    const monthKey = this.selectedMonthYear$.value;
    const key = this.monthKeyToString(monthKey);
    const completions = { ...this.completions$.value };

    if (!completions[key]) {
      completions[key] = {};
    }

    if (!completions[key][dayNumber]) {
      completions[key][dayNumber] = [];
    }

    const dayChecks = completions[key][dayNumber];
    const existing = dayChecks.findIndex(c => c.habitId === habitId);

    if (existing !== -1) {
      dayChecks.splice(existing, 1);
    } else {
      dayChecks.push({ habitId, checked: true });
    }

    this.completions$.next(completions);
    this.saveToStorage();
  }

  isChecked(dayNumber: number, habitId: string): boolean {
    const monthKey = this.selectedMonthYear$.value;
    const key = this.monthKeyToString(monthKey);
    const completions = this.completions$.value;

    if (!completions[key] || !completions[key][dayNumber]) {
      return false;
    }

    return completions[key][dayNumber].some(c => c.habitId === habitId);
  }

  getDaysInMonth(): number {
    const { year, month } = this.selectedMonthYear$.value;
    return DateUtils.daysInMonth(year, month);
  }

  getDailyCompletedCounts(): number[] {
    const monthKey = this.selectedMonthYear$.value;
    const key = this.monthKeyToString(monthKey);
    const completions = this.completions$.value;
    const daysInMonth = this.getDaysInMonth();
    const counts: number[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      counts.push(completions[key]?.[day]?.length || 0);
    }

    return counts;
  }

  getHabitCompletionPercent(habitId: string, year: number, monthIndex: number): number {
    const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
    const key = this.monthKeyToStringFromParts(year, monthIndex);
    const completions = this.completions$.value;
    let completedDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      if (completions[key]?.[day]?.some(c => c.habitId === habitId)) {
        completedDays++;
      }
    }

    return daysInMonth > 0 ? Math.round((completedDays / daysInMonth) * 100) : 0;
  }

  getMonthInsights(year: number, monthIndex: number): MonthInsights {
    const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
    const key = this.monthKeyToStringFromParts(year, monthIndex);
    const completions = this.completions$.value[key] || {};
    const habitsCount = this.habits$.value.length;
    const today = new Date();
    let lastDayIndex = daysInMonth;

    if (year > today.getFullYear() || (year === today.getFullYear() && monthIndex > today.getMonth())) {
      lastDayIndex = 0;
    } else if (year === today.getFullYear() && monthIndex === today.getMonth()) {
      lastDayIndex = Math.min(daysInMonth, today.getDate());
    }

    if (lastDayIndex === 0) {
      return { bestDay: 0, worstDay: 0, currentStreak: 0, perfectDays: 0 };
    }

    let bestDay = 1;
    let worstDay = 1;
    let bestCount = -1;
    let worstCount = Number.POSITIVE_INFINITY;
    let perfectDays = 0;

    for (let day = 1; day <= lastDayIndex; day++) {
      const count = completions[day]?.length || 0;
      if (count > bestCount) {
        bestCount = count;
        bestDay = day;
      }
      if (count < worstCount) {
        worstCount = count;
        worstDay = day;
      }
      if (habitsCount > 0 && count === habitsCount) {
        perfectDays++;
      }
    }

    let currentStreak = 0;
    for (let day = lastDayIndex; day >= 1; day--) {
      if ((completions[day]?.length || 0) > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      bestDay,
      worstDay,
      currentStreak,
      perfectDays
    };
  }

  getTodayDayNumberIfInSelectedMonth(): number | null {
    const today = new Date();
    const selected = this.selectedMonthYear$.value;
    if (today.getFullYear() === selected.year && today.getMonth() === selected.month) {
      return today.getDate();
    }
    return null;
  }

  getMonthlyTotals(): MonthlyTotals {
    const habits = this.habits$.value;
    const daysInMonth = this.getDaysInMonth();
    const goal = habits.reduce((sum, h) => sum + h.goalDays, 0);
    const completed = this.getDailyCompletedCounts().reduce((sum, count) => sum + count, 0);
    const left = goal - completed;
    const percent = goal > 0 ? Math.round((completed / goal) * 100) : 0;

    return { completed, goal, left, percent };
  }

  getTopHabits(limit: number): TopHabit[] {
    const habits = this.habits$.value;
    const daysInMonth = this.getDaysInMonth();
    const monthKey = this.selectedMonthYear$.value;
    const key = this.monthKeyToString(monthKey);
    const completions = this.completions$.value;

    const topHabits: TopHabit[] = habits.map(habit => {
      let checkedDays = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        if (completions[key]?.[day]?.some(c => c.habitId === habit.id)) {
          checkedDays++;
        }
      }
      const completionPercent = habit.goalDays > 0 ? Math.round((checkedDays / habit.goalDays) * 100) : 0;
      return { habit, completionPercent };
    });

    return topHabits.sort((a, b) => b.completionPercent - a.completionPercent).slice(0, limit);
  }

  private monthKeyToString(monthKey: MonthKey): string {
    return `${monthKey.year}-${String(monthKey.month + 1).padStart(2, '0')}`;
  }

  private monthKeyToStringFromParts(year: number, monthIndex: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data: StorageData = {
        habits: this.habits$.value,
        completions: this.completions$.value,
        selectedMonthYear: this.selectedMonthYear$.value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }

  private loadFromStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        try {
          const parsed: StorageData = JSON.parse(data);
          this.habits$.next(parsed.habits);
          this.completions$.next(parsed.completions);
          this.selectedMonthYear$.next(parsed.selectedMonthYear);
        } catch (e) {
          console.error('Failed to load from storage', e);
        }
      }
    }
  }
}
