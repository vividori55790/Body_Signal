# F-Droid release preparation

This directory contains the metadata draft for `com.bodysignal.app`.

The phone-installable artifact is produced by the `Android APK Build`
workflow as `body-signal-release-apk-signed`. The F-Droid verification
workflow intentionally produces a separate unsigned artifact; unsigned APKs
are not expected to install directly on Android.

The Capacitor web bundle under `android/app/src/main/assets/public` is
versioned intentionally. F-Droid builds must not download npm dependencies or
run a network-dependent web build; the checked-in bundle lets Gradle build the
Android artifact from the tagged source tree.

## Required release process

1. Create a public Git tag matching the version in the metadata, for example
   `v0.1.0`.
2. Run the source build from a clean checkout with the pinned Gradle wrapper.
3. Confirm that the unsigned release APK is produced at
   `android/app/build/outputs/apk/release/app-release-unsigned.apk`.
4. Compare the source-built artifact and verify that no signing key, secret,
   analytics credential, or private service configuration is included.
5. Submit the metadata file to the
   [F-Droid data repository](https://gitlab.com/fdroid/fdroiddata) after the
   clean checkout build succeeds.

F-Droid signs the application. Do not commit a keystore or upload a
developer-signed APK. The CI-signed APK is for personal testing only: its
ephemeral key is not suitable for upgrades or public distribution.
