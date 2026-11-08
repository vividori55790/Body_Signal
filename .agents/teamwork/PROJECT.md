# Project: Bignal Mobile Feedback Implementation & Production Enhancement

## Architecture
- **Application Platform**: Hybrid Mobile Application built with React 19 + TypeScript + Vite 7 + TailwindCSS 3, integrated into Android via Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/haptics`, `@capacitor/local-notifications`).
- **Android Native Container**: Android SDK 34 (`compileSdkVersion = 34`, `targetSdkVersion = 34`, `minSdkVersion = 24`), AGP 8.13.0, Gradle 8.14.3, Java 17 (`C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot`), Android SDK at `C:\Users\vivid\AppData\Local\Android\Sdk`.
- **Module Boundaries & Data Flow**:
  1. **Authentication & Security (`src/context/AuthContext.tsx`, `src/components/PinModal.tsx`, `src/components/LockScreen.tsx`)**:
     - Manages app lock state, PBKDF2/salted PIN verification, biometric/passkey credential integration, auto-lock timeouts, and background privacy curtain (`FLAG_SECURE`).
     - Renders full-screen solid portals to eliminate background bleeding.
  2. **System Environment & Accessibility (`src/context/SettingsContext.tsx`, `src/utils/native.ts`, `android/.../MainActivity.java`)**:
     - Listens reactively to `(prefers-color-scheme: dark)` changes for instant theme synchronization.
     - Bridges Android OS `Configuration.fontScale` to WebView `WebSettings.setTextZoom()` on resume and configuration change.
     - Centralizes haptic execution through a guarded vibration policy that strictly honors both app settings and OS vibration toggles.
  3. **Medication & Symptom Records (`src/context/HealthContext.tsx`, `src/components/BodyMap.tsx`, `src/components/AcutePainMode.tsx`, `src/components/QuickPainLogger.tsx`, `src/pages/EntryForm.tsx`, `src/pages/Dashboard.tsx`)**:
     - Preserves AES-GCM 256 on-device encryption and chained SHA-256 integrity signatures in IndexedDB.
     - Connects user-defined medication presets dynamically to prompt dialogs.
     - Supports inline addition/management of medications without visiting Settings.
     - Extends `BodyMap` to multi-region selection (selecting ≥2 anatomical regions simultaneously).
     - Streamlines Dashboard into 3 distinct operational tiers (1-Sec SOS, 3-Sec Chronic Log, Full PQRST Entry).
  4. **Local AI & Clinical Presentation (`src/utils/localLlm.ts`, `src/pages/ClinicalBriefing.tsx`)**:
     - Guards local AI streaming: suppresses deceptive simulated fallback text when disconnected; returns unambiguous offline status banners and connection recovery guidance.
     - Restructures Clinical Briefing into a high-visibility, 30-second on-screen presentation grouped by medical specialties (정형외과/재활의학과, 신경과/신경외과, 소화기내과, 일반내과/기타).
  5. **Android Build & Deliverables (`body-signal/android/`, `build_apk_local.ps1`)**:
     - Automated compilation: `npm run build` -> `npx cap sync android` -> `.\gradlew.bat assembleDebug`.
     - Output deliverable: `body-signal/android/app/build/outputs/apk/debug/app-debug.apk` and root official deliverable `Bignal-v0.1.0-debug.apk`.

---

## Feature Inventory
Every feature from the Survey phase appears here with its assigned milestone. No feature is left unassigned.

| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|:------:|
| 1 | F1. Full-Bleed PIN Setup Modal | PIN setup/change view fills 100% viewport with solid 100% opacity, portal mounting, safe-area covering | M1 | Feedback #1, `PinModal.tsx:95` | **DONE** |
| 2 | F2. Biometric Passkey Unlock | Support fingerprint and facial recognition unlocking alongside PIN, with Settings toggle | M1 | Feedback #2, `AuthContext.tsx` | **DONE** |
| 3 | F3. Ergonomic Keypad Redesign | Enlarge keypad buttons to ≥64dp (valid Tailwind sizing), layout width ≥320px, tactile feedback | M1 | Feedback #3, `LockScreen.tsx:77` | **DONE** |
| 4 | F4. Real-Time Dynamic Theme Sync | Instant CSS `.dark` theme toggle on OS dark/light mode change via `matchMedia` change listener | M2 | Feedback #4, `SettingsContext.tsx:34` | **DONE** |
| 5 | F5. Dynamic Medication Prompt Linking | Populate 'Did you take meds?' prompt with user's actual registered medication presets | M3 | Feedback #5, `AcutePainMode.tsx:16` | **DONE** |
| 6 | F6. In-Flow Medication Management | Add/edit medication presets directly in logging dialogs and dashboard without visiting Settings | M3 | Feedback #6, `Settings.tsx:43` | **DONE** |
| 7 | F7. System Font Scale Inheritance | Sync Android `Configuration.fontScale` with WebView `textZoom`, enforce accessible relative typography | M2 | Feedback #7, `MainActivity.java` | **DONE** |
| 8 | F8. Standard Symptom Logging Stability | Preserve full stability, validation, and encrypted integrity of general symptom entry (`EntryForm.tsx`) | M3 | Feedback #8, `EntryForm.tsx` | **DONE** |
| 9 | F9. Dashboard Entry Streamlining | Rationalize dashboard into 3 distinct non-competing tiers, eliminating redundant duplicate forms | M3 | Feedback #9, `Dashboard.tsx:311` | **DONE** |
| 10 | F10. Multi-Region Body Map Selection | Support selecting ≥2 anatomical regions simultaneously for composite symptom logging | M3 | Feedback #10, `BodyMap.tsx:4` | **DONE** |
| 11 | F11. Local AI Disconnection Guard | Suppress fake simulated fallback tokens when offline; display clear offline banner and connection guide | M4 | Feedback #11, `localLlm.ts:125` | PLANNED |
| 12 | F12. Department-Categorized Briefing | Dedicated 30-sec doctor briefing screen grouping symptoms into clinical departments on-screen | M4 | Feedback #12, `ClinicalBriefing.tsx` | PLANNED |
| 13 | F13. System-Linked Haptics Enforcement | Centralize haptic guard checking `settings.hapticsEnabled` & system settings, eliminating unwanted vibration | M2 | Feedback #13, `native.ts:7` | **DONE** |
| 14 | F14. Android SDK 34 Compliance & APK Rebuild | Adhere to Android 14 standards and successfully build official release/debug APK deliverable | M5 | Feedback #14, Gradle pipeline | PLANNED |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|:------:|
| M1 | Authentication & Keypad UI Enhancement | F1 (Full-Bleed PIN Portal), F2 (Biometric Passkey Unlock), F3 (Ergonomic Keypad Redesign) | None | **DONE** |
| M2 | System Environment & Accessibility Integration | F4 (Real-Time Theme Sync), F7 (System Font Scale Inheritance), F13 (Guarded Haptics & Vibration Elimination) | None | **DONE** |
| M3 | Medication Management, BodyMap Multi-Selection & Dashboard Optimization | F5 (Custom Medication Prompt Linking), F6 (In-Flow Medication CRUD), F8 (Symptom Logging Stability), F9 (Dashboard Streamlining), F10 (Multi-Region BodyMap) | M1, M2 | **DONE** |
| M4 | Local AI Offline Guard & Doctor-Facing Clinical Briefing | F11 (Local AI Disconnection Guard), F12 (Medical Department-Categorized 30-Sec Doctor Briefing) | M3 | IN_PROGRESS |
| M5 | Final Integration, 100% E2E Verification & Official Release APK Build | F14 (Android SDK 34 Compliance, 100% E2E Test Suite Pass [Tiers 1-4], Tier 5 Adversarial Coverage Hardening, Official APK Build) | M1, M2, M3, M4 | PLANNED |

---

## Interface Contracts

### 1. Auth & Biometrics ↔ UI Components
- **File**: `body-signal/src/context/AuthContext.tsx`
- **Functions & Signatures**:
  - `isBiometricAvailable: boolean`
  - `isBiometricEnabled: boolean`
  - `toggleBiometric(enable: boolean): Promise<boolean>`
  - `unlockWithBiometric(): Promise<boolean>`
  - `unlockWithPin(pin: string): Promise<boolean>`
- **Status**: IMPLEMENTED & VERIFIED (Gate PASS)

### 2. Settings & System ↔ Native Utilities
- **File**: `body-signal/src/utils/native.ts`
- **Functions & Signatures**:
  - `setHapticsEnabled(enabled: boolean): void`
  - `triggerHaptic(style?: ImpactStyle): Promise<void>`
- **Behavior**: If `hapticsEnabled` is `false`, `triggerHaptic()` returns immediately without invoking Capacitor Haptics or `navigator.vibrate`.
- **File**: `body-signal/android/app/src/main/java/com/bodysignal/app/MainActivity.java`
- **Hook**: On `onResume` and `onConfigurationChanged`, executes `applyFontScale()` setting `getBridge().getWebView().getSettings().setTextZoom((int)(fontScale * 100))`.

### 3. BodyMap ↔ Symptom Logging
- **File**: `body-signal/src/components/BodyMap.tsx`
- **Props**:
  - `selectedParts: string[]` (supports multi-region selection)
  - `onTogglePart: (partLabel: string) => void`
  - `selectedPart?: string` (backward-compatible legacy single selection)
  - `onSelectPart?: (partLabel: string) => void`
- **Data Persistence**: Multiple selected parts stored as comma-separated string in `Condition.bodyPart` (e.g. `"머리/안면, 목(앞)"`) ensuring 100% backward compatibility with existing schemas.

### 4. Medication Presets ↔ Quick Loggers
- **File**: `body-signal/src/context/SettingsContext.tsx`
- **Exports**: `settings.medicationPresets: MedicationPreset[]`, `addMedicationPreset(name: string, dosage?: string): Promise<void>`
- **Consumers**: `AcutePainMode.tsx`, `QuickPainLogger.tsx`, `EntryForm.tsx` read `settings.medicationPresets` directly and expose inline "+ 약 추가" creation.

### 5. Local AI Engine ↔ Clinical UI
- **File**: `body-signal/src/utils/localLlm.ts`
- **Function**:
  - `streamChatCompletions(options: StreamOptions): Promise<StreamResult>`
- **Behavior**: If server endpoint is unreachable or `settings.localLlm.enabled` is `false`, rejects with explicit `LocalLlmOfflineError`. No simulated/fake AI fallback tokens are emitted.

### 6. Clinical Briefing ↔ Medical Department Classifier
- **File**: `body-signal/src/utils/clinicalDepartments.ts`
- **Function**:
  - `categorizeByDepartment(conditions: Condition[], logs: PainLog[]): DepartmentBriefingGroup[]`
- **Departments**:
  - `정형외과 / 재활의학과` (Spine, Joint, Extremity pain)
  - `신경과 / 신경외과` (Headache, Neuropathy, Radiating pain)
  - `소화기내과` (Abdominal pain, Gastrointestinal)
  - `일반내과 / 기타 진료과` (Systemic, Unclassified conditions)

---

## Code Layout & Exclusive Write Boundaries

| Milestone | Exclusive File Ownership | Read-Only References |
|---|---|---|
| **M1: Auth & UI** | `body-signal/src/components/PinModal.tsx`<br>`body-signal/src/components/LockScreen.tsx`<br>`body-signal/src/context/AuthContext.tsx`<br>`body-signal/src/utils/biometrics.ts`<br>`body-signal/src/pages/Settings.tsx` (auth section) | `pin.ts`, `crypto.ts`, `storage.ts` |
| **M2: System & A11y** | `body-signal/src/context/SettingsContext.tsx`<br>`body-signal/src/utils/native.ts`<br>`body-signal/android/app/src/main/java/com/bodysignal/app/MainActivity.java`<br>`body-signal/src/index.css`<br>`body-signal/tailwind.config.js` | `AndroidManifest.xml` |
| **M3: Med & Symptoms** | `body-signal/src/components/BodyMap.tsx`<br>`body-signal/src/components/AcutePainMode.tsx`<br>`body-signal/src/components/QuickPainLogger.tsx`<br>`body-signal/src/pages/EntryForm.tsx`<br>`body-signal/src/pages/Dashboard.tsx`<br>`body-signal/src/types/health.ts` | `HealthContext.tsx`, `storage.ts` |
| **M4: AI & Briefing** | `body-signal/src/utils/localLlm.ts`<br>`body-signal/src/utils/clinicalDepartments.ts`<br>`body-signal/src/pages/ClinicalBriefing.tsx` | `HealthContext.tsx`, `SettingsContext.tsx` |
| **M5: Integration & APK** | `body-signal/build_apk_local.ps1`<br>`build_apk.ps1`<br>`body-signal/android/app/build.gradle`<br>Root deliverable APK | Entire codebase & test suites |
| **E2E Testing Track** | `body-signal/test/` (E2E test suites)<br>`TEST_INFRA.md`<br>`TEST_READY.md` | Opaque-box requirements only |
