# F-Droid release preparation

This directory contains the metadata for `com.bodysignal.app` under `GPL-3.0-only`.

The phone-installable artifact for local testing is produced by the `Android APK Build`
workflow as `body-signal-release-apk-signed`. The F-Droid verification
workflow produces a separate unsigned artifact (`body-signal-fdroid-release-unsigned`);
unsigned APKs are not expected to install directly on Android because F-Droid signs
official releases with its own signing key.

## Reproducible source build policy

F-Droid builds everything from the tagged source checkout and rejects prebuilt
`.apk` binaries or pre-bundled minified JS artifacts committed in Git.

During the F-Droid `prebuild` phase:
1. Run `npm ci` inside `body-signal/`.
2. Run `npm run build` to generate `dist/` from TypeScript/React sources.
3. Run `npx cap sync android` to copy the freshly built web assets into `android/app/src/main/assets/public`.
4. Build `android/app` with Gradle (`assembleRelease`) to output `app-release-unsigned.apk`.

## Required release process

1. Ensure no `.apk` binaries or `android/app/src/main/assets/public` build artifacts are tracked in Git.
2. Create a public Git tag matching `versionName` in metadata (e.g., `v1.1.0`).
3. Verify the clean-checkout build succeeds via `.github/workflows/fdroid-release.yml`.
4. Confirm that no signing key, analytics SDK, proprietary Google Play Services / GMS plugin, or plaintext cleartext network loophole is present.
5. Submit `fdroid/metadata/com.bodysignal.app.yml` to the
   [F-Droid data repository](https://gitlab.com/fdroid/fdroiddata).
