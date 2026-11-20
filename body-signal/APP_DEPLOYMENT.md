# Build & Deployment Guide (Capacitor + Android)

Body Signal builds as a 100% self-contained Android APK via **Capacitor** and **Gradle** (or as an offline-capable PWA via Vite).

## 1. Build Web Assets & Sync Android

Run from `body-signal/`:

```bash
npm ci
npm run build
npx cap sync android
```

## 2. Build Android APKs via Gradle

Run from `body-signal/android/`:

```bash
# Debug APK (outputs to android/app/build/outputs/apk/debug/)
./gradlew assembleDebug

# Release APK with R8 shrinking (outputs to android/app/build/outputs/apk/release/)
./gradlew assembleRelease
```

On Windows PowerShell:

```powershell
.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
```

## 3. Reproducible Release & F-Droid Alignment

- App ID: `com.bodysignal.app`
- Current version: `2.2.0` (`versionCode 11`) across `body-signal/package.json`, `body-signal/android/app/build.gradle`, and `body-signal/fdroid/metadata/com.bodysignal.app.yml`.
- Fastlane store metadata & changelogs live in `fastlane/metadata/android/{en-US,ko-KR}`.
- Automated GitHub release workflow: `.github/workflows/fdroid-release.yml`.
