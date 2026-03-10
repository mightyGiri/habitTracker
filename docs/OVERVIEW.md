# Overview

Level-Up is a daily habit tracker focused on momentum. Users complete habits each day, build streaks, and earn XP that drives level progression. The app is offline-first and stores all data locally on the device.

## Core concept
- Daily habits with completion/skip states
- Streaks and XP/levels derived from daily progress
- Insights that summarize progress by day and month
- Timer-based habits (e.g., Meditation)

## Main screens
- Today (`/today`): daily habits list, streak summary, insights entry point, timer dock
- Overview (`/overview`): monthly insights and charts
- Habits (`/habits`): manage habits (add/edit/reorder)
- Profile (`/profile`): personalization and settings
- Onboarding (`/onboarding`, `/getting-started`): first-run setup
- Splash/About/Terms/Privacy: static content

## Data flow (high level)
1) User action (toggle habit, start timer) updates `HabitStoreService` or `TimerService`.
2) `HabitStoreService` updates in-memory BehaviorSubjects.
3) `StorageService` persists state to IndexedDB (fallback to localStorage).
4) Observables emit updates to UI components (Today/Overview/etc.).

## Local storage strategy
The app is offline-first and persists state in IndexedDB (via `idb`) with a localStorage fallback. Small UI settings and timer state are stored in localStorage.

## Day selection behavior
`HabitStoreService` tracks `selectedMonthYear` and `selectedDateKey`. For non-admin users, the selected date is locked to today; admin users can move across dates (used in the dashboard’s date carousel).

## Next docs
Start with `docs/ARCHITECTURE.md` for structure, services, and data flow diagrams.
