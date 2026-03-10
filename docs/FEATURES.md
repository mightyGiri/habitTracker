# Features

Each feature lists purpose, user-facing behavior, and key files.

## Habit list & completion
- Purpose: Track daily habits and mark completion or skips.
- Behavior: Users toggle a habit; completion updates streak/XP/insights.
- Key files:
  - `src/app/pages/dashboard/dashboard.component.ts`
  - `src/app/pages/habits/habits.component.ts`
  - `src/app/services/habit-store.service.ts`
  - `src/app/shared/components/habit-check/habit-check.component.ts`

## Streak / XP / Level
- Purpose: Reward consistency with streaks and XP-based levels.
- Behavior: Completing habits increases XP; streaks update based on daily completion.
- Key files:
  - `src/app/services/habit-store.service.ts`
  - `src/app/shared/level-utils.ts`
  - `src/app/pages/dashboard/dashboard.component.ts`
  - `src/app/pages/overview/overview.component.ts`

## Insights charts
- Purpose: Visualize monthly progress and top habits.
- Behavior: Charts update from stored completions/skips.
- Key files:
  - `src/app/pages/dashboard/dashboard.component.ts`
  - `src/app/pages/overview/overview.component.ts`
  - `src/app/shared/date-utils.ts`

## Timer habits (Meditation)
- Purpose: Support timed habits with pause/resume/reset and auto-complete.
- Behavior: Timer state updates every second; completing timer marks habit done.
- Key files:
  - `src/app/services/timer.service.ts`
  - `src/app/components/timer-dock/timer-dock.component.ts`
  - `src/app/pages/dashboard/dashboard.component.ts`
  - `src/app/services/habit-store.service.ts`

## Notifications
- Purpose: Remind users throughout the day.
- Behavior: Schedules local notifications for reminders and streak warnings (native only).
- Key files:
  - `src/app/services/notification.service.ts`
  - `src/app/services/settings.service.ts`

## Backup / export / import
- Purpose: Let users export data or restore from a backup.
- Behavior: Export to JSON/CSV/XLSX; import JSON with confirmation.
- Key files:
  - `src/app/services/backup.service.ts`
  - `src/app/pages/profile/profile.component.ts`
  - `src/app/shared/import-confirm-dialog.component.ts`

## Sharing (achievement images)
- Purpose: Share or save achievement snapshots.
- Behavior: Generates an image from DOM and shares/saves it on web/native.
- Key files:
  - `src/app/services/share.service.ts`
  - `src/app/components/achievement-overlay/achievement-overlay.component.ts` (TODO: confirm UI wiring)
