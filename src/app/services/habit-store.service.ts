import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Habit, MonthKey, HabitCompletion, DayCheck, MonthlyTotals, TopHabit, MonthInsights, HabitSkips, HabitSkip, UserProfile, ProfileSettings } from '../models/habit.model';
import { DateUtils } from '../shared/date-utils';
import { getLevelProgress, LevelProgress } from '../shared/level-utils';
import { StorageService, PersistedState } from './storage.service';
import { ThemeService } from './theme.service';

interface StorageData {
  habits: Habit[];
  completions: HabitCompletion;
  skips: HabitSkips;
  selectedMonthYear: MonthKey;
  onboardingCompleted?: boolean;
  userProfile?: UserProfile | null;
  profile?: ProfileSettings;
  defaultsSeeded?: boolean;
}

type BackupData = {
  habits: Array<{
    id: string;
    name: string;
    goalDays: number;
    frequencyType?: 'daily' | 'weekly';
    weeklyTarget?: number;
    minimumVersion?: string;
    frequency?: 'daily' | 'weekly';
    minimum?: string;
  }>;
  checks: HabitCompletion;
  skips?: HabitSkips;
  onboardingCompleted?: boolean;
  userProfile?: UserProfile;
  profile?: ProfileSettings;
  appSettings?: { selectedYear?: number; selectedMonthIndex?: number };
};

@Injectable({
  providedIn: 'root'
})
export class HabitStoreService {
  private habits$ = new BehaviorSubject<Habit[]>([]);
  private completions$ = new BehaviorSubject<HabitCompletion>({});
  private skips$ = new BehaviorSubject<HabitSkips>({});
  private levelStats$ = new BehaviorSubject<LevelProgress>(getLevelProgress(0));
  private selectedMonthYear$ = new BehaviorSubject<MonthKey>({ year: 2026, month: 0 });
  private selectedDateKey$ = new BehaviorSubject<string>(this.toIsoDateLocal(new Date()));
  private onboardingCompleted$ = new BehaviorSubject<boolean>(false);
  private userProfile$ = new BehaviorSubject<UserProfile | null>(null);
  private profile$ = new BehaviorSubject<ProfileSettings>({});
  private ready$ = new BehaviorSubject<boolean>(false);
  private defaultsSeeded = false;
  private isHydrated = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState: PersistedState | null = null;

  constructor(private storageService: StorageService, private themeService: ThemeService) {
    void this.initialize();
    this.completions$.subscribe(completions => {
      this.levelStats$.next(this.buildLevelStats(completions));
    });
    this.themeService.getTheme().subscribe(() => this.saveToStorage());
  }

  private async initialize(): Promise<void> {
    this.ready$.next(false);
    const state = await this.storageService.loadState();
    if (state) {
      const normalizedHabits = this.normalizeHabits(state.habits || []);
      this.defaultsSeeded = state.defaultsSeeded === true || normalizedHabits.length > 0;
      if (normalizedHabits.length > 0) {
        this.habits$.next(normalizedHabits);
        this.completions$.next(this.normalizeCompletions(state.completions || {}));
        this.skips$.next(this.normalizeSkips(state.skips || {}));
      } else if (!this.defaultsSeeded) {
        this.seedHabits();
        this.defaultsSeeded = true;
      }
      const profile = state.userProfile ? this.normalizeUserProfile(state.userProfile) : null;
      this.userProfile$.next(profile);
      this.profile$.next(state.profile ?? {});
      if (typeof state.onboardingCompleted === 'boolean') {
        this.onboardingCompleted$.next(state.onboardingCompleted);
      } else if (profile) {
        this.onboardingCompleted$.next(true);
      }
      if (state.selectedMonthYear) {
        this.selectedMonthYear$.next(state.selectedMonthYear);
      }
      if (state.settings?.theme) {
        this.themeService.setTheme(state.settings.theme);
      }
      this.isHydrated = true;
      this.saveToStorage();
      this.ready$.next(true);
      return;
    }

    this.seedHabits();
    this.defaultsSeeded = true;
    this.isHydrated = true;
    this.saveToStorage();
    this.ready$.next(true);
  }

  private seedHabits(): void {
    const now = Date.now();
    const habits: Habit[] = [
      { id: this.createId(), name: 'Wake up on time', goalDays: 30, frequencyType: 'daily', createdAt: now, isActive: true, sortOrder: 0 },
      { id: this.createId(), name: 'Drink water', goalDays: 30, frequencyType: 'daily', createdAt: now + 1, isActive: true, sortOrder: 1 },
      { id: this.createId(), name: 'Move (walk/exercise)', goalDays: 30, frequencyType: 'daily', createdAt: now + 2, isActive: true, sortOrder: 2 },
      { id: this.createId(), name: 'Read', goalDays: 30, frequencyType: 'daily', createdAt: now + 3, isActive: true, sortOrder: 3 },
      { id: this.createId(), name: 'Reflect (journal)', goalDays: 30, frequencyType: 'daily', createdAt: now + 4, isActive: true, sortOrder: 4 }
    ];
    this.habits$.next(habits);
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

  getSelectedDateKey(): Observable<string> {
    return this.selectedDateKey$.asObservable();
  }

  getSelectedDateKeySync(): string {
    return this.selectedDateKey$.value;
  }

  setSelectedDate(date: Date): void {
    this.selectedDateKey$.next(this.toIsoDateLocal(date));
  }

  getHabits(): Observable<Habit[]> {
    return this.habits$.asObservable();
  }

  getHabitsSync(): Habit[] {
    return this.habits$.value;
  }

  getCompletions(): Observable<HabitCompletion> {
    return this.completions$.asObservable();
  }

  getCompletionsSync(): HabitCompletion {
    return this.completions$.value;
  }

  getLevelStats(): Observable<LevelProgress> {
    return this.levelStats$.asObservable();
  }

  getLevelStatsSync(): LevelProgress {
    return this.levelStats$.value;
  }

  getSkips(): Observable<HabitSkips> {
    return this.skips$.asObservable();
  }

  getUserProfile(): Observable<UserProfile | null> {
    return this.userProfile$.asObservable();
  }

  getUserProfileSync(): UserProfile | null {
    return this.userProfile$.value;
  }

  getProfile(): Observable<ProfileSettings> {
    return this.profile$.asObservable();
  }

  getProfileSync(): ProfileSettings {
    return this.profile$.value;
  }

  setProfile(profile: ProfileSettings): void {
    this.profile$.next(profile);
    this.saveToStorage();
  }

  setUserProfile(profile: UserProfile): void {
    this.userProfile$.next(this.normalizeUserProfile(profile));
    this.saveToStorage();
  }

  completeOnboarding(): void {
    this.onboardingCompleted$.next(true);
    this.saveToStorage();
  }

  skipOnboarding(): void {
    this.onboardingCompleted$.next(true);
    this.saveToStorage();
  }

  onboardingCompletedSync(): boolean {
    return this.onboardingCompleted$.value;
  }

  getOnboardingCompleted(): Observable<boolean> {
    return this.onboardingCompleted$.asObservable();
  }

  getReady(): Observable<boolean> {
    return this.ready$.asObservable();
  }

  getSkipsSync(): HabitSkips {
    return this.skips$.value;
  }

  private buildLevelStats(completions: HabitCompletion): LevelProgress {
    let totalDone = 0;
    Object.values(completions).forEach(dayMap => {
      Object.values(dayMap).forEach(value => {
        if (value) {
          totalDone += 1;
        }
      });
    });

    return getLevelProgress(totalDone);
  }

  addHabit(name: string, frequencyType: 'daily' | 'weekly', weeklyTarget: number | undefined, minimumVersion: string, goalDays = 30): void {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const habits = this.habits$.value;
    const duplicate = habits.some(habit => habit.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      return;
    }
    const id = this.createId();
    const sortOrder = habits.length > 0 ? Math.max(...habits.map(h => h.sortOrder ?? 0)) + 1 : 0;
    const createdAt = Date.now();
    const normalizedMinimum = minimumVersion.trim();
    const nextHabits = [
      ...habits,
      {
        id,
        name: trimmed,
        goalDays,
        frequencyType,
        weeklyTarget: frequencyType === 'weekly' ? weeklyTarget : undefined,
        minimumVersion: normalizedMinimum || undefined,
        createdAt,
        isActive: true,
        sortOrder
      }
    ];
    this.habits$.next(this.sortHabits(nextHabits));
    this.saveToStorage();
  }

  deleteHabit(habitId: string): void {
    const habits = this.habits$.value.filter(h => h.id !== habitId);
    const completions = this.removeHabitFromCompletions(habitId, this.completions$.value);
    const skips = this.removeHabitFromSkips(habitId, this.skips$.value);
    this.habits$.next(this.sortHabits(habits));
    this.completions$.next(completions);
    this.skips$.next(skips);
    this.saveToStorage();
  }

  renameHabit(habitId: string, newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    const duplicate = this.habits$.value.some(h => h.id !== habitId && h.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      return;
    }
    const habits = this.habits$.value.map(h => h.id === habitId ? { ...h, name: trimmed } : h);
    this.habits$.next(this.sortHabits(habits));
    this.saveToStorage();
  }

  updateGoalDays(habitId: string, goalDays: number): void {
    const habits = this.habits$.value.map(h => h.id === habitId ? { ...h, goalDays } : h);
    this.habits$.next(this.sortHabits(habits));
    this.saveToStorage();
  }

  updateHabit(habitId: string, patch: Partial<Pick<Habit, 'name' | 'isActive' | 'sortOrder' | 'goalDays' | 'frequencyType' | 'weeklyTarget' | 'minimumVersion'>>): void {
    const habits = this.habits$.value.map(habit => {
      if (habit.id !== habitId) {
        return habit;
      }
      const nextName = patch.name ? patch.name.trim() : habit.name;
      const nextFrequencyType = patch.frequencyType ?? habit.frequencyType ?? 'daily';
      const nextWeeklyTarget = nextFrequencyType === 'weekly'
        ? (patch.weeklyTarget ?? habit.weeklyTarget ?? 3)
        : undefined;
      const nextMinimum = patch.minimumVersion !== undefined
        ? patch.minimumVersion.trim()
        : habit.minimumVersion;
      return {
        ...habit,
        ...patch,
        name: nextName || habit.name,
        frequencyType: nextFrequencyType,
        weeklyTarget: nextWeeklyTarget,
        minimumVersion: nextMinimum || undefined
      };
    });
    this.habits$.next(this.sortHabits(habits));
    this.saveToStorage();
  }

  toggleHabitActive(habitId: string): void {
    const habits = this.habits$.value.map(habit =>
      habit.id === habitId ? { ...habit, isActive: !habit.isActive } : habit
    );
    this.habits$.next(this.sortHabits(habits));
    this.saveToStorage();
  }

  reorderHabits(fromIndex: number, toIndex: number): void {
    const habits = [...this.habits$.value];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= habits.length || toIndex >= habits.length) {
      return;
    }
    const [moved] = habits.splice(fromIndex, 1);
    habits.splice(toIndex, 0, moved);
    const reordered = habits.map((habit, index) => ({ ...habit, sortOrder: index }));
    this.habits$.next(reordered);
    this.saveToStorage();
  }

  setAllForDay(dayNumber: number, checked: boolean): void {
    const { year, month, day } = this.getSelectedMonthDayParts(dayNumber);
    if (!year || !month || !day) {
      return;
    }
    const date = new Date(year, month, day);
    this.setAllForDate(date, checked);
    this.saveToStorage();
  }

  toggleCheck(dayNumber: number, habitId: string): void {
    const { year, month, day } = this.getSelectedMonthDayParts(dayNumber);
    if (!year || !month || !day) {
      return;
    }
    const date = new Date(year, month, day);
    this.toggleHabitForDate(habitId, date);
    this.saveToStorage();
  }

  isChecked(dayNumber: number, habitId: string): boolean {
    const { year, month, day } = this.getSelectedMonthDayParts(dayNumber);
    if (!year || !month || !day) {
      return false;
    }
    const date = new Date(year, month, day);
    return this.isCheckedForDate(year, month, day, habitId);
  }

  toDateKey(date: Date): string {
    return this.toIsoDateLocal(date);
  }

  isCompleted(habitId: string, date: Date): boolean {
    const dateKey = this.toIsoDateLocal(date);
    return this.completions$.value[dateKey]?.[habitId] === true;
  }

  isSkipped(habitId: string, date: Date): boolean {
    const dateKey = this.toIsoDateLocal(date);
    return Boolean(this.skips$.value[dateKey]?.[habitId]);
  }

  setCompleted(habitId: string, date: Date, completed: boolean): void {
    const dateKey = this.toIsoDateLocal(date);
    const completions = { ...this.completions$.value };
    const dayMap = { ...(completions[dateKey] || {}) };
    if (completed) {
      dayMap[habitId] = true;
      completions[dateKey] = dayMap;
    } else {
      if (dayMap[habitId]) {
        delete dayMap[habitId];
      }
      if (Object.keys(dayMap).length === 0) {
        delete completions[dateKey];
      } else {
        completions[dateKey] = dayMap;
      }
    }
    this.completions$.next(completions);

    if (completed) {
      const skips = { ...this.skips$.value };
      const skipMap = { ...(skips[dateKey] || {}) };
      if (skipMap[habitId]) {
        delete skipMap[habitId];
        if (Object.keys(skipMap).length === 0) {
          delete skips[dateKey];
        } else {
          skips[dateKey] = skipMap;
        }
        this.skips$.next(skips);
      }
    }

    this.saveToStorage();
  }

  skipHabit(habitId: string, date: Date, reason: string, note?: string): void {
    const dateKey = this.toIsoDateLocal(date);
    const skips = { ...this.skips$.value };
    const dayMap = { ...(skips[dateKey] || {}) };
    dayMap[habitId] = { reason, note, ts: Date.now() };
    skips[dateKey] = dayMap;
    this.skips$.next(skips);
    this.saveToStorage();
  }

  unskipHabit(habitId: string, date: Date): void {
    const dateKey = this.toIsoDateLocal(date);
    const skips = { ...this.skips$.value };
    const dayMap = { ...(skips[dateKey] || {}) };
    if (dayMap[habitId]) {
      delete dayMap[habitId];
    }
    if (Object.keys(dayMap).length === 0) {
      delete skips[dateKey];
    } else {
      skips[dateKey] = dayMap;
    }
    this.skips$.next(skips);
    this.saveToStorage();
  }

  skipRemaining(date: Date, reason: string, note?: string): void {
    const dateKey = this.toIsoDateLocal(date);
    const skips = { ...this.skips$.value };
    const dayMap = { ...(skips[dateKey] || {}) };
    const activeHabits = this.habits$.value.filter(habit => habit.isActive);
    const completions = this.completions$.value[dateKey] || {};

    activeHabits.forEach(habit => {
      if (!completions[habit.id] && !dayMap[habit.id]) {
        dayMap[habit.id] = { reason, note, ts: Date.now() };
      }
    });

    if (Object.keys(dayMap).length > 0) {
      skips[dateKey] = dayMap;
    }
    this.skips$.next(skips);
    this.saveToStorage();
  }

  isPerfectDay(date: Date): boolean {
    const activeHabits = this.habits$.value.filter(habit => habit.isActive);
    if (activeHabits.length === 0) {
      return false;
    }
    const dateKey = this.toIsoDateLocal(date);
    const dayMap = this.completions$.value[dateKey] || {};
    const skipMap = this.skips$.value[dateKey] || {};
    const handledCount = activeHabits.reduce((sum, habit) => {
      if (dayMap[habit.id] || skipMap[habit.id]) {
        return sum + 1;
      }
      return sum;
    }, 0);
    return handledCount === activeHabits.length;
  }

  getRemainingCount(date: Date): number {
    const activeHabits = this.habits$.value.filter(habit => habit.isActive);
    if (activeHabits.length === 0) {
      return 0;
    }
    const dateKey = this.toIsoDateLocal(date);
    const dayMap = this.completions$.value[dateKey] || {};
    const skipMap = this.skips$.value[dateKey] || {};
    const handledCount = activeHabits.reduce((sum, habit) => {
      if (dayMap[habit.id] || skipMap[habit.id]) {
        return sum + 1;
      }
      return sum;
    }, 0);
    return Math.max(activeHabits.length - handledCount, 0);
  }

  getDaySummary(date: Date): { doneCount: number; skippedCount: number; handledCount: number; totalCount: number; percentDone: number; percentHandled: number } {
    const activeHabits = this.habits$.value.filter(habit => habit.isActive);
    const totalCount = activeHabits.length;
    if (totalCount === 0) {
      return { doneCount: 0, skippedCount: 0, handledCount: 0, totalCount: 0, percentDone: 0, percentHandled: 0 };
    }
    const dateKey = this.toIsoDateLocal(date);
    const dayMap = this.completions$.value[dateKey] || {};
    const skipMap = this.skips$.value[dateKey] || {};
    const doneCount = activeHabits.reduce((sum, habit) => sum + (dayMap[habit.id] ? 1 : 0), 0);
    const skippedCount = activeHabits.reduce((sum, habit) => sum + (skipMap[habit.id] ? 1 : 0), 0);
    const handledCount = doneCount + skippedCount;
    const percentDone = Math.round((doneCount / totalCount) * 100);
    const percentHandled = Math.round((handledCount / totalCount) * 100);
    return { doneCount, skippedCount, handledCount, totalCount, percentDone, percentHandled };
  }

  getStreakCount(endingDate: Date): number {
    const activeHabits = this.habits$.value.filter(habit => habit.isActive);
    if (activeHabits.length === 0) {
      return 0;
    }
    let streak = 0;
    const cursor = new Date(endingDate);
    for (let i = 0; i < 365; i++) {
      if (this.isPerfectDay(cursor)) {
        streak++;
      } else {
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  getCurrentStreak(todayKey?: string): number {
    const activeHabits = this.habits$.value.filter(habit => habit.isActive);
    if (activeHabits.length === 0) {
      return 0;
    }

    const today = todayKey ? this.dateFromKey(todayKey) : this.normalizeDate(new Date());
    if (!today) {
      return 0;
    }

    const startDate = new Date(today);
    if (!this.isPerfectDay(startDate)) {
      startDate.setDate(startDate.getDate() - 1);
    }

    let streak = 0;
    const cursor = new Date(startDate);
    for (let i = 0; i < 365; i++) {
      if (this.isPerfectDay(cursor)) {
        streak++;
      } else {
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  isCheckedForDate(year: number, monthIndex: number, dayNumber: number, habitId: string): boolean {
    const date = new Date(year, monthIndex, dayNumber);
    return this.isCompleted(habitId, date);
  }

  toggleCheckForDate(year: number, monthIndex: number, dayNumber: number, habitId: string): void {
    const date = new Date(year, monthIndex, dayNumber);
    const next = !this.isCompleted(habitId, date);
    this.setCompleted(habitId, date, next);
  }

  setAllForDayForDate(year: number, monthIndex: number, dayNumber: number, checked: boolean): void {
    const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, dayNumber));
    const completions = { ...this.completions$.value };
    const skips = { ...this.skips$.value };
    if (checked) {
      const dayMap: Record<string, boolean> = {};
      this.habits$.value.filter(habit => habit.isActive).forEach(habit => {
        dayMap[habit.id] = true;
      });
      completions[dateKey] = dayMap;
    } else {
      delete completions[dateKey];
    }
    delete skips[dateKey];
    this.completions$.next(completions);
    this.skips$.next(skips);
    this.saveToStorage();
  }

  getHabitsForDate(date: Date): Array<{ habit: Habit; checked: boolean }> {
    const habits = this.habits$.value.filter(habit => habit.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const dateKey = this.toIsoDateLocal(date);
    const dayMap = this.completions$.value[dateKey] || {};
    return habits.map(habit => ({
      habit,
      checked: dayMap[habit.id] === true
    }));
  }

  toggleHabitForDate(habitId: string, date: Date): void {
    const next = !this.isCompleted(habitId, date);
    this.setCompleted(habitId, date, next);
  }

  setAllForDate(date: Date, checked: boolean): void {
    const dateKey = this.toIsoDateLocal(date);
    const completions = { ...this.completions$.value };
    const skips = { ...this.skips$.value };
    if (checked) {
      const dayMap: Record<string, boolean> = {};
      this.habits$.value.filter(habit => habit.isActive).forEach(habit => {
        dayMap[habit.id] = true;
      });
      completions[dateKey] = dayMap;
    } else {
      delete completions[dateKey];
    }
    delete skips[dateKey];
    this.completions$.next(completions);
    this.skips$.next(skips);
    this.saveToStorage();
  }

  getDaysInMonth(): number {
    const { year, month } = this.selectedMonthYear$.value;
    return DateUtils.daysInMonth(year, month);
  }

  getDailyCompletedCounts(): number[] {
    const monthKey = this.selectedMonthYear$.value;
    const completions = this.completions$.value;
    const daysInMonth = this.getDaysInMonth();
    const counts: number[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthKey.year, monthKey.month, day);
      const dateKey = this.toIsoDateLocal(date);
      const dayMap = completions[dateKey] || {};
      counts.push(Object.values(dayMap).filter(Boolean).length);
    }

    return counts;
  }

  getHabitCompletionPercent(habitId: string, year: number, monthIndex: number): number {
    const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
    const completions = this.completions$.value;
    let completedDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, day));
      if (completions[dateKey]?.[habitId]) {
        completedDays++;
      }
    }

    return daysInMonth > 0 ? Math.round((completedDays / daysInMonth) * 100) : 0;
  }

  getMonthInsights(year: number, monthIndex: number): MonthInsights {
    const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
    const completions = this.completions$.value;
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
      const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, day));
      const dayMap = completions[dateKey] || {};
      const count = Object.values(dayMap).filter(Boolean).length;
      if (count > bestCount) {
        bestCount = count;
        bestDay = day;
      }
      if (count < worstCount) {
        worstCount = count;
        worstDay = day;
      }
      if (habitsCount > 0 && this.isPerfectDay(new Date(year, monthIndex, day))) {
        perfectDays++;
      }
    }

    let currentStreak = 0;
    for (let day = lastDayIndex; day >= 1; day--) {
      const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, day));
      const dayMap = completions[dateKey] || {};
      if (Object.values(dayMap).filter(Boolean).length > 0) {
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
    const habits = this.habits$.value.filter(habit => habit.isActive);
    const daysInMonth = this.getDaysInMonth();
    const goal = habits.reduce((sum, h) => sum + h.goalDays, 0);
    const completed = this.getDailyCompletedCounts().reduce((sum, count) => sum + count, 0);
    const left = goal - completed;
    const percent = goal > 0 ? Math.round((completed / goal) * 100) : 0;

    return { completed, goal, left, percent };
  }

  getTopHabits(limit: number): TopHabit[] {
    const habits = this.habits$.value.filter(habit => habit.isActive);
    const daysInMonth = this.getDaysInMonth();
    const completions = this.completions$.value;

    const topHabits: TopHabit[] = habits.map(habit => {
      let checkedDays = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = this.toIsoDateLocal(new Date(this.selectedMonthYear$.value.year, this.selectedMonthYear$.value.month, day));
        if (completions[dateKey]?.[habit.id]) {
          checkedDays++;
        }
      }
      const completionPercent = habit.goalDays > 0 ? Math.round((checkedDays / habit.goalDays) * 100) : 0;
      return { habit, completionPercent };
    });

    const allZero = topHabits.every(item => item.completionPercent === 0);
    if (allZero) {
      return topHabits
        .sort((a, b) => a.habit.name.localeCompare(b.habit.name))
        .slice(0, limit);
    }

    return topHabits
      .sort((a, b) => b.completionPercent - a.completionPercent)
      .slice(0, limit);
  }

  private monthKeyToString(monthKey: MonthKey): string {
    return `${monthKey.year}-${String(monthKey.month + 1).padStart(2, '0')}`;
  }

  private monthKeyToStringFromParts(year: number, monthIndex: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  getSnapshotForBackup(): StorageData {
    return {
      habits: this.habits$.value,
      completions: this.completions$.value,
      skips: this.skips$.value,
      selectedMonthYear: this.selectedMonthYear$.value,
      onboardingCompleted: this.onboardingCompleted$.value,
      userProfile: this.userProfile$.value,
      profile: this.profile$.value,
      defaultsSeeded: this.defaultsSeeded
    };
  }

  restoreFromBackup(backup: BackupData, mode: 'replace' | 'merge' = 'replace'): void {
    const normalizedHabits = (backup.habits || [])
      .filter(habit => habit && typeof habit.id === 'string')
      .map(habit => {
        const frequencyType = this.normalizeFrequencyType(habit.frequencyType || habit.frequency);
        const weeklyTargetRaw = Number(habit.weeklyTarget);
        const weeklyTarget = frequencyType === 'weekly' && Number.isFinite(weeklyTargetRaw)
          ? Math.min(7, Math.max(1, weeklyTargetRaw))
          : undefined;
        const minimumVersion = habit.minimumVersion ?? habit.minimum;
        return {
          id: habit.id,
          name: String(habit.name || '').trim() || 'Habit',
          goalDays: Math.max(1, Number(habit.goalDays) || 1),
          frequencyType,
          weeklyTarget,
          minimumVersion: minimumVersion ? String(minimumVersion) : undefined,
          createdAt: Number((habit as Habit).createdAt) || Date.now(),
          isActive: (habit as Habit).isActive ?? true,
          sortOrder: Number((habit as Habit).sortOrder) || 0
        };
      });

    const incomingChecks = this.normalizeCompletions(backup.checks || {});
    const incomingSkips = this.normalizeSkips(backup.skips || {});

    if (mode === 'merge') {
      const habitMap = new Map<string, Habit>();
      this.habits$.value.forEach(habit => habitMap.set(habit.id, habit));
      normalizedHabits.forEach(habit => habitMap.set(habit.id, habit));
      const mergedHabits = this.sortHabits(Array.from(habitMap.values()));
      const habitIds = new Set(mergedHabits.map(habit => habit.id));
      const mergedCompletions: HabitCompletion = { ...this.completions$.value };
      const mergedSkips: HabitSkips = { ...this.skips$.value };

      Object.entries(incomingChecks).forEach(([dateKey, dayMap]) => {
        if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
          return;
        }
        const existing = mergedCompletions[dateKey] || {};
        const nextMap: Record<string, boolean> = { ...existing };
        Object.entries(dayMap).forEach(([habitId, completed]) => {
          if (completed && habitIds.has(habitId)) {
            nextMap[habitId] = true;
          }
        });
        if (Object.keys(nextMap).length > 0) {
          mergedCompletions[dateKey] = nextMap;
        }
      });

      Object.entries(incomingSkips).forEach(([dateKey, dayMap]) => {
        if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
          return;
        }
        const existing = mergedSkips[dateKey] || {};
        const nextMap: Record<string, HabitSkip> = { ...existing };
        Object.entries(dayMap).forEach(([habitId, skip]) => {
          if (habitIds.has(habitId) && skip && typeof skip === 'object') {
            nextMap[habitId] = skip as HabitSkip;
          }
        });
        if (Object.keys(nextMap).length > 0) {
          mergedSkips[dateKey] = nextMap;
        }
      });

      this.habits$.next(mergedHabits);
      this.defaultsSeeded = mergedHabits.length > 0;
      this.completions$.next(mergedCompletions);
      this.skips$.next(mergedSkips);
      if (typeof backup.onboardingCompleted === 'boolean') {
        this.onboardingCompleted$.next(backup.onboardingCompleted);
      }
      if (backup.userProfile) {
        this.userProfile$.next(this.normalizeUserProfile(backup.userProfile));
      }
      if (backup.profile) {
        this.profile$.next(backup.profile);
      }
      this.saveToStorage();
      return;
    }

    const habitIds = new Set(normalizedHabits.map(habit => habit.id));
    const cleanedCompletions: HabitCompletion = {};
    const cleanedSkips: HabitSkips = {};
    Object.entries(incomingChecks).forEach(([dateKey, dayMap]) => {
      if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
        return;
      }
      const cleanedMap: Record<string, boolean> = {};
      Object.entries(dayMap).forEach(([habitId, completed]) => {
        if (completed && habitIds.has(habitId)) {
          cleanedMap[habitId] = true;
        }
      });
      if (Object.keys(cleanedMap).length > 0) {
        cleanedCompletions[dateKey] = cleanedMap;
      }
    });

    Object.entries(incomingSkips).forEach(([dateKey, dayMap]) => {
      if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
        return;
      }
      const cleanedMap: Record<string, HabitSkip> = {};
      Object.entries(dayMap).forEach(([habitId, skip]) => {
        if (habitIds.has(habitId) && skip && typeof skip === 'object') {
          cleanedMap[habitId] = skip as HabitSkip;
        }
      });
      if (Object.keys(cleanedMap).length > 0) {
        cleanedSkips[dateKey] = cleanedMap;
      }
    });

    this.habits$.next(this.sortHabits(normalizedHabits));
    this.defaultsSeeded = normalizedHabits.length > 0;
    this.completions$.next(cleanedCompletions);
    this.skips$.next(cleanedSkips);
    if (typeof backup.onboardingCompleted === 'boolean') {
      this.onboardingCompleted$.next(backup.onboardingCompleted);
    }
    if (backup.userProfile) {
      this.userProfile$.next(this.normalizeUserProfile(backup.userProfile));
    }
    if (backup.profile) {
      this.profile$.next(backup.profile);
    }

    const selectedYear = backup.appSettings?.selectedYear;
    const selectedMonthIndex = backup.appSettings?.selectedMonthIndex;
    if (typeof selectedYear === 'number' && typeof selectedMonthIndex === 'number' && selectedMonthIndex >= 0 && selectedMonthIndex <= 11) {
      this.selectedMonthYear$.next({ year: selectedYear, month: selectedMonthIndex });
    }

    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (!this.isHydrated) {
      return;
    }
    const data: PersistedState = {
      schemaVersion: 1,
      habits: this.habits$.value,
      completions: this.completions$.value,
      skips: this.skips$.value,
      selectedMonthYear: this.selectedMonthYear$.value,
      onboardingCompleted: this.onboardingCompleted$.value,
      userProfile: this.userProfile$.value ?? undefined,
      profile: this.profile$.value,
      defaultsSeeded: this.defaultsSeeded,
      settings: {
        theme: this.themeService.getThemeSync()
      }
    };

    this.pendingState = data;
    if (this.saveTimer) {
      return;
    }
    this.saveTimer = setTimeout(() => {
      const nextState = this.pendingState;
      this.pendingState = null;
      this.saveTimer = null;
      if (nextState) {
        void this.storageService.saveState(nextState);
      }
    }, 500);
  }

  private sortHabits(habits: Habit[]): Habit[] {
    return [...habits].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  private normalizeHabits(habits: Habit[]): Habit[] {
    return habits.map((habit, index) => {
      const legacy = habit as Habit & { frequency?: 'daily' | 'weekly'; minimum?: string };
      const frequencyType = this.normalizeFrequencyType(habit.frequencyType || legacy.frequency);
      const weeklyTargetRaw = Number(habit.weeklyTarget);
      const weeklyTarget = frequencyType === 'weekly' && Number.isFinite(weeklyTargetRaw)
        ? Math.min(7, Math.max(1, weeklyTargetRaw))
        : undefined;
      const minimumVersion = habit.minimumVersion ?? legacy.minimum;
      return {
        ...habit,
        name: habit.name?.trim() || `Habit ${index + 1}`,
        goalDays: habit.goalDays ?? 30,
        frequencyType,
        weeklyTarget,
        minimumVersion: minimumVersion ? String(minimumVersion) : undefined,
        createdAt: habit.createdAt ?? Date.now() + index,
        isActive: habit.isActive ?? true,
        sortOrder: habit.sortOrder ?? index
      };
    }).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  private normalizeUserProfile(profile: UserProfile): UserProfile {
    const name = String(profile.name || '').trim();
    const whyStatement = profile.whyStatement ?? profile.why;
    return {
      ...profile,
      name,
      whyStatement: whyStatement ? String(whyStatement).trim() : undefined,
      why: profile.why ? String(profile.why).trim() : undefined,
      persona: profile.persona ? String(profile.persona).trim() : undefined,
      primaryGoal: profile.primaryGoal ? String(profile.primaryGoal).trim() : undefined,
      createdAt: Number(profile.createdAt) || Date.now()
    };
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private normalizeFrequencyType(value: unknown): 'daily' | 'weekly' {
    return value === 'weekly' ? 'weekly' : 'daily';
  }

  private removeHabitFromCompletions(habitId: string, completions: HabitCompletion): HabitCompletion {
    const cleaned: HabitCompletion = {};
    Object.entries(completions).forEach(([dateKey, dayMap]) => {
      if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
        return;
      }
      const nextMap = { ...(dayMap as Record<string, boolean>) };
      delete nextMap[habitId];
      if (Object.keys(nextMap).length > 0) {
        cleaned[dateKey] = nextMap;
      }
    });
    return cleaned;
  }

  private removeHabitFromSkips(habitId: string, skips: HabitSkips): HabitSkips {
    const cleaned: HabitSkips = {};
    Object.entries(skips).forEach(([dateKey, dayMap]) => {
      if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
        return;
      }
      const nextMap = { ...(dayMap as Record<string, HabitSkip>) };
      delete nextMap[habitId];
      if (Object.keys(nextMap).length > 0) {
        cleaned[dateKey] = nextMap;
      }
    });
    return cleaned;
  }

  private normalizeCompletions(completions: HabitCompletion): HabitCompletion {
    const normalized: HabitCompletion = {};
    Object.entries(completions).forEach(([key, value]) => {
      if (/^\d{4}-\d{2}$/.test(key) && value && typeof value === 'object' && !Array.isArray(value)) {
        const legacyMonth = value as unknown as Record<string, DayCheck[] | Record<string, boolean>>;
        Object.entries(legacyMonth).forEach(([dayKey, dayValue]) => {
          const day = Number(dayKey);
          if (Number.isNaN(day)) {
            return;
          }
          const [yearStr, monthStr] = key.split('-');
          const year = Number(yearStr);
          const monthIndex = Number(monthStr) - 1;
          const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, day));
          if (Array.isArray(dayValue)) {
            normalized[dateKey] = this.dayChecksToMap(dayValue);
            return;
          }
          if (dayValue && typeof dayValue === 'object') {
            normalized[dateKey] = this.booleanMapOnly(dayValue as Record<string, boolean>);
          }
        });
        return;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        if (Array.isArray(value)) {
          normalized[key] = this.dayChecksToMap(value);
          return;
        }
        if (value && typeof value === 'object') {
          normalized[key] = this.booleanMapOnly(value as Record<string, boolean>);
        }
      }
    });
    return normalized;
  }

  private normalizeSkips(skips: HabitSkips): HabitSkips {
    const normalized: HabitSkips = {};
    Object.entries(skips).forEach(([dateKey, dayMap]) => {
      if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
        return;
      }
      const cleanedMap: Record<string, HabitSkip> = {};
      Object.entries(dayMap).forEach(([habitId, skip]) => {
        if (skip && typeof skip === 'object' && typeof (skip as HabitSkip).reason === 'string') {
          const raw = skip as HabitSkip;
          cleanedMap[habitId] = {
            reason: String(raw.reason),
            note: raw.note ? String(raw.note) : undefined,
            ts: Number(raw.ts) || Date.now()
          };
        }
      });
      if (Object.keys(cleanedMap).length > 0) {
        normalized[dateKey] = cleanedMap;
      }
    });
    return normalized;
  }

  private dayChecksToMap(dayChecks: DayCheck[]): Record<string, boolean> {
    const dayMap: Record<string, boolean> = {};
    dayChecks.forEach(check => {
      if (check?.habitId) {
        dayMap[check.habitId] = true;
      }
    });
    return dayMap;
  }

  private booleanMapOnly(dayMap: Record<string, boolean>): Record<string, boolean> {
    const cleaned: Record<string, boolean> = {};
    Object.entries(dayMap).forEach(([habitId, value]) => {
      if (value) {
        cleaned[habitId] = true;
      }
    });
    return cleaned;
  }

  private getSelectedMonthDayParts(dayNumber: number): { year: number; month: number; day: number } {
    const { year, month } = this.selectedMonthYear$.value;
    return { year, month, day: dayNumber };
  }

  private toIsoDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dateFromKey(dateKey: string): Date | null {
    const parts = dateKey.split('-');
    if (parts.length !== 3) {
      return null;
    }
    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
      return null;
    }
    return this.normalizeDate(new Date(year, monthIndex, day));
  }

  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }
}
