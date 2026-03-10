# Architecture

## High-level structure
- `src/app/pages`: route-level screens (Today, Overview, Habits, Profile, etc.)
- `src/app/services`: app state, storage, timers, notifications, export/import
- `src/app/models`: data model types
- `src/app/components` and `src/app/shared`: reusable UI components
- `android/`: native Android project (Capacitor)

## Routing + major pages
Routes are defined in `src/app/app.routes.ts`:
- `/splash`, `/onboarding`, `/getting-started`
- `/today` (Dashboard)
- `/overview`
- `/habits`
- `/profile`
- `/about`, `/terms`, `/privacy`

## Services layer
Core services:
- `HabitStoreService` (source of truth for habits/completions/skips/stats)
- `StorageService` (IndexedDB + localStorage persistence)
- `TimerService` (timer state + completion events)
- `NotificationService` (local notifications via Capacitor)
- `SettingsService`, `ThemeService`, `ProfileService` (user prefs)
- `BackupService`, `ShareService`

## Data storage layer
Primary persistence is IndexedDB (`idb`) with localStorage fallback. See `docs/DATA_MODEL.md` for schema and storage keys.

## State management
The app uses RxJS `BehaviorSubject` and `Observable` streams inside services. Components subscribe and react to updates.

## Diagrams

### App navigation
```mermaid
flowchart LR
  Splash[/splash/] --> Onboarding[/onboarding/]
  Onboarding --> Today[/today/]
  Today --> Overview[/overview/]
  Today --> Habits[/habits/]
  Today --> Profile[/profile/]
  Today --> About[/about/]
  Today --> Terms[/terms/]
  Today --> Privacy[/privacy/]
```

### Timer workflow
```mermaid
sequenceDiagram
  participant UI as Dashboard/Timer Dock
  participant Timer as TimerService
  participant Store as HabitStoreService
  participant Storage as StorageService

  UI->>Timer: startTimer(habitId, dateKey, targetSeconds)
  Timer->>Timer: start tick loop (1s)
  Timer->>Store: setTimerState(dateKey, habitId)
  Store->>Storage: saveState()
  Timer-->>UI: state$ emits (running/paused)
  Timer->>Timer: remainingSeconds <= 0
  Timer->>Store: setCompleted(habitId, date)
  Timer->>Store: setHabitTimerCompleted(habitId, true)
  Timer-->>UI: completion event
```

### Habit completion workflow
```mermaid
sequenceDiagram
  participant UI as Today Habits UI
  participant Store as HabitStoreService
  participant Storage as StorageService

  UI->>Store: setCompleted(habitId, date, true/false)
  Store->>Store: recompute summaries/level stats
  Store->>Storage: saveState()
  Store-->>UI: observables emit updated data
```
