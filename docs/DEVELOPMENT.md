# Development

## Run on web
```bash
npm install
npm run start
```
Open `http://localhost:4200/`.

## Run on Android
```bash
npm run build:android
npx cap open android
```
Then use Android Studio to build/run.

## Capacitor sync workflow
- Build web assets: `npm run build`
- Sync to native: `npx cap sync android`
- Open Android Studio: `npx cap open android`

## Debugging tips
- If UI changes aren’t visible on Android, re-run `npm run build:android`.
- If Gradle errors occur, run `gradlew.bat clean` inside `android/`, then rebuild.
- Use `Logcat` in Android Studio for runtime errors.

## Adding a new habit type
1) Update the model in `src/app/models/habit.model.ts`.
2) Extend `HabitStoreService` logic (create/update/serialize/normalize).
3) Update UI in `src/app/pages/dashboard/dashboard.component.ts` and `src/app/pages/habits/habits.component.ts`.
4) If timers are involved, update `TimerService`.
5) Add migration logic if needed (TODO: define migration policy).

## Adding a new page/module
1) Create a standalone component in `src/app/pages/<page>/<page>.component.ts`.
2) Add a route in `src/app/app.routes.ts`.
3) Update the nav UI if needed (`src/app/app.html`).

## Safe refactors without breaking storage
- Keep `PersistedState.schemaVersion` consistent or introduce a migration step (TODO).
- Avoid renaming storage keys without migration.
- Prefer additive changes: new fields with defaults.
