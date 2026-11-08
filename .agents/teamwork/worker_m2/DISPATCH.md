# Task Assignment: Worker Milestone 2 (R2 System Environment & Accessibility Integration)

**Working Directory**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m2`
**Identity**: `worker_m2` (Type: `teamwork_worker`)
**Parent**: Top-level Project Orchestrator (`c0c096b2-e043-4359-9001-d946fccdf4ac`)

## Objective
Implement Milestone 2 (Features F4, F7, F13) for Bignal mobile application based on the comprehensive findings of the Survey Explorers and `PROJECT.md § Interface Contracts`.

## Exclusive Write Ownership
You own and may ONLY edit or create the following files:
1. `body-signal/src/context/SettingsContext.tsx`
2. `body-signal/src/utils/native.ts`
3. `body-signal/android/app/src/main/java/com/bodysignal/app/MainActivity.java`
4. `body-signal/src/index.css`
5. `body-signal/tailwind.config.js`

DO NOT touch any files outside this list (e.g. M1 files or M3 files).

## Background & Specifications to Read
1. `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\PROJECT.md`
3. `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_survey_arch\handoff.md`
4. `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_survey_features\handoff.md`

## Implementation Tasks

### F4: Real-Time Dynamic Theme Sync (`SettingsContext.tsx`)
- In `SettingsContext.tsx`, register a persistent listener on `window.matchMedia('(prefers-color-scheme: dark)')`.
- When the system dark mode state changes while `settings.theme === 'system'`, immediately apply the new theme to `document.documentElement` (`.dark` class toggle) without app restart.
- Clean up listener on unmount.

### F7: System Font Scale Inheritance (`MainActivity.java`, `index.css`, `tailwind.config.js`)
- In `MainActivity.java`:
  - Override `onResume()` and `onConfigurationChanged(Configuration newConfig)`.
  - Implement `applyFontScale()`:
    ```java
    private void applyFontScale() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            float fontScale = getResources().getConfiguration().fontScale;
            getBridge().getWebView().getSettings().setTextZoom((int)(fontScale * 100));
        }
    }
    ```
- In CSS & styling: ensure base typography scales fluidly with root `rem` and layouts do not clip or overflow when scaled.

### F13: System-Linked Haptics Enforcement (`native.ts`, `SettingsContext.tsx`)
- In `native.ts`:
  - Maintain a module-level `hapticsEnabledState` (default true).
  - Export `setHapticsEnabled(enabled: boolean)`.
  - In `triggerHaptic()`, check `if (!hapticsEnabledState) return;` before invoking `Haptics.impact` or `navigator.vibrate`.
- In `SettingsContext.tsx`:
  - Call `setHapticsEnabled(settings.hapticsEnabled)` upon settings load and whenever `settings.hapticsEnabled` changes.
  - When disabled, ensure 0 vibrations fire across the entire app.

## Verification Requirements
Worker MUST run:
1. `npm --prefix body-signal run build`
2. `node body-signal/test/run-feedback-tests.mjs --feature F4`
3. `node body-signal/test/run-feedback-tests.mjs --feature F7`
4. `node body-signal/test/run-feedback-tests.mjs --feature F13`
5. `npm --prefix body-signal test` (all tests pass)

## Output Requirements
Write your handoff report to `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m2\handoff.md` and notify parent via `send_message`.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.


## 2026-11-07T03:04:02Z
[Message] timestamp=2026-11-07T03:04:02Z sender=c0c096b2-e043-4359-9001-d946fccdf4ac priority=MESSAGE_PRIORITY_HIGH
Task assignment received: Implement Milestone 2 (F4, F7, F13).


## 2026-11-07T03:15:53Z
[Message] timestamp=2026-11-07T03:15:53Z sender=c0c096b2-e043-4359-9001-d946fccdf4ac priority=MESSAGE_PRIORITY_HIGH
Context: Milestone 2 Implementation (F4, F7, F13)
Content: Status check. What is your current progress on implementing F4 (Real-time dynamic theme sync), F7 (System font scale inheritance), and F13 (Guarded haptics)?
Action: Please provide a brief status update or finalize implementation, execute builds/tests, and write handoff.md.
