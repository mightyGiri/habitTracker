# APP_BLUEPRINT

## Overview
- App name: "habitTracker" (Angular app with SSR + PWA + Capacitor Android wrapper)
- Root: `habitTracker/`
- Rendering: Angular SSR enabled (angular.json `outputMode: server`), plus static output for Capacitor (`build:capacitor`)
- PWA: Angular Service Worker (`ngsw-config.json`)
- Mobile: Capacitor configured (`capacitor.config.ts`, `/android`)

## Tech Stack
- Angular: ^20.3.x (see `package.json`)
- Angular Material: ^20.2.x
- RxJS: ~7.8.0
- Charting: Chart.js ^4.5.1 (also `ng2-charts` present)
- Storage: IndexedDB via `idb` with localStorage fallback
- Capacitor: core/cli/android/app/local-notifications/share/filesystem
- SSR tooling: `@angular/ssr`, `express`, `serverless-http`

## Routes & Pages
Source: `src/app/app.routes.ts`

Routes:
- `/` -> redirect to `/splash`
- `/splash` -> `src/app/pages/splash/splash.component.ts`
- `/getting-started` -> `src/app/pages/onboarding/onboarding.component.ts`
- `/onboarding` -> `src/app/pages/onboarding/onboarding.component.ts`
- `/today` -> `src/app/pages/dashboard/dashboard.component.ts`
- `/overview` -> `src/app/pages/overview/overview.component.ts`
- `/habits` -> `src/app/pages/habits/habits.component.ts`
- `/profile` -> `src/app/pages/profile/profile.component.ts`
- `/about` -> `src/app/pages/about/about.component.ts`
- `/terms` -> `src/app/pages/terms/terms.component.ts`
- `/privacy` -> `src/app/pages/privacy/privacy.component.ts`
- `**` -> redirect to `/splash`

Guarding:
- `onboardingGuard` in `src/app/guards/onboarding.guard.ts` blocks main routes until onboarding completed, redirects to `/getting-started`.

## Key Components
Top-level folders under `src/app/`:
- `pages/` - page-level routes (dashboard, habits, overview, profile, etc.)
- `components/` - reusable feature blocks (timer dock, overlays, daily habits)
- `shared/` - UI primitives (progress bar, toggle, bottom nav), utilities, animations, pipes
- `services/` - state, storage, theme, notifications, timers, backup, etc.
- `models/` - TypeScript interfaces for habits, profiles, stats

Notable components:
- `src/app/pages/dashboard/dashboard.component.ts` (Today/Dashboard UI)
- `src/app/components/timer-dock/timer-dock.component.ts`
- `src/app/shared/progress-bar.component.ts`
- `src/app/shared/bottom-nav/bottom-nav.component.*`
- `src/app/shared/ui/toggle/toggle.component.*`
- `src/app/pages/profile/profile-edit-dialog.component.ts`

## Services & State
Primary state store:
- `HabitStoreService` (`src/app/services/habit-store.service.ts`)
  - Holds BehaviorSubjects for: habits, completions, skips, timerStates, selectedMonthYear, selectedDateKey, levelStats, userProfile, profile settings
  - Hydrates from `StorageService` on startup, then persists on changes
  - Uses `DateUtils` and multiple normalizers

Storage:
- `StorageService` (`src/app/services/storage.service.ts`)
  - IndexedDB database: `habit-tracker-db` (store: `app-state` key: `state`)
  - LocalStorage fallback key: `habit_tracker_data`

Settings:
- `SettingsService` (`src/app/services/settings.service.ts`)
  - Stores theme mode, accent, font size/family, notification settings in localStorage key `habit_tracker_settings`
  - Applies CSS variables + root attributes (`data-theme`, `data-accent`, `data-font`)

Theme:
- `ThemeService` (`src/app/services/theme.service.ts`)
  - Persists theme in localStorage key `habit_tracker_theme`
  - Also stores a `themeKey` key in localStorage
  - Applies `data-theme` on `<html>`

## Level / XP / Streak System
Two related systems are present:

1) Lifetime/total-done leveling
- `src/app/shared/level-utils.ts`:
  - `getLevelProgress(totalDone)` uses triangular-number thresholds (level n requires n(n+1)/2 total done)
  - Returns: `level`, `nextLevel`, `requiredForNext`, `progressInLevel`, `requiredThisLevel`, `progressPercent`, `remainingToNext`
- `HabitStoreService` builds `levelStats` by counting all completions across all days.

2) "Today" level progress
- `src/app/shared/level.logic.ts`:
  - Thresholds: levels 1-5 use triangular numbers, level >=6 increments by +5 after L5.
  - `getLevelProgressFromCount(count)` returns `level`, `nextLevel`, `remaining`, `progressPct`, and thresholds.
- `LevelService` wraps that logic and stores per-day levels in localStorage with key `level:YYYY-MM-DD`.

Streak and Perfect Day:
- Perfect day: in `HabitStoreService.isPerfectDay(date)` - all active habits are handled (done or skipped).
- Streak: `getCurrentStreak` and `getStreakCount` count consecutive perfect days backward from a date.
- Dashboard uses `MonthInsights` and `selectedDay` summaries to show streak and perfect day badges.

Level-up animation hooks:
- Dashboard uses `isLevelUpCelebrating`, `levelUpSequenceActive`, `pendingLevelProgress`, and timers; change detection is manual in multiple places due to zoneless CD.

## Today/Dashboard UI Composition
File: `src/app/pages/dashboard/dashboard.component.ts`
Template sections (inline template):
- Header block: username + level badge, date line, daily quote, next-level progress bar
- Status row: perfect day badge + streak badge
- Hero message: daily progress message + streak completion text
- Today habits list: habit cards + check/timer controls
- Timer dock: `<app-timer-dock>` inserted in flow
- Streak card
- Insights section (charts + top habits)
- Footer "Jump to top" and install banner

Styles: `src/app/pages/dashboard/dashboard.component.sass` (classes like `.today-header`, `.today-item`, `.insights-body`, `.next-level-progress`)

## Insights / Charts
- Chart.js is used directly in `DashboardComponent`.
- Charts created in `createCharts()` using `Chart` from `chart.js/auto`.
- Lifecycle:
  - `createCharts()` is called in `ngAfterViewInit()` (guarded with `isPlatformBrowser`).
  - `updateCharts()` is called on data updates and when Insights is toggled.
  - `updateChartTheme()` pulls CSS variables (`--theme-accent`, `--theme-accent-soft`, `--theme-chart-text`, etc.).
- Potential lifecycle sensitivity: canvases are inside `*ngIf="insightsOpen"`, but charts are created in `ngAfterViewInit()`; if Insights is closed at init, canvases do not exist and charts will not be created until a later call creates them.

## Profile System
- `ProfileComponent`: `src/app/pages/profile/profile.component.ts`
  - Uses `ProfileEditDialogComponent` for edits.
  - Displays profile data from `HabitStoreService` (`UserProfile` + `ProfileSettings`).
  - "Help & About" section pulls dynamic version from `VersionService`.
- `ProfileEditDialogComponent`: `src/app/pages/profile/profile-edit-dialog.component.ts`
  - Dialog returns `ProfileEditResult` for `displayName`, `persona`, `goal`, `why`.
- User profile shape:
  - `UserProfile`: `name`, `persona`, `primaryGoal`, `why`, `whyStatement`, `statement`, `createdAt`.
  - `ProfileSettings`: `displayName`, `dailyWinTarget`, `requiredHabitsCount`.

## Notifications / Reminders
Two services exist:
- `NotificationService` (`src/app/services/notification.service.ts`)
  - Uses `@capacitor/local-notifications` when running native (`Capacitor.isNativePlatform()`)
  - Schedules reminders at 07:00, 10:00, 13:00, 16:00, 19:00 with stable IDs 51000+ and a 19:00 warning
  - Stores enable flag in localStorage key `notificationsEnabled`
  - Uses `HabitStoreService.getDaySummary` for pending count; on pending=0 cancels and fires a congrats notification
- `NotificationSettingsService` (`src/app/services/notification-settings.service.ts`)
  - Web-notification permission helper with key `dl_notifications_enabled`

Profile "Personalization" uses `NotificationService` toggling (see `profile.component.ts`).

## Theming
- Theme values applied via CSS variables and `data-theme` on `<html>`.
- `ThemeService` persists theme to `habit_tracker_theme` and updates `data-theme`.
- `SettingsService` also applies theme/accent/font size/family and writes to localStorage.
- Theme variables likely defined in `src/styles.sass` / `src/custom-theme.scss`.

## Versioning / Release
Sources:
- `package.json` version: `1.3`
- `src/assets/version.json` provides version/build/releaseDate
- `VersionService` reads `assets/version.json` and exposes `getVersion$()` / `getBuild$()`
- Profile/About pages bind to VersionService
- Android wrapper: `android/app/build.gradle` (not inspected here, but present in repo)

Single source of truth:
- `src/assets/version.json` is used as the runtime source for UI.

## Known Risks / Areas Likely To Break
(From repo evidence only)
- Charts lifecycle: canvases live under `*ngIf="insightsOpen"` while chart creation is in `ngAfterViewInit()`; if insights is closed on first render, chart creation may not occur. This can yield blank charts until a later toggle explicitly creates them.
- Zoneless change detection (`provideZonelessChangeDetection()` in `app.config.ts`) means async timers must call `ChangeDetectorRef` to repaint. Some UI updates may require manual CD if not already covered.
- Notifications: two separate services and preference keys (`notificationsEnabled` vs `dl_notifications_enabled`) could diverge; ensure UI uses a single source.
- Theme persistence: both `ThemeService` and `SettingsService` write theme-related keys; conflicts possible if both set theme differently.

---

Generated from repository state at `habitTracker/`.
