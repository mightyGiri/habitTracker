# Internal API reference (services)

This section documents app-internal service APIs (not REST).

## AchievementEventsService (`src/app/services/achievement-events.service.ts`)
- Purpose: Broadcast achievement events to the UI.
- Methods:
  - `getEvents(): Observable<AchievementEvent>`
  - `emit(event: AchievementEvent): void`
- Storage keys: none

## AchievementQueueService (`src/app/services/achievement-queue.service.ts`)
- Purpose: Queue/display achievements in sequence.
- Methods:
  - `getCurrent(): Observable<AchievementPayload | null>`
  - `getShowActions(): Observable<boolean>`
  - `enqueue(payload: AchievementPayload): void`
  - `closeCurrent(): void`
- Storage keys: none

## BackupService (`src/app/services/backup.service.ts`)
- Purpose: Export user data.
- Methods:
  - `exportJsonBackup(): void`
  - `exportDailyCountsCsv(): void`
  - `exportHabitChecksCsv(): void`
  - `exportXlsx(): void`
- Storage keys: none (reads from HabitStoreService)

## HabitStoreService (`src/app/services/habit-store.service.ts`)
- Purpose: Central state for habits/completions/skips/levels/timers.
- Observables:
  - `getHabits(): Observable<Habit[]>`
  - `getCompletions(): Observable<HabitCompletion>`
  - `getSkips(): Observable<HabitSkips>`
  - `getTimerStates(): Observable<TimerStateMap>`
  - `getLevelStats(): Observable<LevelProgress>`
  - `getSelectedMonthYear(): Observable<MonthKey>`
  - `getSelectedDateKey(): Observable<string>`
  - `getUserProfile(): Observable<UserProfile | null>`
  - `getProfile(): Observable<ProfileSettings>`
  - `getOnboardingCompleted(): Observable<boolean>`
  - `getReady(): Observable<boolean>`
- Public methods (signatures):
  - `setSelectedMonthYear(year: number, monthIndex: number): void`
  - `getSelectedMonthYearSync(): MonthKey`
  - `getSelectedDateKeySync(): string`
  - `setSelectedDate(date: Date): void`
  - `getHabitsSync(): Habit[]`
  - `getCompletionsSync(): HabitCompletion`
  - `getLevelStatsSync(): LevelProgress`
  - `getTimerStatesSync(): TimerStateMap`
  - `getUserProfileSync(): UserProfile | null`
  - `getProfileSync(): ProfileSettings`
  - `setProfile(profile: ProfileSettings): void`
  - `setUserProfile(profile: UserProfile): void`
  - `getCurrentUsername(): string`
  - `isAdmin(): boolean`
  - `completeOnboarding(): void`
  - `skipOnboarding(): void`
  - `onboardingCompletedSync(): boolean`
  - `getSkipsSync(): HabitSkips`
  - `setHabitTimerCompleted(habitId: string, completed: boolean): void`
  - `getTimerState(date: Date, habitId: string): TimerState | null`
  - `setTimerState(dateKey: string, habitId: string, state: TimerState): void`
  - `clearTimerState(dateKey: string, habitId: string): void`
  - `addHabit(name: string, frequencyType: 'daily' | 'weekly', weeklyTarget: number | undefined, minimumVersion: string, goalDays = 30, timerEnabled = false, timerSeconds = 0, timerAutoComplete = true): void`
  - `deleteHabit(habitId: string): void`
  - `renameHabit(habitId: string, newName: string): void`
  - `updateGoalDays(habitId: string, goalDays: number): void`
  - `updateHabit(habitId: string, patch: Partial<Pick<Habit, ...>>): void`
  - `toggleHabitActive(habitId: string): void`
  - `reorderHabits(fromIndex: number, toIndex: number): void`
  - `setAllForDay(dayNumber: number, checked: boolean): void`
  - `toggleCheck(dayNumber: number, habitId: string): void`
  - `isChecked(dayNumber: number, habitId: string): boolean`
  - `toDateKey(date: Date): string`
  - `isCompleted(habitId: string, date: Date): boolean`
  - `isSkipped(habitId: string, date: Date): boolean`
  - `setCompleted(habitId: string, date: Date, completed: boolean): void`
  - `skipHabit(habitId: string, date: Date, reason: string, note?: string): void`
  - `unskipHabit(habitId: string, date: Date): void`
  - `skipRemaining(date: Date, reason: string, note?: string): void`
  - `isPerfectDay(date: Date): boolean`
  - `getRemainingCount(date: Date): number`
  - `getDaySummary(date: Date): { doneCount; skippedCount; handledCount; totalCount; percentDone; percentHandled }`
  - `getStreakCount(endingDate: Date): number`
  - `getCurrentStreak(todayKey?: string): number`
  - `isCheckedForDate(year: number, monthIndex: number, dayNumber: number, habitId: string): boolean`
  - `toggleCheckForDate(year: number, monthIndex: number, dayNumber: number, habitId: string): void`
  - `setAllForDayForDate(year: number, monthIndex: number, dayNumber: number, checked: boolean): void`
  - `getHabitsForDate(date: Date): Array<{ habit: Habit; checked: boolean }>`
  - `toggleHabitForDate(habitId: string, date: Date): void`
  - `setAllForDate(date: Date, checked: boolean): void`
  - `getDaysInMonth(): number`
  - `getDailyCompletedCounts(): number[]`
  - `getHabitCompletionPercent(habitId: string, year: number, monthIndex: number): number`
  - `getMonthInsights(year: number, monthIndex: number): MonthInsights`
  - `getTodayDayNumberIfInSelectedMonth(): number | null`
  - `getMonthlyTotals(): MonthlyTotals`
  - `getTopHabits(limit: number): TopHabit[]`
  - `getSnapshotForBackup(): StorageData`
  - `restoreFromBackup(backup: BackupData, mode: 'replace' | 'merge' = 'replace'): void`
- Storage keys:
  - Persists state via `StorageService` (IndexedDB + localStorage fallback)
  - Uses `localStorage` key `onboardingComplete`

## MonthSelectorService (`src/app/services/month-selector.service.ts`)
- Purpose: UI helper for month navigation.
- Methods:
  - `getCurrentMonth(): Observable<MonthKey>`
  - `getCurrentMonthSync(): MonthKey`
  - `setMonth(year: number, month: number): void`
  - `nextMonth(): void`
  - `previousMonth(): void`
  - `getAvailableYears(): number[]`
  - `getMonths(): { value: number; label: string }[]`
  - `getMonthLabel(month: number): string`
  - `getDaysInMonth(year: number, month: number): number`
  - `getWeeksInMonth(year: number, month: number): Date[][]`
- Storage keys: none

## NotificationService (`src/app/services/notification.service.ts`)
- Purpose: Schedule local notifications (native only).
- Methods:
  - `init(): void`
  - `dispose(): void`
- Storage keys: none

## ProfileService (`src/app/services/profile.service.ts`)
- Purpose: Load/save onboarding profile summary.
- Methods:
  - `loadProfile(): UserProfile | null`
  - `saveProfile(profile: UserProfile): void`
  - `isOnboarded(): boolean`
- Storage keys:
  - `localStorage` key `levelup_profile`

## SettingsService (`src/app/services/settings.service.ts`)
- Purpose: Persist and apply UI/notification settings.
- Methods:
  - `getSettings(): Observable<AppSettings>`
  - `getSettingsSync(): AppSettings`
  - `updateSettings(patch: Partial<AppSettings>): void`
- Storage keys:
  - `localStorage` key `habit_tracker_settings`

## ShareService (`src/app/services/share.service.ts`)
- Purpose: Share/save images and copy text.
- Methods:
  - `captureElement(element: HTMLElement): Promise<Blob>`
  - `shareImage(element: HTMLElement, title: string, text: string): Promise<void>`
  - `saveImage(element: HTMLElement, fileName = 'achievement.png'): Promise<void>`
  - `copyText(text: string): Promise<void>`
- Storage keys: none

## StorageService (`src/app/services/storage.service.ts`)
- Purpose: Persist app state in IndexedDB with localStorage fallback.
- Methods:
  - `loadState(): Promise<PersistedState | null>`
  - `saveState(state: PersistedState): Promise<void>`
- Storage keys:
  - IndexedDB: DB `habit-tracker-db`, store `app-state`, key `state`
  - localStorage fallback: `habit_tracker_data`

## TabStateService (`src/app/services/tab-state.service.ts`)
- Purpose: Track current tab for UI (Today/Overview/etc.).
- Methods:
  - `setCurrentTab(tab: string): void`
  - `getCurrentTab(): Observable<string>`
  - `getCurrentTabSync(): string`
- Storage keys: none

## ThemeService (`src/app/services/theme.service.ts`)
- Purpose: Apply and persist theme + reduced motion.
- Methods:
  - `getTheme(): Observable<AppTheme>`
  - `getThemeSync(): AppTheme`
  - `getReducedMotion(): Observable<boolean>`
  - `getReducedMotionSync(): boolean`
  - `toggleTheme(): void`
  - `setTheme(theme: AppTheme): void`
- Storage keys:
  - `localStorage` key `habit_tracker_theme`

## TimerService (`src/app/services/timer.service.ts`)
- Purpose: Single source of truth for timer habits.
- Observables:
  - `state$: Observable<TimerSession | null>`
  - `getSession(): Observable<TimerSession | null>`
  - `getCompletionEvents(): Observable<TimerSession>`
- Methods:
  - `getSessionSync(): TimerSession | null`
  - `startTimer(habitId: string, dateKey: string, targetSeconds: number, autoComplete = true, allowManualComplete = false): boolean`
  - `pauseTimer(): void`
  - `resumeTimer(): void`
  - `cancelTimer(): void`
  - `resetTimer(habitId: string, dateKey: string): void`
  - `stopAndClear(): void`
- Storage keys:
  - `localStorage` key `active_timer_state`
