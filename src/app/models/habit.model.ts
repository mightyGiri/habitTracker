export interface Habit {
  id: string;
  name: string;
  goalDays: number;
  color?: string;
}

export interface MonthKey {
  year: number;
  month: number; // 0-11
}

export interface SelectedMonth extends MonthKey {}

export interface DayCheck {
  habitId: string;
  checked: boolean;
}

export interface HabitCompletion {
  [day: number]: DayCheck[]; // day -> array of habit checks
}

export interface MonthData {
  [monthKey: string]: HabitCompletion; // "2026-01" -> day checks
}

export interface MonthlyTotals {
  completed: number;
  goal: number;
  left: number;
  percent: number;
}

export interface TopHabit {
  habit: Habit;
  completionPercent: number;
}

export interface MonthSlot {
  dayNumber: number | null;
  dayLabel: string;
}

export interface MonthInsights {
  bestDay: number;
  worstDay: number;
  currentStreak: number;
  perfectDays: number;
}
