export interface Habit {
  id: string;
  name: string;
  goalDays: number;
  frequencyType?: 'daily' | 'weekly';
  weeklyTarget?: number;
  minimumVersion?: string;
  color?: string;
  createdAt: number;
  isActive: boolean;
  sortOrder: number;
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
  [dateKey: string]: Record<string, boolean>; // "YYYY-MM-DD" -> habitId -> completed
}

export interface HabitSkip {
  reason: string;
  note?: string;
  ts: number;
}

export interface HabitSkips {
  [dateKey: string]: Record<string, HabitSkip>; // "YYYY-MM-DD" -> habitId -> skip meta
}

export interface UserProfile {
  name: string;
  persona?: string;
  primaryGoal?: string;
  why?: string;
  whyStatement?: string;
  statement?: string;
  createdAt: number;
}

export interface ProfileSettings {
  displayName?: string;
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
