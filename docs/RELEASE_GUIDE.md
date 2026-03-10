# Release guide (Android)

## Versioning rules
In `android/app/build.gradle`:
- `versionCode`: increment every release (integer)
- `versionName`: user-visible version (e.g., `"1.0"`)

App id (package name) from `capacitor.config.ts` / Gradle:
- `appId`: `com.giri.levelup`

## Build release AAB
1) Build web assets:
   ```bash
   npm run build
   npx cap sync android
   ```
2) Open Android Studio:
   ```bash
   npx cap open android
   ```
3) Android Studio: **Build > Generate Signed Bundle / APK...**
4) Choose **Android App Bundle** and configure signing.

CLI alternative (requires signing config in Gradle):
```bash
cd android
gradlew.bat bundleRelease
```

## Keystore guidance
- Do not store keystores or passwords in the repo.
- Keep a secure backup of the keystore and credentials.
- Use Gradle signing configs or Android Studio signing settings.

## Play Console upload checklist
- AAB generated and signed
- VersionCode incremented
- App details and privacy policy filled
- Screenshots, icon, and feature graphic uploaded
- Target audience and content rating completed

## Common Play Console errors
- **Package name already exists**: choose a new `applicationId`.
- **Missing testers**: add testers for internal/closed tracks.
- **Identity verification waiting**: wait for Play Console verification to complete.
- **Policy declarations**: complete required forms (data safety, permissions).
