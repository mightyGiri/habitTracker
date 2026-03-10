# Level-Up Habit Tracker

Level-Up is a habit tracking app focused on daily momentum: complete habits, build streaks, earn XP, and level up. It runs as an Angular web app and ships to Android via Capacitor.

The app centers around a "Today" flow with habit completion, streak status, insights, and timer-based habits (e.g., Meditation). All data is stored locally for offline-first use.

For deeper docs, see `docs/README.md`.

## Features
- Daily habits list with completion and skip logic
- Streak tracking, XP, and level progression
- Insights charts (monthly totals, completion trends, top habits)
- Timer-based habits (Meditation timer)
- Local notifications (Android, via Capacitor)
- Backup/export (JSON/CSV/XLSX)
- Theme and personalization settings

## Tech stack
- Angular 20 + RxJS
- Angular Material UI
- Capacitor (Android)
- Chart.js
- IndexedDB via `idb` (with localStorage fallback)

## Quick start
```bash
npm install
npm run start
```
Open `http://localhost:4200/`.

## Run on Android (Capacitor)
```bash
npm run build:android
npx cap open android
```
Then build/run from Android Studio.

## Environment requirements
- Node.js + npm (TODO: confirm required versions)
- Android Studio (for Android builds)
- JDK + Android SDK (TODO: confirm required versions)

## Folder structure
See `docs/ARCHITECTURE.md` for the structure and responsibilities.

## Release build (AAB)
```bash
npm run build:android
cd android
gradlew.bat bundleRelease
```
See `docs/RELEASE_GUIDE.md` for signing and Play Console steps.

## Troubleshooting
- Android Gradle sync errors: run `npx cap sync android`, then sync in Android Studio.
- Stale Android build: `cd android` then `gradlew.bat clean` and rebuild.
- Web assets not updated: re-run `npm run build` or `npm run build:android`.
