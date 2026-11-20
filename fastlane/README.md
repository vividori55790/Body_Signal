# Fastlane & F-Droid Release Metadata Checklist

All store metadata and release notes follow the F-Droid reproducible release layout under `fastlane/metadata/android/`:

- `en-US/title.txt`, `short_description.txt`, `full_description.txt`, `images/icon.png`
- `ko-KR/title.txt`, `short_description.txt`, `full_description.txt`, `images/icon.png`
- Per-version changelogs matching `android/app/build.gradle` `versionCode`:
  - `en-US/changelogs/<versionCode>.txt` (<= 500 characters)
  - `ko-KR/changelogs/<versionCode>.txt` (<= 500 characters)
- Screenshots directory (`en-US/images/phoneScreenshots/`, `ko-KR/images/phoneScreenshots/`):
  - Supply up to 8 PNG/JPEG portrait screenshots (`<= 3840px`) without unmasked clinical personal info before F-Droid store submission.
