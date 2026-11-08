# Feature Inventory & Codebase Mapping Report (R1 ~ R4)

**Survey Agent**: `survey_feature_modules` (Teamwork Explorer)  
**Date**: 2026-11-07  
**Scope**: Codebase audit and implementation blueprint for R1, R2, R3, and R4 based on 14 user feedback reports (`Feedback_2026-11-06.md`) and `ORIGINAL_REQUEST.md`.

---

## 1. Observations

### 1.1 R1: Authentication, PIN/Keypad, Biometrics & Screen Layout

#### Observation 1.1.1: PIN Setup Screen Bounds & Top Margin Defect
- **Target File**: `body-signal/src/components/PinModal.tsx`
- **Location**: Line 95
- **Direct Code**:
  ```tsx
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md px-4 animate-in fade-in duration-200">
  ```
- **Context File**: `body-signal/src/pages/Settings.tsx` (Lines 689–701)
  - `PinModal` is mounted directly inside the scrolled content container of `SettingsPage` (`<div className="pb-24 pt-4 px-4 max-w-md mx-auto space-y-6">`). It is **not** rendered into a React Portal (`createPortal` on `document.body`).
- **Context File**: `body-signal/src/index.css` (Line 15)
  - `body { padding-top: env(safe-area-inset-top); }`
- **Findings**:
  1. `bg-slate-950/95 backdrop-blur-md` has 95% opacity (5% transparent) with blur. The light background of the Settings screen shines through.
  2. The close button is positioned at `top-6 right-6` without covering the safe-area status bar smoothly.
  3. In contrast, `LockScreen.tsx` (Line 38) replaces the entire view tree at `App.tsx` (Line 23) and uses 100% opaque `bg-slate-950`.

#### Observation 1.1.2: Biometric Authentication (Passkey / Fingerprint / Face)
- **Target Files**:
  - `body-signal/package.json`: No biometric plugin (e.g., `@aparajita/capacitor-biometric-auth` or `@capacitor-community/passkeys`) exists in dependencies.
  - `body-signal/android/app/build.gradle`: No `androidx.biometric:biometric` library in dependencies.
  - `body-signal/src/context/AuthContext.tsx`: Only supports 4-digit PIN stored via `isPinConfigured()`, `verifyAppPin()`, and `setAppPin()`.
  - `body-signal/src/utils/native.ts`: Only contains `Haptics` and `LocalNotifications`.
- **Finding**: Biometric authentication is currently completely unimplemented across both Android native and Web/Capacitor layers.

#### Observation 1.1.3: Keypad UI & Missing Tailwind Spacing Defect
- **Target Files**:
  - `body-signal/src/components/LockScreen.tsx` (Line 84 & Line 96):
    ```tsx
    className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-900/90 text-2xl font-bold border border-slate-800 shadow-md transition-all active:scale-90 active:bg-slate-700 disabled:opacity-30"
    ```
  - `body-signal/src/components/PinModal.tsx` (Line 147 & Line 159):
    ```tsx
    className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-800/80 text-2xl font-bold shadow-sm transition-all hover:bg-slate-700 active:scale-90 active:bg-emerald-500/20 disabled:opacity-40"
    ```
  - `body-signal/tailwind.config.js` (Lines 8–31):
    - No custom `spacing` configuration under `theme.extend`.
- **Findings**:
  1. `h-18` and `w-18` **do not exist** in Tailwind CSS default spacing scales (valid Tailwind scale jumps from `16` [4rem/64px] to `20` [5rem/80px]).
  2. Because the classes are unrecognized, the keypad buttons have no explicit width and height, shrinking directly to the text size (`1`, `2`, `3`), resulting in tiny, deformed, hard-to-tap circular buttons.
  3. Keypad container is clamped at `max-w-[280px]`, causing cramped touch targets.

---

### 1.2 R2: System Environment, Theme Reactivity, Font Scaling & Haptics

#### Observation 1.2.1: Real-time System Dark/Light Mode Reactivity
- **Target File**: `body-signal/src/context/SettingsContext.tsx`
- **Location**: Lines 27–45
- **Direct Code**:
  ```tsx
  useEffect(() => {
    loadUserSettings().then((loaded) => {
      setSettings(loaded);
      applyTheme(loaded.theme);
    });
  }, []);

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };
  ```
- **Findings**:
  1. `applyTheme()` checks `window.matchMedia('(prefers-color-scheme: dark)').matches` only once on mount or when settings change.
  2. There is **no event listener** (`mediaQuery.addEventListener('change', ...)`) attached to `window.matchMedia`.
  3. When an Android user pulls down the quick settings shade and toggles Dark/Light mode while the app is running in the foreground, the app fails to receive any notification and remains frozen on the old theme.

#### Observation 1.2.2: System Font Scaling Inheritance
- **Target Files**:
  - `body-signal/android/app/src/main/java/com/bodysignal/app/MainActivity.java`
  - `body-signal/src/index.html` (Line 6): `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />`
  - React components throughout `body-signal/src/`: Multiple components have hardcoded pixel typography classes:
    - `BodyMap.tsx`: `text-[10px]`, `text-[11px]`
    - `CalendarHeatmap.tsx`: `text-[10px]`
    - `AcutePainMode.tsx`: `text-[10px]`, `text-[11px]`
    - `Dashboard.tsx`: `text-[9px]`, `text-[10px]`, `text-[11px]`
    - `ClinicalBriefing.tsx`: `text-[9px]`, `text-[10px]`, `text-[11px]`
- **Findings**:
  1. Capacitor's Android WebView does not automatically synchronize Android system `Configuration.fontScale` with `WebSettings.setTextZoom()`.
  2. Fixed pixel font sizes (`text-[10px]`, `text-[11px]`) override relative scaling (`rem`), preventing elderly and vision-impaired patients from benefiting from Android Accessibility font magnification.

#### Observation 1.2.3: Haptic Feedback Decoupling Defect
- **Target File**: `body-signal/src/utils/native.ts`
- **Location**: Lines 7–16
- **Direct Code**:
  ```tsx
  export async function triggerHaptic(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
    try {
      await Haptics.impact({ style });
    } catch {
      // Graceful fallback for web/desktop
      if ('vibrate' in navigator) {
        navigator.vibrate(15);
      }
    }
  }
  ```
- **Context File**: `body-signal/src/context/SettingsContext.tsx` (Lines 51–53)
  - `settings.hapticsEnabled` is maintained in user settings, but **never passed or checked** inside `triggerHaptic()`.
- **Callers**: Every touch event in `Layout.tsx`, `LockScreen.tsx`, `PinModal.tsx`, `Dashboard.tsx`, `AcutePainMode.tsx`, `QuickPainLogger.tsx`, `EntryForm.tsx` directly calls `triggerHaptic()`.
- **Findings**:
  1. Even if the user turns off the haptic toggle in Settings, `triggerHaptic()` unconditionally invokes `@capacitor/haptics` and `navigator.vibrate(15)`.
  2. There is no check for Android system haptic setting (`Settings.System.HAPTIC_FEEDBACK_ENABLED`).

---

### 1.3 R3: Medication Tracking, Body Map Multi-Selection & Dashboard Redundancy

#### Observation 1.3.1: Medication Tracking & Hardcoded Presets Disconnect
- **Target Files**:
  - `body-signal/src/components/AcutePainMode.tsx` (Lines 16–21 & Lines 297–319):
    ```tsx
    const COMMON_ACUTE_MEDS = [
      '타이레놀(아세트아미노펜)',
      '이부프로펜/소염제',
      '병원 처방 진통제',
      '근육이완제',
    ];
    ```
    - When `tookMed` is selected, it maps strictly over `COMMON_ACUTE_MEDS`. It does not import `useSettings` or read `settings.medicationPresets`.
  - `body-signal/src/components/QuickPainLogger.tsx` (Line 17 & Lines 206–224):
    ```tsx
    const QUICK_MEDS = ['타이레놀', '소염진통제', '처방약', '근이완제'];
    ```
    - Maps strictly over `QUICK_MEDS`, ignoring `settings.medicationPresets`.
  - `body-signal/src/pages/Settings.tsx` (Lines 413–460):
    - The only place where users can register custom medication presets (`settings.medicationPresets`).
- **Findings**:
  1. When a user customizes their prescribed medicines in Settings, neither `AcutePainMode` ("진통제나 약을 드셨나요?") nor `QuickPainLogger` displays them. Only the hardcoded defaults are shown.
  2. Users cannot manage or add medications from the recording flow; they are forced to navigate to the Settings page.

#### Observation 1.3.2: Body Map Single-Selection Constraint
- **Target File**: `body-signal/src/components/BodyMap.tsx`
- **Location**: Lines 4–9, Lines 236–251
- **Direct Code**:
  ```tsx
  interface BodyMapProps {
    selectedPart?: string;
    onSelectPart?: (partLabel: string) => void;
    intensityMap?: Record<string, number>;
    readOnly?: boolean;
  }
  ...
  const handleRegionClick = (region: AnatomicalRegion) => {
    triggerHaptic();
    if (onSelectPart) {
      onSelectPart(region.name);
    }
  };
  ```
- **Target File**: `body-signal/src/types/health.ts` (Lines 4–11):
  ```ts
  export const ConditionSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    bodyPart: z.string().min(1),
    ...
  });
  ```
- **Findings**:
  1. `BodyMap` supports only a single string `selectedPart`. Clicking any region immediately overwrites the previously selected region.
  2. Patients experiencing multisite or radiating pain (e.g., lower back and knee, or neck and shoulder) cannot select multiple anatomical regions simultaneously.

#### Observation 1.3.3: Dashboard Redundant Recording Pathways
- **Target File**: `body-signal/src/pages/Dashboard.tsx`
- **Redundant Entry Points Identified**:
  1. Floating SOS Button (`Layout.tsx`, Line 28): Fixed bottom-right widget triggering `openAcute()`.
  2. Huge Top Banner (`Dashboard.tsx`, Line 313): `🚨 지금 너무 아파요 (1초 급성 통증 기록)` triggering `openAcute()`.
  3. `QuickPainLogger` Card (`Dashboard.tsx`, Line 493): Full inline form with NRS 1–10 + Body part chips + Med chips + 1-tap Save.
  4. Main Action Button (`Dashboard.tsx`, Line 548): `새 증상 및 통증 기록하기` navigating to `/entry`.
  5. Expandable Condition Accordion (`Dashboard.tsx`, Line 155): In each `DetailedConditionCard`, expanding displays an inline log form with datetime, slider, medication, and notes.
- **Findings**:
  - The Dashboard features 5 competing entry points on a single mobile screen, creating visual clutter and user confusion while duplicating functionality.

---

### 1.4 R4: Local AI Offline Handling & Doctor Briefing Screen

#### Observation 1.4.1: Fake Fallback Generation When Local LLM Disconnected
- **Target File**: `body-signal/src/utils/localLlm.ts`
- **Location**: Lines 125–202, Lines 318–322
- **Direct Code**:
  ```ts
  } catch (err: any) {
    console.warn('Local LLM server unavailable or streaming error, using on-device clinical engine fallback:', err);
    const lastUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
    return fallbackClinicalStream(fallbackPromptType, lastUserMsg, fallbackContextText, onChunk);
  }
  ```
- **Direct Code** in `fallbackClinicalStream`:
  ```ts
  simulatedText = `[온디바이스 임상 엔진 분석 리포트]
  🔒 데이터 보호: 외부 서버 전송 없이 100% 기기 내부 로컬 분석

  1. 환자 상태 핵심 요약 (PQRST 원칙):
  - 기록된 통증 데이터와 추세를 분석한 결과, 통증 강도(NRS)의 변동 폭이 지속적으로 모니터링되고 있습니다.
  ...`;
  ```
- **Findings**:
  1. When the local LLM server is not running or disabled, `streamChatCompletions()` catches the error and silently triggers `fallbackClinicalStream()`.
  2. It streams a canned, 80-line hardcoded Korean simulation token-by-token (using `setTimeout(r, 12)`).
  3. This deceives users into believing the offline AI is functioning, generating context-insensitive boilerplate medical text.

#### Observation 1.4.2: Doctor Briefing Clipboard Dependence & Lack of Department Grouping
- **Target File**: `body-signal/src/pages/ClinicalBriefing.tsx`
- **Location**: Lines 221–260, Lines 500–700
- **Direct Code**:
  - Top action is "전자의무기록(EMR) 즉시 복사" (Hospital EMR Integration) with buttons for `일반 EMR 양식` and `SOAP Note 양식`.
  - Conditions list:
    ```tsx
    {briefing.conditionsSummary.map((item) => ...)}
    ```
- **Findings**:
  1. The existing screen is designed around copying text to clipboard, which is impractical for in-person medical consultations where the patient shows their smartphone to the physician.
  2. Conditions and symptoms are presented in a flat chronological array without medical department/specialty categorization (e.g., 정형외과/신경외과 for spine & joints, 내과/소화기내과 for abdominal symptoms, 신경과 for headaches).
  3. Physicians must hunt through unrelated conditions rather than seeing a department-focused briefing during a rapid 30-second consultation.

---

## 2. Logic Chain

1. **R1 Top Margin & Screen Bounds Logic**:
   - *Observation 1.1.1* confirms that `PinModal.tsx` uses `bg-slate-950/95 backdrop-blur-md` and is rendered inline inside the scrolled layout of `SettingsPage`.
   - In contrast, *Observation 1.1.1* demonstrates that `LockScreen.tsx` uses solid `bg-slate-950` and completely unmounts the underlying app content.
   - Therefore, the visual glitch where the previous screen is visible above/through the PIN setup screen is caused by the 95% translucency and inline DOM positioning under `body { padding-top: env(safe-area-inset-top) }`.
   - **Remedy**: Mount `PinModal` via React Portal to `document.body` (or render as a dedicated full-screen overlay), enforce 100% solid opacity (`bg-slate-950`), and configure safe-area top inset covering (`inset-0` with explicit `w-screen h-screen` and status bar background).

2. **R1 Keypad Usability Logic**:
   - *Observation 1.1.3* confirms that `LockScreen.tsx` and `PinModal.tsx` assign classes `h-18 w-18` to keypad buttons.
   - Tailwind CSS does not provide `18` (only 16 and 20).
   - Hence, browsers receive no height or width properties, shrinking buttons down to the size of the single text glyph.
   - **Remedy**: Update button classes to standard Tailwind sizes (e.g. `w-18` replaced by `w-16 h-16` or `w-20 h-20` / `min-w-[64px] min-h-[64px]`), widen the keypad container from `max-w-[280px]` to `max-w-[320px]`, and enhance touch feedback.

3. **R1 Biometric Auth Logic**:
   - *Observation 1.1.2* confirms that no biometric API or Android dependency is present.
   - Modern Android Capacitor applications support native biometric authentication via `androidx.biometric.BiometricPrompt` through a lightweight custom Capacitor plugin or WebAuthn/Passkey credential query (`navigator.credentials.get`).
   - Adding `androidx.biometric:biometric:1.2.0-alpha05` and a native/WebAuthn bridge in `AuthContext` will enable fingerprint/face unlock while preserving PIN as a fallback.

4. **R2 Theme Reactivity Logic**:
   - *Observation 1.2.1* shows `applyTheme()` is called only once in `useEffect` on mount.
   - Without `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', listener)`, runtime OS theme switching never triggers a re-render.
   - **Remedy**: Register an active `change` event listener on `window.matchMedia` and a Capacitor `appStateChange` listener to synchronize the theme instantly without restarting the app.

5. **R2 Font Scale Inheritance Logic**:
   - *Observation 1.2.2* reveals hardcoded pixel font sizes (`text-[10px]`, `text-[11px]`, `text-[9px]`) across multiple core UI components, and absence of `WebSettings.setTextZoom()` integration in Android `MainActivity.java`.
   - Android accessibility scales fonts proportionally to `Configuration.fontScale`.
   - **Remedy**: Synchronize `bridge.getWebView().getSettings().setTextZoom((int)(getResources().getConfiguration().fontScale * 100))` in `MainActivity.java` (including `onConfigurationChanged`), and refactor hardcoded `text-[..px]` to relative Tailwind classes (`text-xs`, `text-sm`) scaling off root `rem`.

6. **R2 Haptic Feedback Logic**:
   - *Observation 1.2.3* proves that `triggerHaptic()` in `native.ts` executes unconditionally, ignoring `settings.hapticsEnabled`.
   - Furthermore, Android's system-level haptic setting is not queried.
   - **Remedy**: Integrate a centralized check in `triggerHaptic()` reading both `settings.hapticsEnabled` and system haptic availability, suppressing vibration globally when disabled.

7. **R3 Medication Data Linking & Management Logic**:
   - *Observation 1.3.1* proves that `AcutePainMode.tsx` and `QuickPainLogger.tsx` use isolated, hardcoded string arrays (`COMMON_ACUTE_MEDS`, `QUICK_MEDS`) and do not access `settings.medicationPresets`.
   - **Remedy**: Connect both components to `useSettings().settings.medicationPresets`, merging default suggestions with registered medications. Add an inline "+ 약 추가" / medication management modal directly in `EntryForm`, `Dashboard`, and `AcutePainMode`.

8. **R3 Body Map Multi-Selection Logic**:
   - *Observation 1.3.2* shows `BodyMap` supports only a single string and overwrites on each tap.
   - Expanding `BodyMapProps` to accept `selectedParts: string[]` and supporting multi-tap toggling will allow patients to select 2 or more anatomical sites in a single symptom log, serializing them cleanly into `Condition.bodyPart` (e.g. joined by commas or array representation).

9. **R3 Dashboard De-duplication Logic**:
   - *Observation 1.3.3* catalogs 5 overlapping recording entry points on the Dashboard.
   - **Remedy**: Consolidate into 3 clear, non-competing tiers:
     - Tier 1: **1-Second Emergency (Acute SOS)**: Unified modal accessible via the floating widget and a refined top emergency card.
     - Tier 2: **3-Second Daily Check-in**: Streamlined `QuickPainLogger` for ongoing chronic tracking.
     - Tier 3: **Comprehensive Clinical Entry**: Full PQRST entry form via `+ 새 증상 기록하기`.
     - Remove redundant inline forms from inside individual condition cards in favor of a clean "기록 추가" action triggering the modal.

10. **R4 Local AI Fallback & Doctor Briefing Screen Logic**:
    - *Observation 1.4.1* establishes that `fallbackClinicalStream()` generates misleading boilerplate when the local LLM is disconnected.
    - Removing fake generation and displaying an explicit "로컬 AI 미연결 / 오프라인" banner with endpoint troubleshooting instructions fulfills Requirement 4.
    - *Observation 1.4.2* shows that `ClinicalBriefing.tsx` is clipboard-focused and lacks clinical categorization.
    - Implementing a dedicated Doctor Briefing View structured by medical specialty (정형외과/신경외과, 내과, 신경과, 기타) with quick filter tabs and high-contrast clinical cards allows doctors to review the patient's condition in 30 seconds without relying on clipboard operations.

---

## 3. Caveats

1. **Local AI Model Availability**:
   - The app connects to local OpenAI-compatible APIs (Ollama, LM Studio) on `http://localhost:11434/v1` or Android emulator host `http://10.0.2.2:11434/v1`. On physical Android devices, `localhost` refers to the mobile device itself, requiring an on-device server or LAN IP if testing against a desktop server.
2. **Biometric Hardware Constraints**:
   - Biometric availability depends on device capabilities (fingerprint sensor, biometric lock enrolled in device settings). Fallback to PIN must always remain functional.
3. **Multi-Region Data Backward Compatibility**:
   - Existing database records store `bodyPart` as a single `string` in IndexedDB. Any multi-selection enhancement must maintain backward compatibility with legacy single-string data (e.g. `'어깨, 목'` format or schema union).

---

## 4. Conclusion & Actionable Implementation Plan

### Architecture Mapping Table

| Requirement | Affected Files | Core Root Cause | Planned Fix Summary |
|---|---|---|---|
| **R1: Screen Bounds** | `src/components/PinModal.tsx`<br>`src/pages/Settings.tsx` | `bg-slate-950/95 backdrop-blur-md` is translucent; mounted inside scrolled layout | Mount via React Portal to `document.body`, 100% solid `bg-slate-950`, safe-area insets |
| **R1: Keypad UI** | `src/components/LockScreen.tsx`<br>`src/components/PinModal.tsx` | Non-existent Tailwind classes `h-18 w-18` shrink buttons to text size | Replace with standard `w-16 h-16` / `w-20 h-20` (64~80px), widen container to 320px |
| **R1: Biometrics** | `src/context/AuthContext.tsx`<br>`src/components/LockScreen.tsx`<br>`android/.../MainActivity.java` | Zero biometric code or dependencies exist | Integrate `androidx.biometric.BiometricPrompt` & WebAuthn, add biometric unlock toggle |
| **R2: Theme Reactivity** | `src/context/SettingsContext.tsx` | No `matchMedia.addEventListener('change')` | Attach real-time `change` listener to `(prefers-color-scheme: dark)` |
| **R2: Font Scaling** | `android/.../MainActivity.java`<br>`src/index.css`<br>Components | WebView `textZoom` not synced; hardcoded `text-[..px]` | Sync `Configuration.fontScale` with WebView `textZoom`, convert hardcoded px to rem |
| **R2: Haptic 연동** | `src/utils/native.ts`<br>`src/context/SettingsContext.tsx` | `triggerHaptic()` bypasses `settings.hapticsEnabled` | Add global enabled check in `triggerHaptic()`, suppress vibration when disabled |
| **R3: Medication Data** | `src/components/AcutePainMode.tsx`<br>`src/components/QuickPainLogger.tsx` | Hardcoded `COMMON_ACUTE_MEDS` ignoring `settings.medicationPresets` | Connect to `useSettings().settings.medicationPresets`, merge custom medicines |
| **R3: Medication CRUD** | `src/pages/EntryForm.tsx`<br>`src/pages/Dashboard.tsx` | Only manageable in Settings | Add inline "+ 약 추가" modal/sheet directly in EntryForm and Dashboard |
| **R3: Body Map Multi** | `src/components/BodyMap.tsx`<br>`src/pages/EntryForm.tsx` | `selectedPart?: string` only allows single tap selection | Support `selectedParts: string[]`, multi-tap toggle, serialize to comma-separated/array |
| **R3: Dashboard Redundancy** | `src/pages/Dashboard.tsx` | 5 competing entry points clutter UI | Harmonize into 3 distinct tiers: 1-sec SOS, 3-sec Quick Check, Full PQRST Entry |
| **R4: AI Fallback** | `src/utils/localLlm.ts` | `fallbackClinicalStream` streams canned fake AI text | Remove fake simulator; return clear offline state with troubleshooting guidance |
| **R4: Doctor Briefing** | `src/pages/ClinicalBriefing.tsx` | Flat cards + clipboard copy reliance | Add Department Categorization (정형외과, 내과, 신경과), 30-sec Doctor View |

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Lint and Type Check**:
   ```powershell
   cd c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\body-signal
   npm run lint
   npx tsc --noEmit
   ```
2. **Build Web Assets**:
   ```powershell
   npm run build
   ```
3. **Run Existing Automated Tests**:
   ```powershell
   npm run test:data
   npm run test:r2
   npm run test
   ```
4. **Capacitor Sync & Android Build**:
   ```powershell
   npx cap sync android
   cd android
   .\gradlew assembleDebug
   ```

### 5.2 Verification Checklist
- [ ] Open PIN setup modal in Settings: Verify no top gap, no previous screen visible through translucent blur.
- [ ] Inspect LockScreen and PinModal: Verify keypad buttons are properly sized (64dp+), aesthetically rounded, and responsive.
- [ ] Toggle Android system dark mode in notification shade: Verify app immediately flips between dark and light themes without restart.
- [ ] Adjust Android system font size in Settings: Verify app typography scales proportionately.
- [ ] Disable haptics in app settings: Verify zero vibration occurs on any button tap or navigation.
- [ ] Add custom medication in settings or inline: Verify it immediately appears in "약을 먹었나요" and quick logger.
- [ ] In Body Map: Verify selecting multiple parts (e.g. 목 and 어깨) selects both and saves both in the entry.
- [ ] Disconnect local LLM: Verify app clearly indicates offline/disconnected status rather than generating fake text.
- [ ] In Clinical Briefing: Verify symptoms are cleanly categorized under medical specialties (정형외과, 내과, etc.) with dedicated Doctor View.
- [ ] Build output: Verify `android/app/build/outputs/apk/debug/app-debug.apk` builds successfully with 0 errors.
