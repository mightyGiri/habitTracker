import { Injectable, isDevMode } from '@angular/core';
import { BehaviorSubject, Observable, Subject, combineLatest, map } from 'rxjs';
import { Habit, MonthKey, HabitCompletion, DayCheck, MonthlyTotals, TopHabit, MonthInsights, HabitSkips, HabitSkip, UserProfile, ProfileSettings, TimerState, TimerStateMap, NotificationSettings } from '../models/habit.model';
import { DateUtils } from '../shared/date-utils';
import { getLevelProgress, LevelProgress } from '../shared/level-utils';
import { StorageService, PersistedState } from './storage.service';
import { GamificationService, DayXpSummary, StreakSnapshot } from './gamification.service';
import { AchievementsService, AchievementBadgeId } from './achievements.service';

interface StorageData {
  habits: Habit[];
  completions: HabitCompletion;
  skips: HabitSkips;
  timerStates: TimerStateMap;
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
    difficulty?: 'easy' | 'medium' | 'hard';
    createdAtDateKey?: string;
    goalDays: number;
    frequencyType?: 'daily' | 'weekly';
    weeklyTarget?: number;
    minimumVersion?: string;
    timerEnabled?: boolean;
    timerSeconds?: number;
    timerAutoComplete?: boolean;
    type?: 'check' | 'timer';
    targetSeconds?: number;
    allowManualComplete?: boolean;
    reminderEnabled?: boolean;
    reminderTime?: string;
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

type DaySummary = { doneCount: number; skippedCount: number; handledCount: number; totalCount: number; percentDone: number; percentHandled: number };
const DEFAULT_DAILY_REMINDER_TIME = '20:30';

@Injectable({
  providedIn: 'root'
})
export class HabitStoreService {
  private habits$ = new BehaviorSubject<Habit[]>([]);
  private completions$ = new BehaviorSubject<HabitCompletion>({});
  private skips$ = new BehaviorSubject<HabitSkips>({});
  private timerStates$ = new BehaviorSubject<TimerStateMap>({});
  private levelStats$ = new BehaviorSubject<LevelProgress>(getLevelProgress(0));
  private selectedMonthYear$ = new BehaviorSubject<MonthKey>({ year: 2026, month: 0 });
  private selectedDateKey$ = new BehaviorSubject<string>(this.toIsoDateLocal(new Date()));
  private onboardingCompleted$ = new BehaviorSubject<boolean>(false);
  private userProfile$ = new BehaviorSubject<UserProfile | null>(null);
  private profile$ = new BehaviorSubject<ProfileSettings>({});
  private ready$ = new BehaviorSubject<boolean>(false);
  private badgeUnlockEvents$ = new Subject<AchievementBadgeId[]>();
  private defaultsSeeded = false;
  private isHydrated = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState: PersistedState | null = null;

  constructor(
    private storageService: StorageService,
    private gamification: GamificationService,
    private achievements: AchievementsService
  ) {
    void this.initialize();
    combineLatest([this.habits$, this.completions$]).subscribe(([habits, completions]) => {
      this.levelStats$.next(this.buildLevelStats(habits, completions));
    });
  }

  private async initialize(): Promise<void> {
    this.ready$.next(false);
    const state = await this.storageService.loadState();
    if (state) {
      const normalizedCompletions = this.normalizeCompletions(state.completions || {});
      const normalizedSkips = this.normalizeSkips(state.skips || {});
      const normalizedHabits = this.normalizeHabits(state.habits || [], normalizedCompletions);
      this.defaultsSeeded = state.defaultsSeeded === true || normalizedHabits.length > 0;
      if (normalizedHabits.length > 0) {
        this.habits$.next(normalizedHabits);
        this.completions$.next(normalizedCompletions);
        this.skips$.next(normalizedSkips);
        this.timerStates$.next(this.normalizeTimerStates(state.timerStates || {}));
        this.assertHabitDateKeys(normalizedHabits);
      } else if (!this.defaultsSeeded) {
        this.seedHabits();
        this.defaultsSeeded = true;
      }
      const profile = state.userProfile ? this.normalizeUserProfile(state.userProfile) : null;
      this.userProfile$.next(profile);
      this.profile$.next(this.normalizeProfileSettings(state.profile ?? {}));
      if (typeof state.onboardingCompleted === 'boolean') {
        this.onboardingCompleted$.next(state.onboardingCompleted);
      } else if (profile) {
        this.onboardingCompleted$.next(true);
      }
      if (state.selectedMonthYear) {
        this.selectedMonthYear$.next(state.selectedMonthYear);
      }
      this.isHydrated = true;
      this.enforceAdminDateLock();
      this.refreshUnlockedBadges(false);
      this.saveToStorage();
      this.ready$.next(true);
      return;
    }

    this.seedHabits();
    this.defaultsSeeded = true;
    this.isHydrated = true;
    this.enforceAdminDateLock();
    this.refreshUnlockedBadges(false);
    this.saveToStorage();
    this.ready$.next(true);
  }

  private seedHabits(): void {
    const now = Date.now();
    const todayDateKey = this.toIsoDateLocal(new Date());
    const habits: Habit[] = [
      { id: this.createId(), name: 'Wake up on time', difficulty: 'easy', createdAtDateKey: todayDateKey, goalDays: 30, frequencyType: 'daily', timerEnabled: false, timerSeconds: 0, timerAutoComplete: true, type: 'check', targetSeconds: 0, allowManualComplete: false, timerCompleted: false, reminderEnabled: false, createdAt: now, isActive: true, sortOrder: 0 },
      { id: this.createId(), name: 'Meditation', difficulty: 'medium', createdAtDateKey: todayDateKey, goalDays: 30, frequencyType: 'daily', timerEnabled: true, timerSeconds: 300, timerAutoComplete: true, type: 'timer', targetSeconds: 300, allowManualComplete: false, timerCompleted: false, reminderEnabled: false, createdAt: now + 1, isActive: true, sortOrder: 1 },
      { id: this.createId(), name: 'Move (walk/exercise)', difficulty: 'hard', createdAtDateKey: todayDateKey, goalDays: 30, frequencyType: 'daily', timerEnabled: false, timerSeconds: 0, timerAutoComplete: true, type: 'check', targetSeconds: 0, allowManualComplete: false, timerCompleted: false, reminderEnabled: false, createdAt: now + 2, isActive: true, sortOrder: 2 },
      { id: this.createId(), name: 'Read', difficulty: 'easy', createdAtDateKey: todayDateKey, goalDays: 30, frequencyType: 'daily', timerEnabled: false, timerSeconds: 0, timerAutoComplete: true, type: 'check', targetSeconds: 0, allowManualComplete: false, timerCompleted: false, reminderEnabled: false, createdAt: now + 3, isActive: true, sortOrder: 3 },
      { id: this.createId(), name: 'Reflect (journal)', difficulty: 'medium', createdAtDateKey: todayDateKey, goalDays: 30, frequencyType: 'daily', timerEnabled: false, timerSeconds: 0, timerAutoComplete: true, type: 'check', targetSeconds: 0, allowManualComplete: false, timerCompleted: false, reminderEnabled: false, createdAt: now + 4, isActive: true, sortOrder: 4 }
    ];
    this.habits$.next(habits);
  }


  setSelectedMonthYear(year: number, monthIndex: number): void {
    if (!this.isAdmin()) {
      const today = this.normalizeDate(new Date());
      this.selectedMonthYear$.next({ year: today.getFullYear(), month: today.getMonth() });
      this.saveToStorage();
      return;
    }
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
    const normalizedDate = this.normalizeDate(date);
    this.selectedDateKey$.next(this.toIsoDateLocal(normalizedDate));
    this.saveToStorage();
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

  getTimerStates(): Observable<TimerStateMap> {
    return this.timerStates$.asObservable();
  }

  getTimerStatesSync(): TimerStateMap {
    return this.timerStates$.value;
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

  getProfileSettingsSync(): ProfileSettings {
    return this.getProfileSync();
  }

  getUnlockedBadgeIds(): Observable<string[]> {
    return this.profile$.pipe(map(profile => profile.unlockedBadgeIds ?? []));
  }

  getUnlockedBadgeIdsSync(): string[] {
    return this.profile$.value.unlockedBadgeIds ?? [];
  }

  getBadgeUnlockEvents(): Observable<AchievementBadgeId[]> {
    return this.badgeUnlockEvents$.asObservable();
  }

  getNotificationSettings$(): Observable<NotificationSettings> {
    return this.profile$.pipe(map(profile => this.readNotificationSettings(profile)));
  }

  getNotificationSettingsSync(): NotificationSettings {
    return this.readNotificationSettings(this.profile$.value);
  }

  setProfile(profile: ProfileSettings): void {
    this.profile$.next(this.normalizeProfileSettings(profile));
    this.saveToStorage();
  }

  updateProfileSettings(patch: Partial<ProfileSettings>): void {
    this.profile$.next(this.normalizeProfileSettings({ ...this.profile$.value, ...patch }));
    this.saveToStorage();
  }

  updateNotificationSettings(patch: Partial<NotificationSettings>): void {
    const current = this.readNotificationSettings(this.profile$.value);
    const next: NotificationSettings = {
      dailyEnabled: patch.dailyEnabled ?? current.dailyEnabled,
      dailyTime: this.normalizeReminderTime(patch.dailyTime ?? current.dailyTime)
    };
    this.profile$.next(this.normalizeProfileSettings({
      ...this.profile$.value,
      dailyReminderEnabled: next.dailyEnabled,
      dailyReminderTime: next.dailyTime
    }));
    this.saveToStorage();
  }

  setUserProfile(profile: UserProfile): void {
    this.userProfile$.next(this.normalizeUserProfile(profile));
    this.saveToStorage();
  }

  getCurrentUsername(): string {
    const profileName = this.profile$.value.displayName?.trim();
    const userName = this.userProfile$.value?.name?.trim();
    return profileName || userName || 'Player';
  }

  isAdmin(): boolean {
    return this.getCurrentUsername() === 'Giri';
  }

  completeOnboarding(): void {
    this.onboardingCompleted$.next(true);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('onboardingComplete', 'true');
    }
    this.saveToStorage();
  }

  skipOnboarding(): void {
    this.onboardingCompleted$.next(true);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('onboardingComplete', 'true');
    }
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

  setHabitTimerCompleted(habitId: string, completed: boolean): void {
    const habits = this.habits$.value.map(habit => {
      if (habit.id !== habitId) {
        return habit;
      }
      return { ...habit, timerCompleted: completed };
    });
    this.habits$.next(this.sortHabits(habits));
    this.saveToStorage();
  }

  getTimerState(date: Date, habitId: string): TimerState | null {
    const dateKey = this.toIsoDateLocal(date);
    return this.timerStates$.value[dateKey]?.[habitId] ?? null;
  }

  setTimerState(dateKey: string, habitId: string, state: TimerState): void {
    const states = { ...this.timerStates$.value };
    const dayMap = { ...(states[dateKey] || {}) };
    dayMap[habitId] = { ...state };
    states[dateKey] = dayMap;
    this.timerStates$.next(states);
    this.saveToStorage();
  }

  clearTimerState(dateKey: string, habitId: string): void {
    const states = { ...this.timerStates$.value };
    const dayMap = { ...(states[dateKey] || {}) };
    if (!dayMap[habitId]) {
      return;
    }
    delete dayMap[habitId];
    if (Object.keys(dayMap).length === 0) {
      delete states[dateKey];
    } else {
      states[dateKey] = dayMap;
    }
    this.timerStates$.next(states);
    this.saveToStorage();
  }

  getHabitXpValue(habitOrId: Habit | string): number {
    if (typeof habitOrId === 'string') {
      const habit = this.habits$.value.find(item => item.id === habitOrId);
      return this.gamification.getHabitXpValue(habit);
    }
    return this.gamification.getHabitXpValue(habitOrId);
  }

  computeTotalXpSync(): number {
    return this.computeTotalXpFromState(this.habits$.value, this.completions$.value);
  }

  private buildLevelStats(habits: Habit[], completions: HabitCompletion): LevelProgress {
    const totalXP = this.computeTotalXpFromState(habits, completions);
    return this.gamification.computeLevelProgressFromTotalXP(totalXP);
  }

  addHabit(name: string, frequencyType: 'daily' | 'weekly', weeklyTarget: number | undefined, minimumVersion: string, goalDays = 30, timerEnabled = false, timerSeconds = 0, timerAutoComplete = true, difficulty: 'easy' | 'medium' | 'hard' = 'easy'): void {
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
    const type: 'check' | 'timer' = timerEnabled ? 'timer' : 'check';
    const targetSeconds = timerEnabled ? Math.max(0, timerSeconds) : 0;
    const nextHabits = [
      ...habits,
      {
        id,
        name: trimmed,
        difficulty: this.gamification.normalizeDifficulty(difficulty),
        createdAtDateKey: this.toIsoDateLocal(new Date()),
        goalDays,
        frequencyType,
        weeklyTarget: frequencyType === 'weekly' ? weeklyTarget : undefined,
        minimumVersion: normalizedMinimum || undefined,
        timerEnabled,
        timerSeconds: Math.max(0, timerSeconds),
        timerAutoComplete,
        type,
        targetSeconds,
        allowManualComplete: false,
        timerCompleted: false,
        reminderEnabled: false,
        reminderTime: undefined,
        createdAt,
        isActive: true,
        sortOrder
      }
    ];
    this.habits$.next(this.sortHabits(nextHabits));
    this.refreshUnlockedBadges(false);
    this.saveToStorage();
  }

  deleteHabit(habitId: string): void {
    const habits = this.habits$.value.filter(h => h.id !== habitId);
    const completions = this.removeHabitFromCompletions(habitId, this.completions$.value);
    const skips = this.removeHabitFromSkips(habitId, this.skips$.value);
    const timerStates = this.removeHabitFromTimerStates(habitId, this.timerStates$.value);
    this.habits$.next(this.sortHabits(habits));
    this.completions$.next(completions);
    this.skips$.next(skips);
    this.timerStates$.next(timerStates);
    this.refreshUnlockedBadges(false);
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
    const habits = this.habits$.value.map(h => h.id === habitId ? { ...h, name: trimmed, timerCompleted: false } : h);
    this.habits$.next(this.sortHabits(habits));
    this.refreshUnlockedBadges(false);
    this.saveToStorage();
  }

  updateGoalDays(habitId: string, goalDays: number): void {
    const habits = this.habits$.value.map(h => h.id === habitId ? { ...h, goalDays } : h);
    this.habits$.next(this.sortHabits(habits));
    this.saveToStorage();
  }

  updateHabit(habitId: string, patch: Partial<Pick<Habit, 'name' | 'difficulty' | 'isActive' | 'sortOrder' | 'goalDays' | 'frequencyType' | 'weeklyTarget' | 'minimumVersion' | 'timerEnabled' | 'timerSeconds' | 'timerAutoComplete' | 'type' | 'targetSeconds' | 'allowManualComplete' | 'timerCompleted' | 'reminderEnabled' | 'reminderTime'>>): void {
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
      const nextTimerEnabled = patch.timerEnabled ?? habit.timerEnabled ?? false;
      const nextTimerSecondsRaw = patch.timerSeconds ?? habit.timerSeconds ?? patch.targetSeconds ?? habit.targetSeconds ?? 0;
      const nextTimerSeconds = Math.max(0, Number(nextTimerSecondsRaw) || 0);
      const nextType = patch.type ?? habit.type ?? (nextTimerEnabled ? 'timer' : 'check');
      const normalizedTimerEnabled = nextType === 'timer' ? true : nextTimerEnabled;
      const nextTargetSecondsRaw = patch.targetSeconds ?? habit.targetSeconds ?? nextTimerSeconds;
      const nextTargetSeconds = Math.max(0, Number(nextTargetSecondsRaw) || 0);
      const nextAllowManualComplete = patch.allowManualComplete ?? habit.allowManualComplete ?? false;
      const nextTimerCompleted = patch.timerCompleted ?? false;
      const nextTimerAutoComplete = patch.timerAutoComplete ?? habit.timerAutoComplete ?? true;
      const nextReminderEnabled = patch.reminderEnabled ?? habit.reminderEnabled ?? false;
      const nextReminderTime = this.normalizeReminderTime(patch.reminderTime ?? habit.reminderTime);
      const nextDifficulty = this.gamification.normalizeDifficulty(patch.difficulty ?? habit.difficulty);
      return {
        ...habit,
        ...patch,
        name: nextName || habit.name,
        frequencyType: nextFrequencyType,
        weeklyTarget: nextWeeklyTarget,
        minimumVersion: nextMinimum || undefined,
        timerEnabled: normalizedTimerEnabled,
        timerSeconds: nextTimerSeconds,
        timerAutoComplete: nextTimerAutoComplete,
        type: nextType,
        targetSeconds: nextTargetSeconds,
        allowManualComplete: nextAllowManualComplete,
        timerCompleted: nextTimerCompleted,
        reminderEnabled: nextReminderEnabled,
        reminderTime: nextReminderEnabled ? nextReminderTime : undefined,
        difficulty: nextDifficulty
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

  updateHabitReminder(habitId: string, enabled: boolean, time: string): void {
    this.updateHabit(habitId, {
      reminderEnabled: enabled,
      reminderTime: enabled ? this.normalizeReminderTime(time) : undefined
    });
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
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
    return this.completions$.value[dateKey]?.[habitId] === true;
  }

  isSkipped(habitId: string, date: Date): boolean {
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
    return Boolean(this.skips$.value[dateKey]?.[habitId]);
  }

  setCompleted(habitId: string, date: Date, completed: boolean): void {
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
    const habitIsActiveOnDate = this.getHabitsActiveOn(dateKey).some(habit => habit.id === habitId);
    if (!habitIsActiveOnDate) {
      return;
    }
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

    this.refreshUnlockedBadges(true);
    this.saveToStorage();
  }

  skipHabit(habitId: string, date: Date, reason: string, note?: string): void {
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
    const habitIsActiveOnDate = this.getHabitsActiveOn(dateKey).some(habit => habit.id === habitId);
    if (!habitIsActiveOnDate) {
      return;
    }
    const skips = { ...this.skips$.value };
    const dayMap = { ...(skips[dateKey] || {}) };
    dayMap[habitId] = { reason, note, ts: Date.now() };
    skips[dateKey] = dayMap;
    this.skips$.next(skips);
    this.saveToStorage();
  }

  unskipHabit(habitId: string, date: Date): void {
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
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
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
    const skips = { ...this.skips$.value };
    const dayMap = { ...(skips[dateKey] || {}) };
    const activeHabits = this.getHabitsActiveOn(dateKey);
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
    const dateKey = this.toIsoDateLocal(this.resolveDate(date));
    const summary = this.getDaySummaryByDateKey(dateKey);
    return summary.totalCount > 0 && summary.doneCount === summary.totalCount;
  }

  getRemainingCount(date: Date): number {
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
    const summary = this.getDaySummaryByDateKey(dateKey);
    return Math.max(summary.totalCount - summary.handledCount, 0);
  }

  getDaySummary(date: Date): DaySummary {
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
    return this.getDaySummaryByDateKey(dateKey);
  }

  private getDaySummaryByDateKey(dateKey: string): DaySummary {
    const activeHabits = this.getHabitsActiveOn(dateKey);
    const totalCount = activeHabits.length;
    if (totalCount === 0) {
      return { doneCount: 0, skippedCount: 0, handledCount: 0, totalCount: 0, percentDone: 0, percentHandled: 0 };
    }
    const dayMap = this.completions$.value[dateKey] || {};
    const skipMap = this.skips$.value[dateKey] || {};
    const doneCount = activeHabits.reduce((sum, habit) => sum + (dayMap[habit.id] ? 1 : 0), 0);
    const skippedCount = activeHabits.reduce((sum, habit) => sum + (skipMap[habit.id] ? 1 : 0), 0);
    const handledCount = doneCount + skippedCount;
    const percentDone = Math.round((doneCount / totalCount) * 100);
    const percentHandled = Math.round((handledCount / totalCount) * 100);
    return { doneCount, skippedCount, handledCount, totalCount, percentDone, percentHandled };
  }

  getStreakCount(dateKey: string): number {
    const normalizedDateKey = this.normalizeDateKey(dateKey);
    if (!normalizedDateKey) {
      return 0;
    }
    const endingDate = this.dateFromKey(normalizedDateKey);
    if (!endingDate) {
      return 0;
    }
    let streak = 0;
    const cursor = new Date(endingDate);
    while (true) {
      const cursorDateKey = this.toIsoDateLocal(cursor);
      const summary = this.getDaySummaryByDateKey(cursorDateKey);
      const hasAnyCompletion = summary.doneCount > 0;
      if (!hasAnyCompletion) {
        break;
      }
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  getPerfectStreakCount(dateKey: string): number {
    const normalizedDateKey = this.normalizeDateKey(dateKey);
    if (!normalizedDateKey) {
      return 0;
    }
    const endingDate = this.dateFromKey(normalizedDateKey);
    if (!endingDate) {
      return 0;
    }
    let streak = 0;
    const cursor = new Date(endingDate);
    while (true) {
      const cursorDateKey = this.toIsoDateLocal(cursor);
      const summary = this.getDaySummaryByDateKey(cursorDateKey);
      const isPerfect = summary.totalCount > 0 && summary.doneCount === summary.totalCount;
      if (!isPerfect) {
        break;
      }
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  getWeeklyWins(endDateKey: string): { wins: number; total: number } {
    const normalizedEndDateKey = this.normalizeDateKey(endDateKey);
    if (!normalizedEndDateKey) {
      return { wins: 0, total: 7 };
    }
    const endDate = this.dateFromKey(normalizedEndDateKey);
    if (!endDate) {
      return { wins: 0, total: 7 };
    }

    let wins = 0;
    const total = 7;
    const cursor = new Date(endDate);
    for (let i = 0; i < total; i++) {
      const cursorDateKey = this.toIsoDateLocal(cursor);
      const summary = this.getDaySummaryByDateKey(cursorDateKey);
      const isPerfectDay = summary.totalCount > 0 && summary.doneCount === summary.totalCount;
      if (isPerfectDay) {
        wins++;
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    return { wins, total };
  }

  getCurrentStreak(todayKey?: string): number {
    const fallbackDateKey = this.toIsoDateLocal(new Date());
    const targetDateKey = this.normalizeDateKey(todayKey || fallbackDateKey);
    if (!targetDateKey) {
      return 0;
    }
    return this.getStreakCount(targetDateKey);
  }

  getBestDailyStreak(): number {
    return this.computeGlobalStreakSnapshot().bestDailyStreak;
  }

  getBestPerfectStreak(): number {
    return this.computeGlobalStreakSnapshot().bestPerfectStreak;
  }

  isCheckedForDate(year: number, monthIndex: number, dayNumber: number, habitId: string): boolean {
    const date = new Date(year, monthIndex, dayNumber);
    return this.isCompleted(habitId, this.resolveDate(date));
  }

  toggleCheckForDate(year: number, monthIndex: number, dayNumber: number, habitId: string): void {
    const date = this.resolveDate(new Date(year, monthIndex, dayNumber));
    const next = !this.isCompleted(habitId, date);
    this.setCompleted(habitId, date, next);
  }

  setAllForDayForDate(year: number, monthIndex: number, dayNumber: number, checked: boolean): void {
    const dateKey = this.toIsoDateLocal(this.resolveDate(new Date(year, monthIndex, dayNumber)));
    const completions = { ...this.completions$.value };
    const skips = { ...this.skips$.value };
    if (checked) {
      const dayMap: Record<string, boolean> = {};
      this.getHabitsActiveOn(dateKey).forEach(habit => {
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
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
    const habits = this.getHabitsForDateKey(dateKey);
    const dayMap = this.completions$.value[dateKey] || {};
    return habits.map(habit => ({
      habit,
      checked: dayMap[habit.id] === true
    }));
  }

  getHabitsActiveOn(dateKey: string): Habit[] {
    const normalizedDateKey = this.normalizeDateKey(dateKey) || this.toIsoDateLocal(new Date());
    return this.habits$.value
      .filter(habit => this.isHabitActiveOnDateKey(habit, normalizedDateKey))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  getHabitsForDateKey(dateKey: string): Habit[] {
    return this.getHabitsActiveOn(dateKey);
  }

  getCompletedHabitsForDate(dateKey: string): Habit[] {
    const habits = this.getHabitsForDateKey(dateKey);
    const dayMap = this.completions$.value[dateKey] || {};
    return habits.filter(habit => dayMap[habit.id] === true);
  }

  getIncompleteHabitsForDate(dateKey: string): Habit[] {
    const habits = this.getHabitsForDateKey(dateKey);
    const dayMap = this.completions$.value[dateKey] || {};
    return habits.filter(habit => dayMap[habit.id] !== true);
  }

  getSelectedDateHabitBreakdown(): Observable<{ dateKey: string; date: Date | null; completed: Habit[]; incomplete: Habit[] }> {
    return combineLatest([this.selectedDateKey$, this.habits$, this.completions$]).pipe(
      map(([dateKey]) => ({
        dateKey,
        date: this.dateFromKey(dateKey),
        completed: this.getCompletedHabitsForDate(dateKey),
        incomplete: this.getIncompleteHabitsForDate(dateKey)
      }))
    );
  }

  toggleHabitForDate(habitId: string, date: Date): void {
    const safeDate = this.resolveDate(date);
    const next = !this.isCompleted(habitId, safeDate);
    this.setCompleted(habitId, safeDate, next);
  }

  setAllForDate(date: Date, checked: boolean): void {
    const safeDate = this.resolveDate(date);
    const dateKey = this.toIsoDateLocal(safeDate);
    const completions = { ...this.completions$.value };
    const skips = { ...this.skips$.value };
    if (checked) {
      const dayMap: Record<string, boolean> = {};
      this.getHabitsActiveOn(dateKey).forEach(habit => {
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

  getMaxActiveHabitsInMonth(year: number, monthIndex: number): number {
    const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
    let max = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, day));
      const count = this.getHabitsActiveOn(dateKey).length;
      if (count > max) {
        max = count;
      }
    }
    return max;
  }

  getDailyCompletedCounts(): number[] {
    const monthKey = this.selectedMonthYear$.value;
    const daysInMonth = this.getDaysInMonth();
    const counts: number[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthKey.year, monthKey.month, day);
      const dateKey = this.toIsoDateLocal(date);
      const dayMap = this.completions$.value[dateKey] || {};
      const activeHabits = this.getHabitsActiveOn(dateKey);
      counts.push(activeHabits.reduce((sum, habit) => sum + (dayMap[habit.id] ? 1 : 0), 0));
    }

    return counts;
  }

  getHabitCompletionPercent(habitId: string, year: number, monthIndex: number): number {
    const monthKey = this.monthKeyToStringFromParts(year, monthIndex);
    return this.getMonthlyCompletionPercent(habitId, monthKey);
  }

  getMonthlyCompletionPercent(habitId: string, monthKey: string): number {
    const parsed = this.parseMonthKey(monthKey);
    if (!parsed) {
      return 0;
    }
    const { year, monthIndex } = parsed;
    const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
    if (daysInMonth <= 0) {
      return 0;
    }
    let completedDays = 0;
    let eligibleDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, day));
      const existsThatDay = this.getHabitsActiveOn(dateKey).some(habit => habit.id === habitId);
      if (!existsThatDay) {
        continue;
      }
      eligibleDays++;
      if (this.completions$.value[dateKey]?.[habitId]) {
        completedDays++;
      }
    }

    if (eligibleDays === 0) {
      return 0;
    }
    return Math.round((completedDays / eligibleDays) * 100);
  }

  getMonthInsights(year: number, monthIndex: number): MonthInsights {
    const daysInMonth = DateUtils.daysInMonth(year, monthIndex);
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
      const dayMap = this.completions$.value[dateKey] || {};
      const activeHabits = this.getHabitsActiveOn(dateKey);
      const count = activeHabits.reduce((sum, habit) => sum + (dayMap[habit.id] ? 1 : 0), 0);
      if (count > bestCount) {
        bestCount = count;
        bestDay = day;
      }
      if (count < worstCount) {
        worstCount = count;
        worstDay = day;
      }
      if (activeHabits.length > 0 && this.isPerfectDay(new Date(year, monthIndex, day))) {
        perfectDays++;
      }
    }

    let currentStreak = 0;
    for (let day = lastDayIndex; day >= 1; day--) {
      const dateKey = this.toIsoDateLocal(new Date(year, monthIndex, day));
      const summary = this.getDaySummaryByDateKey(dateKey);
      if (summary.doneCount > 0) {
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
    const { year, month } = this.selectedMonthYear$.value;
    const habits = this.habits$.value.filter(habit => this.isHabitActiveInMonth(habit, year, month));
    const goal = habits.reduce((sum, h) => sum + h.goalDays, 0);
    const completed = this.getDailyCompletedCounts().reduce((sum, count) => sum + count, 0);
    const left = goal - completed;
    const percent = goal > 0 ? Math.round((completed / goal) * 100) : 0;

    return { completed, goal, left, percent };
  }

  getTopHabits(limit: number): TopHabit[] {
    const monthState = this.selectedMonthYear$.value;
    const habits = this.habits$.value.filter(habit => this.isHabitActiveInMonth(habit, monthState.year, monthState.month));
    const monthKey = this.monthKeyToString(monthState);

    const topHabits: TopHabit[] = habits.map(habit => {
      const completionPercent = this.getMonthlyCompletionPercent(habit.id, monthKey);
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

  private parseMonthKey(monthKey: string): { year: number; monthIndex: number } | null {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return null;
    }
    const [yearPart, monthPart] = monthKey.split('-');
    const year = Number(yearPart);
    const month = Number(monthPart);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return null;
    }
    return { year, monthIndex: month - 1 };
  }

  getSnapshotForBackup(): StorageData {
    return {
      habits: this.habits$.value,
      completions: this.completions$.value,
      skips: this.skips$.value,
      timerStates: this.timerStates$.value,
      selectedMonthYear: this.selectedMonthYear$.value,
      onboardingCompleted: this.onboardingCompleted$.value,
      userProfile: this.userProfile$.value,
      profile: this.profile$.value,
      defaultsSeeded: this.defaultsSeeded
    };
  }

  restoreFromBackup(backup: BackupData, mode: 'replace' | 'merge' = 'replace'): void {
    const incomingChecks = this.normalizeCompletions(backup.checks || {});
    const normalizedHabits = (backup.habits || [])
      .filter(habit => habit && typeof habit.id === 'string')
      .map(habit => {
        const frequencyType = this.normalizeFrequencyType(habit.frequencyType || habit.frequency);
        const weeklyTargetRaw = Number(habit.weeklyTarget);
        const weeklyTarget = frequencyType === 'weekly' && Number.isFinite(weeklyTargetRaw)
          ? Math.min(7, Math.max(1, weeklyTargetRaw))
          : undefined;
        const minimumVersion = habit.minimumVersion ?? habit.minimum;
          const timerEnabled = Boolean((habit as Habit).timerEnabled ?? habit.timerEnabled);
          const timerSeconds = Math.max(0, Number((habit as Habit).timerSeconds ?? habit.timerSeconds) || 0);
          const type = (habit as Habit).type ?? habit.type ?? (timerEnabled ? 'timer' : 'check');
          const targetSeconds = Math.max(0, Number((habit as Habit).targetSeconds ?? habit.targetSeconds ?? timerSeconds) || 0);
          const allowManualComplete = (habit as Habit).allowManualComplete ?? habit.allowManualComplete ?? false;
          const reminderEnabled = Boolean((habit as Habit).reminderEnabled ?? habit.reminderEnabled ?? false);
          const reminderTime = this.normalizeReminderTime((habit as Habit).reminderTime ?? habit.reminderTime);
          const fallbackDateKey = this.inferCreatedAtDateKey(habit.id, incomingChecks, this.toIsoDateLocal(new Date()));
          return {
            id: habit.id,
            name: String(habit.name || '').trim() || 'Habit',
            difficulty: this.gamification.normalizeDifficulty((habit as Habit).difficulty ?? habit.difficulty),
            createdAtDateKey: this.normalizeDateKey(habit.createdAtDateKey) || fallbackDateKey,
            goalDays: Math.max(1, Number(habit.goalDays) || 1),
            frequencyType,
            weeklyTarget,
            minimumVersion: minimumVersion ? String(minimumVersion) : undefined,
            timerEnabled,
            timerSeconds,
            timerAutoComplete: (habit as Habit).timerAutoComplete ?? habit.timerAutoComplete ?? true,
            type,
            targetSeconds,
            allowManualComplete,
            reminderEnabled,
            reminderTime: reminderEnabled ? reminderTime : undefined,
            createdAt: Number((habit as Habit).createdAt) || Date.now(),
            isActive: (habit as Habit).isActive ?? true,
            sortOrder: Number((habit as Habit).sortOrder) || 0
          };
        });

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
      this.assertHabitDateKeys(mergedHabits);
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
        this.profile$.next(this.normalizeProfileSettings(backup.profile));
      }
      this.refreshUnlockedBadges(false);
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
    this.assertHabitDateKeys(normalizedHabits);
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
      this.profile$.next(this.normalizeProfileSettings(backup.profile));
    }

    const selectedYear = backup.appSettings?.selectedYear;
    const selectedMonthIndex = backup.appSettings?.selectedMonthIndex;
    if (typeof selectedYear === 'number' && typeof selectedMonthIndex === 'number' && selectedMonthIndex >= 0 && selectedMonthIndex <= 11) {
      this.selectedMonthYear$.next({ year: selectedYear, month: selectedMonthIndex });
    }

    this.refreshUnlockedBadges(false);
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
        timerStates: this.timerStates$.value,
        selectedMonthYear: this.selectedMonthYear$.value,
        onboardingCompleted: this.onboardingCompleted$.value,
        userProfile: this.userProfile$.value ?? undefined,
        profile: this.profile$.value,
        defaultsSeeded: this.defaultsSeeded
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

  private normalizeHabits(habits: Habit[], completions: HabitCompletion = {}): Habit[] {
    const todayDateKey = this.toIsoDateLocal(new Date());
    return habits.map((habit, index) => {
      const legacy = habit as Habit & { frequency?: 'daily' | 'weekly'; minimum?: string };
      const frequencyType = this.normalizeFrequencyType(habit.frequencyType || legacy.frequency);
      const weeklyTargetRaw = Number(habit.weeklyTarget);
      const weeklyTarget = frequencyType === 'weekly' && Number.isFinite(weeklyTargetRaw)
        ? Math.min(7, Math.max(1, weeklyTargetRaw))
        : undefined;
      const minimumVersion = habit.minimumVersion ?? legacy.minimum;
      const timerSeconds = Math.max(0, Number(habit.timerSeconds ?? habit.targetSeconds) || 0);
      const targetSeconds = Math.max(0, Number(habit.targetSeconds ?? habit.timerSeconds) || 0);
      const rawTimerEnabled = habit.timerEnabled ?? false;
      const type = habit.type ?? (rawTimerEnabled ? 'timer' : 'check');
      const timerEnabled = type === 'timer';
        const allowManualComplete = habit.allowManualComplete ?? false;
        const timerCompleted = habit.timerCompleted ?? false;
      const timerAutoComplete = habit.timerAutoComplete ?? true;
      const reminderEnabled = Boolean(habit.reminderEnabled ?? false);
      const reminderTime = this.normalizeReminderTime(habit.reminderTime);
      const shouldMigrateDrinkWater = String(habit.name || '').trim().toLowerCase() === 'drink water';
      const nextName = shouldMigrateDrinkWater ? 'Meditation' : habit.name?.trim() || `Habit ${index + 1}`;
      const migratedTarget = shouldMigrateDrinkWater ? 300 : targetSeconds;
      const migratedType: 'check' | 'timer' = shouldMigrateDrinkWater ? 'timer' : type;
      const migratedTimerEnabled = shouldMigrateDrinkWater ? true : timerEnabled;
      const migratedTimerSeconds = shouldMigrateDrinkWater ? 300 : timerSeconds;
      const fallbackDateKey = this.inferCreatedAtDateKey(habit.id, completions, todayDateKey);
      return {
        ...habit,
        name: nextName,
        difficulty: this.gamification.normalizeDifficulty(habit.difficulty),
        createdAtDateKey: this.normalizeDateKey(habit.createdAtDateKey) || fallbackDateKey,
        goalDays: habit.goalDays ?? 30,
        frequencyType,
        weeklyTarget,
        minimumVersion: minimumVersion ? String(minimumVersion) : undefined,
        timerEnabled: migratedTimerEnabled,
        timerSeconds: migratedTimerSeconds,
        timerAutoComplete,
        type: migratedType,
        targetSeconds: migratedTarget,
          allowManualComplete: shouldMigrateDrinkWater ? false : allowManualComplete,
          timerCompleted: shouldMigrateDrinkWater ? false : timerCompleted,
        reminderEnabled,
        reminderTime: reminderEnabled ? reminderTime : undefined,
        createdAt: habit.createdAt ?? Date.now() + index,
        isActive: habit.isActive ?? true,
        sortOrder: habit.sortOrder ?? index
      };
    }).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  private normalizeUserProfile(profile: UserProfile): UserProfile {
    const name = String(profile.name || '').trim();
    const statement = profile.statement ?? profile.whyStatement ?? profile.why;
    return {
      ...profile,
      name,
      statement: statement ? String(statement).trim() : undefined,
      whyStatement: statement ? String(statement).trim() : undefined,
      why: profile.why ? String(profile.why).trim() : undefined,
      persona: profile.persona ? String(profile.persona).trim() : undefined,
      primaryGoal: profile.primaryGoal ? String(profile.primaryGoal).trim() : undefined,
      createdAt: Number(profile.createdAt) || Date.now()
    };
  }

  private readNotificationSettings(profile: ProfileSettings | null | undefined): NotificationSettings {
    return {
      dailyEnabled: Boolean(profile?.dailyReminderEnabled),
      dailyTime: this.normalizeReminderTime(profile?.dailyReminderTime)
    };
  }

  private normalizeProfileSettings(profile: ProfileSettings): ProfileSettings {
    return {
      ...profile,
      displayName: profile.displayName ? String(profile.displayName).trim() : undefined,
      remindersEnabled: Boolean(profile.remindersEnabled ?? false),
      dailyReminderEnabled: Boolean(profile.dailyReminderEnabled ?? false),
      dailyReminderTime: this.normalizeReminderTime(profile.dailyReminderTime),
      soundsEnabled: Boolean(profile.soundsEnabled ?? false),
      unlockedBadgeIds: this.achievements.normalizeBadgeIds(profile.unlockedBadgeIds)
    };
  }

  private refreshUnlockedBadges(emitEvents: boolean): void {
    const metrics = this.buildAchievementMetrics();
    const nextUnlocked = this.achievements.getUnlockedBadgeIds(metrics);
    const previousUnlocked = this.achievements.normalizeBadgeIds(this.profile$.value.unlockedBadgeIds);
    const previousSet = new Set(previousUnlocked);
    const newlyUnlocked = nextUnlocked.filter(id => !previousSet.has(id));
    const changed = previousUnlocked.length !== nextUnlocked.length ||
      previousUnlocked.some((id, index) => nextUnlocked[index] !== id);

    if (changed) {
      this.profile$.next(this.normalizeProfileSettings({
        ...this.profile$.value,
        unlockedBadgeIds: nextUnlocked
      }));
    }

    if (emitEvents && newlyUnlocked.length > 0) {
      this.badgeUnlockEvents$.next(newlyUnlocked);
    }
  }

  private buildAchievementMetrics(): { totalCompletedCount: number; perfectDayCount: number; level: number } {
    const completions = this.completions$.value;
    let totalCompletedCount = 0;
    let perfectDayCount = 0;

    for (const [dateKey, dayMap] of Object.entries(completions)) {
      if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
        continue;
      }
      let dayCompleted = 0;
      for (const completed of Object.values(dayMap)) {
        if (completed === true) {
          dayCompleted += 1;
          totalCompletedCount += 1;
        }
      }
      if (dayCompleted > 0) {
        const summary = this.getDaySummaryByDateKey(dateKey);
        if (summary.totalCount > 0 && summary.doneCount === summary.totalCount) {
          perfectDayCount += 1;
        }
      }
    }

    return {
      totalCompletedCount,
      perfectDayCount,
      level: this.levelStats$.value.level
    };
  }

  private normalizeReminderTime(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!/^\d{2}:\d{2}$/.test(raw)) {
      return DEFAULT_DAILY_REMINDER_TIME;
    }
    const [hourStr, minuteStr] = raw.split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return DEFAULT_DAILY_REMINDER_TIME;
    }
    const safeHour = Math.min(23, Math.max(0, hour));
    const safeMinute = Math.min(59, Math.max(0, minute));
    return `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
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

  private removeHabitFromTimerStates(habitId: string, states: TimerStateMap): TimerStateMap {
    const cleaned: TimerStateMap = {};
    Object.entries(states).forEach(([dateKey, dayMap]) => {
      if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
        return;
      }
      const nextMap: Record<string, TimerState> = {};
      Object.entries(dayMap).forEach(([id, state]) => {
        if (id !== habitId && state && typeof state === 'object') {
          nextMap[id] = state as TimerState;
        }
      });
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

  private normalizeTimerStates(states: TimerStateMap): TimerStateMap {
    const normalized: TimerStateMap = {};
    Object.entries(states).forEach(([dateKey, dayMap]) => {
      if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) {
        return;
      }
      const cleanedMap: Record<string, TimerState> = {};
      Object.entries(dayMap).forEach(([habitId, state]) => {
        if (!state || typeof state !== 'object') {
          return;
        }
        const raw = state as TimerState;
        const elapsedSeconds = Math.max(0, Number(raw.elapsedSeconds) || 0);
        const running = Boolean(raw.running);
        const lastStartTimestamp = Number(raw.lastStartTimestamp) || undefined;
        cleanedMap[habitId] = {
          elapsedSeconds,
          running,
          lastStartTimestamp: running ? lastStartTimestamp : undefined
        };
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

  private isHabitActiveOnDateKey(habit: Habit, dateKey: string): boolean {
    if (!habit.isActive) {
      return false;
    }
    const createdAtDateKey = this.normalizeDateKey(habit.createdAtDateKey);
    if (!createdAtDateKey) {
      return true;
    }
    return createdAtDateKey <= dateKey;
  }

  private isHabitActiveInMonth(habit: Habit, year: number, monthIndex: number): boolean {
    if (!habit.isActive) {
      return false;
    }
    const createdAtDateKey = this.normalizeDateKey(habit.createdAtDateKey);
    if (!createdAtDateKey) {
      return true;
    }
    const monthEndKey = this.toIsoDateLocal(new Date(year, monthIndex + 1, 0));
    return createdAtDateKey <= monthEndKey;
  }

  private inferCreatedAtDateKey(habitId: string, completions: HabitCompletion, fallbackDateKey: string): string {
    const inferredFromCompletions = Object.keys(completions)
      .filter(dateKey => Boolean(completions[dateKey]?.[habitId]))
      .sort()[0];
    return this.normalizeDateKey(inferredFromCompletions) || fallbackDateKey;
  }

  private normalizeDateKey(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  private assertHabitDateKeys(habits: Habit[]): void {
    if (!isDevMode()) {
      return;
    }
    const invalid = habits.find(habit => !this.normalizeDateKey(habit.createdAtDateKey));
    if (invalid) {
      console.warn('[HabitStoreService] Habit missing valid createdAtDateKey', invalid.id);
    }
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

  private resolveDate(date: Date): Date {
    if (this.isAdmin()) {
      return this.normalizeDate(date);
    }
    return this.normalizeDate(new Date());
  }

  private enforceAdminDateLock(): void {
    if (this.isAdmin()) {
      return;
    }
    const today = this.normalizeDate(new Date());
    this.selectedDateKey$.next(this.toIsoDateLocal(today));
    this.selectedMonthYear$.next({ year: today.getFullYear(), month: today.getMonth() });
  }

  private computeTotalXpFromState(habits: Habit[], completions: HabitCompletion): number {
    const dateKeys = Object.keys(completions).sort();
    let totalXP = 0;
    for (const dateKey of dateKeys) {
      const activeHabits = this.getHabitsActiveOnFromList(habits, dateKey);
      totalXP += this.gamification.computeDayXP(dateKey, activeHabits, completions, true).dayXP;
    }
    return totalXP;
  }

  private getHabitsActiveOnFromList(habits: Habit[], dateKey: string): Habit[] {
    const normalizedDateKey = this.normalizeDateKey(dateKey) || this.toIsoDateLocal(new Date());
    return habits
      .filter(habit => this.isHabitActiveOnDateKey(habit, normalizedDateKey))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  private computeGlobalStreakSnapshot(): StreakSnapshot {
    const endKey = this.toIsoDateLocal(new Date());
    const startKey = this.getEarliestTrackedDateKey();
    if (!startKey) {
      return {
        currentDailyStreak: 0,
        currentPerfectStreak: 0,
        bestDailyStreak: 0,
        bestPerfectStreak: 0
      };
    }

    const summariesByDateKey: Record<string, Pick<DayXpSummary, 'doneCount' | 'isPerfectDay'>> = {};
    const sortedDateKeysAsc: string[] = [];
    let cursor = this.dateFromKey(startKey);
    const end = this.dateFromKey(endKey);
    if (!cursor || !end) {
      return {
        currentDailyStreak: 0,
        currentPerfectStreak: 0,
        bestDailyStreak: 0,
        bestPerfectStreak: 0
      };
    }

    while (cursor <= end) {
      const key = this.toIsoDateLocal(cursor);
      const summary = this.getDaySummaryByDateKey(key);
      summariesByDateKey[key] = {
        doneCount: summary.doneCount,
        isPerfectDay: summary.totalCount > 0 && summary.doneCount === summary.totalCount
      };
      sortedDateKeysAsc.push(key);
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }

    return this.gamification.computeStreaks(sortedDateKeysAsc, summariesByDateKey);
  }

  private getEarliestTrackedDateKey(): string | null {
    const candidates: string[] = [];
    for (const habit of this.habits$.value) {
      const key = this.normalizeDateKey(habit.createdAtDateKey);
      if (key) {
        candidates.push(key);
      }
    }
    candidates.push(...Object.keys(this.completions$.value).filter(key => Boolean(this.normalizeDateKey(key))));
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort();
    return candidates[0] ?? null;
  }
}
