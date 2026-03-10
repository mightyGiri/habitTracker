# Data model and storage

## Core models

### Habit (`src/app/models/habit.model.ts`)
Fields:
- `id: string`
- `name: string`
- `goalDays: number`
- `frequencyType?: 'daily' | 'weekly'`
- `weeklyTarget?: number`
- `minimumVersion?: string`
- `timerEnabled?: boolean`
- `timerSeconds?: number`
- `timerAutoComplete?: boolean`
- `type?: 'check' | 'timer'`
- `targetSeconds?: number`
- `allowManualComplete?: boolean`
- `timerCompleted?: boolean`
- `color?: string`
- `createdAt: number` (epoch ms)
- `isActive: boolean`
- `sortOrder: number`

### Day records
- Completions: `HabitCompletion`  
  `{"YYYY-MM-DD": { "habitId": true | false }}`
- Skips: `HabitSkips`  
  `{"YYYY-MM-DD": { "habitId": { reason, note?, ts } }}`

### Timer state
`TimerStateMap`:
`{"YYYY-MM-DD": { "habitId": { elapsedSeconds, running, lastStartTimestamp? }}}`

### PersistedState (storage)
From `src/app/services/storage.service.ts`:
- `schemaVersion: number`
- `habits: Habit[]`
- `completions: HabitCompletion`
- `skips?: HabitSkips`
- `timerStates?: TimerStateMap`
- `selectedMonthYear: MonthKey`
- `onboardingCompleted?: boolean`
- `userProfile?: UserProfile`
- `profile?: ProfileSettings`
- `defaultsSeeded?: boolean`
- `settings?: { theme?: AppTheme }`

## Storage keys
- IndexedDB:
  - DB: `habit-tracker-db`
  - Store: `app-state`
  - Key: `state`
- localStorage:
  - `habit_tracker_data` (fallback state)
  - `habit_tracker_settings` (SettingsService)
  - `habit_tracker_theme` (ThemeService)
  - `levelup_profile` (ProfileService)
  - `active_timer_state` (TimerService)
  - `onboardingComplete` (HabitStoreService)
  - `pwa_install_banner_dismissed` (Dashboard UI)
  - `habit_rewards` (Dashboard UI)

## Example JSON snapshots

### Habits list
```json
[
  {
    "id": "habit_1",
    "name": "Meditation",
    "goalDays": 30,
    "frequencyType": "daily",
    "timerEnabled": true,
    "timerSeconds": 300,
    "timerAutoComplete": true,
    "type": "timer",
    "targetSeconds": 300,
    "allowManualComplete": false,
    "timerCompleted": false,
    "createdAt": 1700000000000,
    "isActive": true,
    "sortOrder": 1
  }
]
```

### Today progress (completions + skips)
```json
{
  "completions": {
    "2026-02-02": {
      "habit_1": true,
      "habit_2": false
    }
  },
  "skips": {
    "2026-02-02": {
      "habit_3": {
        "reason": "Busy",
        "note": "Work travel",
        "ts": 1700000000000
      }
    }
  }
}
```

### Timer persisted state (localStorage `active_timer_state`)
```json
{
  "habitId": "habit_1",
  "dateKey": "2026-02-02",
  "durationSec": 300,
  "startAtEpochMs": 1700000000000,
  "pausedTotalMs": 0,
  "isPaused": false,
  "pausedAtEpochMs": null
}
```
