# Specification Mining Report: 14 User Feedback Items & Technical Specification

**Author**: `survey_spec_miner` (Specification Miner)  
**Date**: 2026-11-07  
**Working Directory**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\spec_miner_survey`  
**Reference Document**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\body-signal\user_feedback\Feedback_2026-11-06.md`  
**Parent Orchestrator**: `c0c096b2-e043-4359-9001-d946fccdf4ac`  

---

## Executive Summary

This report establishes the authoritative specification analysis for the 14 user feedback items received on 2026-11-06 for the Bignal (Body Signal) mobile application. Through exhaustive inspection of the existing React + TypeScript + Capacitor Android codebase, this document bridges user feedback, technical root causes, accessibility demands, and Android SDK standards into an actionable blueprint for downstream architecture, implementation, and test tiers.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1. Auth & UI | Full-Bleed PIN Setup Screen | PIN creation and change screens fill 100% of the mobile viewport with zero transparency, top gap, or background bleed-through | Tap "PIN 설정" or "PIN 변경" from Settings | Full-screen opaque modal covering status bar & safe area insets | Closes on X/Cancel; resets input state cleanly | `Feedback_2026-11-06.md` #1, `PinModal.tsx:95` |
| 2 | R1. Auth & UI | Biometric Passkey Authentication | Support fingerprint and facial recognition unlocking alongside traditional 4-digit PIN | Biometric sensor touch/scan or Biometric toggle in Settings | App unlocked; encryption session key restored without typing PIN | On biometric fail/cancel, gracefully fallback to PIN entry | `Feedback_2026-11-06.md` #2, `AuthContext.tsx`, `LockScreen.tsx` |
| 3 | R1. Auth & UI | Ergonomic Keypad Redesign | Enlarge keypad buttons (≥64-72dp touch targets), expand keypad width to 320-340px, and improve visual styling | Numerical touch inputs (0-9, Backspace) | Instant visual button press animation, clear PIN dot progress | Disable inputs during lockout cooldown timer | `Feedback_2026-11-06.md` #3, `PinModal.tsx:140`, `LockScreen.tsx:77` |
| 4 | R2. System & A11y | Real-Time Dynamic Theme Sync | Immediately follow Android system dark/light mode toggle while app is running in the foreground | OS system theme toggle (`prefers-color-scheme`) | Instant CSS theme swap (`html.dark` class toggle) without app restart | If user explicitly locks theme to Light/Dark in app, honor user setting | `Feedback_2026-11-06.md` #4, `SettingsContext.tsx:27-45` |
| 5 | R3. Med & Symptoms | Dynamic Medication Prompt Integration | Populate "Did you take your medication?" prompt with user's actual registered medication presets instead of hardcoded defaults | Tap "먹었음" (Taken) in acute or quick pain loggers | List of patient's custom medications from `settings.medicationPresets` | If no custom meds exist, offer default suggestions with "+ 직접 추가" option | `Feedback_2026-11-06.md` #5, `AcutePainMode.tsx:16`, `QuickPainLogger.tsx:17` |
| 6 | R3. Med & Symptoms | In-Flow Medication Management | Add and edit medications directly from symptom logging flows and dashboard without navigating to Settings | Tap "+ 약 추가/관리" inside prompt or dedicated Quick Med modal | New medication registered to `medicationPresets` and selected immediately | Validate non-empty name; prevent duplicate entries | `Feedback_2026-11-06.md` #6, `Settings.tsx:43-44` |
| 7 | R2. System & A11y | System Font Scale Inheritance & Legibility | App text dynamically inherits Android system font scale (textZoom) with readable minimum font sizes (no sub-10px micro text) | Android system display setting font size change | Fluid text scaling via `rem` units; no layout clipping or overlap | Long text wraps gracefully with proper line heights | `Feedback_2026-11-06.md` #7, `index.html:6`, `tailwind.config.js` |
| 8 | R3. Med & Symptoms | General Symptom Logging Stability | Preserve full stability and data fidelity of standard symptom entry workflow (PQRST scales, red flags, pain ratings) | Form submission in `EntryForm.tsx` | Encrypted persistence to IndexedDB with SHA-256 integrity signature | Validation errors on missing required fields (date, condition) | `Feedback_2026-11-06.md` #8, `EntryForm.tsx`, `HealthContext.tsx` |
| 9 | R3. Med & Symptoms | Dashboard De-cluttering & Entry Rationalization | Streamline dashboard hierarchy to remove visual noise while preserving rapid 1-sec acute and daily logging access | Dashboard navigation and interaction | Clean card hierarchy, collapsible sections, consolidated quick logger | Empty state illustrations if no logs or conditions exist | `Feedback_2026-11-06.md` #9, `Dashboard.tsx:311-500` |
| 10 | R3. Med & Symptoms | Multi-Region Body Map Selection | Support selecting 2 or more anatomical regions simultaneously for a single symptom entry | Tap multiple anatomical regions on front/back BodyMap SVG | Multiple regions visually highlighted; saved as composite body part | Clicking selected region again deselects it | `Feedback_2026-11-06.md` #10, `BodyMap.tsx:4-9`, `EntryForm.tsx:303` |
| 11 | R4. Local AI & Briefing | Local AI Disconnection Guard & Status Handling | Suppress fake/canned simulated LLM responses when server is offline; display unambiguous offline status banner | Trigger AI analysis or Q&A while server is offline | Explicit warning: "로컬 AI 미연결 상태"; connection retry button | Zero fabricated medical text generated during offline state | `Feedback_2026-11-06.md` #11, `localLlm.ts:125-202, 318` |
| 12 | R4. Local AI & Briefing | Structured Clinical Briefing by Department | Display patient symptoms grouped by medical department (Orthopedics, Neurology, GI, Family Med) directly on-screen for doctors | Navigate to `/briefing` | On-screen clinical presentation card layout sorted by medical specialty | Clear notice if no clinical entries exist | `Feedback_2026-11-06.md` #12, `ClinicalBriefing.tsx:221-350` |
| 13 | R2. System & A11y | System-Linked Haptics Enforcement | Synchronize haptic feedback with Android system vibration settings and respect app-level disable toggle across 100% of UI | Touch tap on any button, keypad, tab, or card | Crisp haptic pulse if enabled in both system and app; strictly 0 vibration if disabled | Silently suppress vibration if unsupported or disabled | `Feedback_2026-11-06.md` #13, `native.ts:7-16`, all components |
| 14 | R5. SDK & Build | Android SDK Standard Compliance & APK Build | Adhere to Android SDK compileSdkVersion 34, targetSdkVersion 34, Edge-to-Edge standards, and generate official APK | Execute automated Android build pipeline | Production debug/release APK at `app/build/outputs/apk/` | Fail fast with explicit logs on compilation or sync errors | `Feedback_2026-11-06.md` #14, `android/app/build.gradle` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| E1 | R1. Full-Bleed PIN | Device with tall display cutout (punch hole / notch) and gesture navigation bar | Screen must extend under system status bar and navigation bar (`viewport-fit=cover`, `env(safe-area-inset-top)`), preventing white/transparent bars |
| E2 | R1. PIN Keypad | Rapid successive tapping of 6 digits within 200ms | Only first 4 digits are accepted; remaining 2 are ignored; lockout counter does not falsely double-count |
| E3 | R1. Biometric Passkey | Biometric sensor unavailable (hardware missing or permission denied) | Gracefully hide or disable biometric button; automatically present PIN keypad with no crash |
| E4 | R1. Biometric Passkey | Patient cancels biometric prompt 3 times consecutively | App remains on LockScreen; PIN keypad remains fully operational |
| E5 | R2. Dynamic Theme | System changes theme from Light to Dark while PIN modal or Acute Pain sheet is open | Entire view, including modal overlays and backdrop, instantly updates colors without closing modal or losing typed digits |
| E6 | R2. Font Scaling | User sets Android font scale to maximum (130%-150% textZoom) | Button text, NRS numbers, and clinical tags must wrap cleanly without truncating or overlapping adjacent elements |
| E7 | R2. Haptic Enforcement | System vibration disabled in Android OS Settings, but app setting `hapticsEnabled` is TRUE | App must detect OS setting or handle zero vibration; no crash, no audible buzzer attempt |
| E8 | R2. Haptic Enforcement | App setting `hapticsEnabled` is FALSE, user furiously taps PIN keypad and Emergency SOS | Exactly zero vibrations triggered across all 100% of interaction surfaces |
| E9 | R3. Medication Prompt | Patient has 0 custom medication presets configured | Fall back to showing standard over-the-counter options (타이레놀, 소염진통제, 처방약) alongside a "+ 직접 추가" button |
| E10 | R3. Medication Prompt | Patient registers medication with special characters (e.g. "탁센 400mg (1일 2회 - 식후)") | Properly stored, displayed in full without truncation, and linked to pain log |
| E11 | R3. Body Map Multi-Select | Patient selects '머리/안면', flips to Back view, and selects '목(뒤)', '왼쪽 어깨' | All 3 regions across both views remain selected, highlighted with badges, and stored as an anatomical set |
| E12 | R3. Body Map Multi-Select | Patient taps already selected '왼쪽 어깨' region again | Region is deselected; remaining 2 regions remain selected |
| E13 | R4. Local AI Guard | Local LLM server endpoint URL is completely invalid or server process is killed | Stream immediately throws connection error; UI presents clear offline badge; ZERO simulated hallucinated tokens generated |
| E14 | R4. Local AI Guard | LLM server drops connection halfway through token streaming | Partial text received so far is retained with an "연결 끊김 (Stream Interrupted)" indicator; no canned fallback injected |
| E15 | R4. Clinical Briefing | Patient has symptoms in only 1 body part (e.g. only '무릎') | Briefing displays single department card (정형외과/재활의학과) cleanly; empty department cards are omitted |
| E16 | R4. Clinical Briefing | Patient has condition with unmapped body part or custom text (e.g. "발톱 주위") | Categorized under "일반내과/기타 진료과" with full clinical metrics preserved |
| E17 | R5. Android APK Build | Build executed on clean environment without global JDK | Script utilizes project toolchain or verified local JDK 17, syncing Capacitor assets without path corruption |

---

## Detailed Feedback Item Analysis & Specification (Items 1 - 14)

### Feedback 1: Full-Bleed PIN Setup Screen
- **Verbatim Text**: `1. 비밀번호 설정하는 화면이 휴대폰 화면에 꽉 차지 않고 위에 조금 비어서 이전 화면이 보여.`
- **Requirement Mapping**: **R1. 인증 및 키패드 UI 개선**
- **Current Defect & Root Cause**:
  In `src/components/PinModal.tsx:95`:
  ```tsx
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md px-4 animate-in fade-in duration-200">
  ```
  1. The container uses `bg-slate-950/95` (semi-transparent 95% opacity), meaning any bright header or content from the underlying screen (e.g. SettingsPage white header) bleeds through.
  2. In `src/index.css:15`, `body` has `padding-top: env(safe-area-inset-top)`. When modals are positioned without viewport bleed, a top status bar gap can expose the prior screen.
- **Specification Requirement**:
  - PIN setup and change screens must use 100% opaque background (`bg-slate-950` in dark mode or solid theme background).
  - Modal must occupy `fixed inset-0 w-screen h-screen min-h-[100dvh]` with top and bottom safe-area insets handled internally (`pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`).
  - Zero background translucency or bleed-through of underlying UI elements under any screen ratio.
- **Acceptance Criteria**:
  - [ ] PIN setup screen covers 100% of the screen from the top status bar edge to the bottom navigation bar.
  - [ ] No underlying page elements or headers are visible through or above the PIN setup view.

---

### Feedback 2: Biometric (Fingerprint / Face ID) Passkey Support
- **Verbatim Text**: `2. 비밀번호 말고 다른 패스키(지문, 얼굴 인식)도 가능하게 해야 해.`
- **Requirement Mapping**: **R1. 인증 및 키패드 UI 개선**
- **Current Defect & Root Cause**:
  `src/context/AuthContext.tsx` and `src/utils/pin.ts` only check a 4-digit numeric PIN against a PBKDF2/salted hash. No biometric credential enrollment or verification exists.
- **Specification Requirement**:
  - Support biometric authentication (Fingerprint / Face recognition) using standard WebAuthn API (`PublicKeyCredential` / `navigator.credentials.create` & `get` with user verification) or Capacitor Biometric Authentication.
  - In `Settings.tsx`: Provide a toggle switch "생체인증(지문/얼굴 인식) 잠금 해제".
  - In `LockScreen.tsx`: If biometrics are enrolled, display a biometric unlock button (with fingerprint icon) and trigger biometric prompt on initial screen appearance.
  - On biometric verification success, restore active authentication session and decrypt IndexedDB data.
  - If biometric verification fails or is canceled, seamlessly allow fallback to 4-digit PIN.
- **Acceptance Criteria**:
  - [ ] Biometric unlock option can be toggled on/off in Settings when PIN is active.
  - [ ] Tapping biometric button invokes Android system biometric prompt (Fingerprint / Face).
  - [ ] Successful biometric scan immediately unlocks the application into Dashboard.
  - [ ] Canceling biometric prompt leaves the PIN keypad responsive and functional.

---

### Feedback 3: Keypad UI & Ergonomics Redesign
- **Verbatim Text**: `3. 비밀번호를 입력하는 키패드가 너무 못생기고 작게 만들어두었어.`
- **Requirement Mapping**: **R1. 인증 및 키패드 UI 개선**
- **Current Defect & Root Cause**:
  `src/components/PinModal.tsx:140` and `src/components/LockScreen.tsx:77` restrict the keypad grid with `max-w-[280px]` and classes `h-18 w-18` (which are non-standard Tailwind values in standard configs, causing sizing fallback). Button tap targets are cramped and visual styling lacks modern medical polish.
- **Specification Requirement**:
  - Keypad container width expanded to `max-w-[320px]` or `max-w-[340px]`.
  - Button sizes enlarged to explicit minimum 68px to 72px (`w-[72px] h-[72px]` or `w-18 h-18` via verified Tailwind sizing), ensuring ergonomic 48dp+ accessibility targets.
  - Visual redesign: Elegant slate-900 circular tiles with high-contrast digits, active press ripple/scale effect (`active:scale-90 active:bg-emerald-500/20`), distinct delete icon tile with haptic response, and beautifully animated PIN dot indicators.
- **Acceptance Criteria**:
  - [ ] Keypad width is at least 320px with touch buttons sized ≥68px.
  - [ ] Buttons provide instant visual feedback on press and conform to Android accessibility target sizes.

---

### Feedback 4: Dynamic Real-Time System Dark/Light Theme Sync
- **Verbatim Text**: `4. 테마가 시스템 설정에 따름으로 해놓아도 다크 모드를 시스템에서 해제하면 라이트모드로 안 따라가. 기존에 앱이 켜져 있어도 바로 따라가는 게 좋을 듯.`
- **Requirement Mapping**: **R2. 시스템 환경 연동 및 접근성 강화**
- **Current Defect & Root Cause**:
  In `src/context/SettingsContext.tsx:27-45`, `applyTheme` is called only once inside `useEffect` on component mount. There is no active listener registered on `window.matchMedia('(prefers-color-scheme: dark)')`.
- **Specification Requirement**:
  - In `SettingsContext.tsx`, register a persistent event listener on `window.matchMedia('(prefers-color-scheme: dark)')`.
  - When the system dark mode state changes while the app is in the foreground and `settings.theme === 'system'`, immediately re-run `applyTheme('system')` to toggle the `.dark` class on `document.documentElement`.
  - Clean up event listener on unmount.
- **Acceptance Criteria**:
  - [ ] When theme is set to 'system', toggling Android OS dark mode instantly updates app colors without restarting the app.

---

### Feedback 5: Custom Medication Linkage in "Did You Take Medication?"
- **Verbatim Text**: `5. 약을 먹었나요를 물어볼 때 먹었다고 하면 뭘 먹었는지 나오는데 내가 설정한 약은 안 나오고 기본값만 출력돼.`
- **Requirement Mapping**: **R3. 복약 관리 및 증상 기록·대시보드 최적화**
- **Current Defect & Root Cause**:
  In `src/components/AcutePainMode.tsx:16-21` and `src/components/QuickPainLogger.tsx:17`, the medication choices shown after selecting "먹었음" (Taken) are hardcoded arrays (`COMMON_ACUTE_MEDS`, `QUICK_MEDS`). They never inspect `settings.medicationPresets`!
- **Specification Requirement**:
  - In `AcutePainMode`, `QuickPainLogger`, and `Dashboard` medication follow-up:
    Retrieve custom medications from `settings.medicationPresets`.
  - Display the patient's custom medications as primary 1-tap options.
  - If the patient has configured no custom meds, display common presets with a "+ 직접 추가" button.
  - When selected, save the exact chosen custom medication name and dosage into the pain log record.
- **Acceptance Criteria**:
  - [ ] User-configured medication presets appear as selectable buttons when answering "약을 먹었나요 -> 먹었음".
  - [ ] Selecting a custom medication correctly assigns that medication string to the saved `PainLog`.

---

### Feedback 6: In-Flow Medication Management Outside Settings
- **Verbatim Text**: `6. 약을 설정에서 관리해야 하는 게 불편해.`
- **Requirement Mapping**: **R3. 복약 관리 및 증상 기록·대시보드 최적화**
- **Current Defect & Root Cause**:
  Currently, adding or deleting medication presets is only possible by navigating into `SettingsPage` -> "복약 프리셋 관리". There is no in-situ creation or management path during daily symptom tracking.
- **Specification Requirement**:
  - Provide inline medication addition in logging views (`AcutePainMode`, `QuickPainLogger`, `EntryForm`, and `Dashboard` medication follow-up card).
  - Add a "+ 약 추가" button next to medication choices that opens a quick modal or inline input field to enter a new drug name and dosage.
  - Saving immediately persists the new drug to `settings.medicationPresets` and pre-selects it for the current log.
  - Optionally provide a quick "복약 관리" drawer/modal accessible from the Dashboard.
- **Acceptance Criteria**:
  - [ ] User can add a new medication preset directly from the symptom logging screen without opening Settings.
  - [ ] Newly added medication is persisted to settings and immediately selected in the current entry.

---

### Feedback 7: System Font Scale Inheritance & Typography Scalability
- **Verbatim Text**: `7. 전체적으로 좋은데, 텍스트 크기 자체가 작고, 환자들이 휴대폰에 설정한 글자 크기를 그대로 앱에서 상속받는지 확인해.`
- **Requirement Mapping**: **R2. 시스템 환경 연동 및 접근성 강화**
- **Current Defect & Root Cause**:
  `index.html` specifies `user-scalable=no, maximum-scale=1.0`. Components use hardcoded micro-typography like `text-[9px]`, `text-[10px]`, which become illegible for elderly patients or patients with visual impairments. Furthermore, WebView textZoom scaling must be verified not to truncate containers.
- **Specification Requirement**:
  - Base typography on fluid `rem` units tied to root HTML font size, allowing Android OS system font scaling (`textZoom` / Accessibility Font Scale) to scale text fluidly.
  - Increase minimum text size floor: replace sub-10px text (`text-[9px]`, `text-[10px]`) with legible sizes (minimum 11px-12px for badges/captions, 14px-16px for body content).
  - Verify that card heights and flex layouts use `min-h` and flexible wrapping so scaled text does not overflow or clip.
- **Acceptance Criteria**:
  - [ ] App text scales up when Android system font size is increased.
  - [ ] No text is cut off or overlaps when rendered under enlarged font scales.

---

### Feedback 8: Stability & Retention of General Symptom Logging
- **Verbatim Text**: `8. 또 일반적인 증상 기록에서는 잘 되네.`
- **Requirement Mapping**: **R3. 복약 관리 및 증상 기록·대시보드 최적화**
- **Current Assessment**:
  User confirmed that standard symptom logging (`src/pages/EntryForm.tsx`) functions well.
- **Specification Requirement**:
  - Maintain full backward compatibility and stability of `EntryForm.tsx`.
  - All existing clinical fields (NRS 1-10 intensity slider, PQRST descriptors, radiation, triggers, relief factors, red flag toggles, onset date, notes, encrypted persistence, SHA-256 audit chaining) must remain fully functional without regression.
- **Acceptance Criteria**:
  - [ ] Standard symptom logging via `EntryForm` continues to create valid, encrypted `Condition` and `PainLog` records.

---

### Feedback 9: Dashboard De-cluttering & Entry Streamlining
- **Verbatim Text**: `9. 전체적으로 대시보드가 번잡하고 기록을 추가할 방법이 너무 많게 설계되어서 중복되어 있어. 하지만 이 부분은 꽤나 유지할 만한 가치가 있어 보여.`
- **Requirement Mapping**: **R3. 복약 관리 및 증상 기록·대시보드 최적화**
- **Current Defect & Root Cause**:
  `src/pages/Dashboard.tsx` currently stacks:
  1. Full-width 1-Sec Acute Pain banner (`🚨 지금 너무 아파요`)
  2. Medication follow-up card
  3. QuickPainLogger component (large embedded 3-second logger)
  4. Clinical briefing banner
  5. Trust badge
  6. Detailed condition cards with embedded inline form inputs
  7. Floating SOS widget from `Layout.tsx`
  This creates visual clutter and redundant entry mechanisms.
- **Specification Requirement**:
  - Rationalize dashboard hierarchy into clean, distinct sections:
    1. **Top Action Zone**: Emergency 1-Sec Acute Pain + Active Medication Follow-up (conditional).
    2. **Patient Status Zone**: 7-day average pain summary + condition cards.
    3. **Quick Entry Zone**: Streamlined Quick Log button/drawer rather than having both full-size QuickPainLogger and inline card forms expanded simultaneously.
  - Condition cards: Make inline logging compact or modular to avoid overwhelming the vertical scroll space.
  - Retain multi-modal entry value (urgent vs routine) without visual chaos.
- **Acceptance Criteria**:
  - [ ] Dashboard layout is organized with clear visual hierarchy and reduced vertical scrolling redundancy.
  - [ ] Both 1-sec acute logging and routine condition logging remain accessible in ≤2 taps.

---

### Feedback 10: Multi-Region Body Map Selection
- **Verbatim Text**: `10. 바디맵을 한번에 한곳만 설정할 수 있어. 한 증상에 여러 바디맵을 골라야 할 수도 있잖아.`
- **Requirement Mapping**: **R3. 복약 관리 및 증상 기록·대시보드 최적화**
- **Current Defect & Root Cause**:
  `src/components/BodyMap.tsx:5-6` only accepts `selectedPart?: string` and invokes `onSelectPart?: (partLabel: string) => void`. Selecting any part overwrites the previous selection.
- **Specification Requirement**:
  - Expand `BodyMap` interface to support multi-selection:
    `selectedParts?: string[]` and `onTogglePart?: (partLabel: string) => void`.
  - Allow users to select multiple anatomical regions across front and back views (e.g. ['목(앞)', '왼쪽 어깨', '등/견갑골']).
  - Render active visual highlight on all selected SVG regions simultaneously.
  - Display selected regions as removable chips above or below the BodyMap.
  - Save multiple regions joined by comma or as an array in `Condition.bodyPart` and `PainLog.bodyPartOverride`.
- **Acceptance Criteria**:
  - [ ] User can tap and select 2 or more distinct anatomical regions on BodyMap.
  - [ ] All selected regions are visually highlighted simultaneously.
  - [ ] Selected regions are saved together into the symptom record.

---

### Feedback 11: Local AI Disconnection Guard & Status Handling
- **Verbatim Text**: `11. 로컬 AI를 연결하지 않아도 답변이 나오는데?`
- **Requirement Mapping**: **R4. 로컬 AI 및 진료브리핑 화면 개편**
- **Current Defect & Root Cause**:
  In `src/utils/localLlm.ts:125-202` and line 321, whenever the local LLM server is unreachable or disabled, `streamChatCompletions` catches the error and silently delegates to `fallbackClinicalStream`, generating fake pre-written AI responses disguised as on-device AI.
- **Specification Requirement**:
  - Remove deceptive simulated fallback text generation.
  - When `settings.localLlm.enabled === false` or the local LLM server endpoint fails to respond:
    1. Do NOT generate fake AI text.
    2. Display a clear, prominent warning banner: "로컬 AI 미연결 상태 (서버 오프라인)".
    3. Provide an actionable guide: "로컬 AI(Ollama / LM Studio)를 켜거나 [설정]에서 엔드포인트를 확인해 주세요" with a "연결 테스트" button.
    4. Handle errors transparently in both summary generation and interactive Q&A.
- **Acceptance Criteria**:
  - [ ] When local AI is disconnected, no simulated/fake AI text is outputted.
  - [ ] App displays explicit offline status and instructions to connect local LLM.

---

### Feedback 12: Structured Clinical Briefing by Department
- **Verbatim Text**: `12. 그래서 의료진에게 해당 증상을 보여줘야 하는 게 진료브리핑 기능이어야 하는데, 어떻게 보여줄 건데? 클립보드에 복사해서? 앱 상에서 자체적으로 각 증상별로 구분해서 각 진료과에 맞게 보여줄 수 있어야 하는 거 아냐? 진료브리핑 기능을 잘못 설계한 거 같은데. 환자의 휴대폰에서 LLM으로 의료 보조를 시키고, 클립보드에 기록을 복사하는 게 무슨 의미가 있는 거지?`
- **Requirement Mapping**: **R4. 로컬 AI 및 진료브리핑 화면 개편**
- **Current Defect & Root Cause**:
  `src/pages/ClinicalBriefing.tsx` focuses heavily on "EMR Clipboard Copy (Ctrl+V)" and LLM text generation, rather than presenting a structured, high-visibility, on-screen medical presentation designed for doctor inspection during a 30-second clinic visit. Symptoms are not categorized by clinical department.
- **Specification Requirement**:
  - Redesign the Clinical Briefing view into a dedicated **"의료진 전용 30초 진료 화면 (Doctor-Facing Presentation Mode)"**:
  - **Department Grouping**: Automatically group patient conditions into clinical specialties:
    - **정형외과 / 재활의학과**: 허리, 목, 어깨, 무릎, 관절, 사지 통증
    - **신경과 / 신경외과**: 두통, 편두통, 방사통, 신경 마비/감각 저하
    - **소화기내과**: 복통, 위장 장애, 속쓰림, 메스꺼움
    - **일반내과 / 가정의학과**: 전신 통증, 발열, 다발성 복합 증상 및 기타
  - **Structured Clinical Presentation**:
    - Under each department card, clearly display:
      1. Chief Complaint & Onset Date
      2. Pain Severity (NRS Peak, 7-Day Average, Current)
      3. PQRST Pattern (Quality, Radiation, Triggers, Relief)
      4. Drug Response (Medications taken, pain delta, adverse side effects)
      5. Red Flags Warning (Highlighted in urgent red banner)
  - De-emphasize clipboard copy to a secondary utility button.
- **Acceptance Criteria**:
  - [ ] Clinical briefing screen categorizes all active symptoms by medical department.
  - [ ] Doctor can view structured clinical trends, drug efficacy, and red flags directly on the mobile display in under 30 seconds.

---

### Feedback 13: System-Linked Haptics Enforcement
- **Verbatim Text**: `13. 터치 햅틱 진동은 시스템과 연동해서 동작하게 하자. 그리고 해제해두어도 햅틱 반응이 오는 기능들이 있어.`
- **Requirement Mapping**: **R2. 시스템 환경 연동 및 접근성 강화**
- **Current Defect & Root Cause**:
  In `src/utils/native.ts:7-16`, `triggerHaptic()` calls `@capacitor/haptics` and `navigator.vibrate` directly without checking `settings.hapticsEnabled`. Moreover, components across the app (`PinModal`, `LockScreen`, `Layout`, `Dashboard`, `EntryForm`) invoke `triggerHaptic()` unconditionally.
- **Specification Requirement**:
  - Centralize all haptic execution through a guarded haptic service that checks `settings.hapticsEnabled`.
  - When `settings.hapticsEnabled === false`, completely suppress all calls to Capacitor Haptics and `navigator.vibrate`.
  - In Android native runtime, respect the Android OS system haptic/vibration setting (do not vibrate if OS system vibration is disabled).
  - Audit every component to ensure no rogue vibration calls bypass the guard.
- **Acceptance Criteria**:
  - [ ] When haptics are toggled off in settings, zero vibration occurs on any button, keypad, or tab click.
  - [ ] App respects Android system vibration preferences.

---

### Feedback 14: Android SDK Standard Compliance & Official APK Build
- **Verbatim Text**: `14. 이외에도 안드로이드 SDK 표준을 대체로 따라가면서 개발을 진행하도록 해.`
- **Requirement Mapping**: **R5. 안드로이드 SDK 표준 준수 및 공식 APK 재빌드**
- **Specification Requirement**:
  - Standard Android Architecture:
    - `compileSdkVersion 34`, `targetSdkVersion 34`, `minSdkVersion 24`.
    - Android Edge-to-Edge compliance with proper `WindowInsets` handling.
    - Android Accessibility standards (minimum 48dp touch targets, WCAG AA color contrast, dynamic text scaling).
    - Android Security: `FLAG_SECURE` in `MainActivity` to prevent screen capture in App Switcher; WebCrypto AES-GCM on-device encryption.
  - Official APK Build:
    - Execute clean build: `npm run build` -> `npx cap sync android` -> `./gradlew assembleDebug` (or local build script).
    - Output verified valid APK file at `android/app/build/outputs/apk/debug/app-debug.apk`.
- **Acceptance Criteria**:
  - [ ] Project adheres to Android SDK 34 standards and guidelines.
  - [ ] Official APK successfully builds with 0 fatal errors and produces executable APK binary.

---

## 5-Component Handoff Report

### 1. Observation
1. **Feedback Specification Source**:
   `body-signal/user_feedback/Feedback_2026-11-06.md` contains 14 numbered feedback lines.
2. **Authentication Screens**:
   - `src/components/PinModal.tsx:95`: `<div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md px-4 ...">` (semi-transparent 95% opacity causing background bleed-through; line 140 restricts keypad to `max-w-[280px]` with non-standard `h-18 w-18`).
   - `src/components/LockScreen.tsx:77`: `max-w-[280px]` keypad. No biometric authentication option or button exists.
   - `src/context/AuthContext.tsx`: Manages only numeric PIN via `utils/pin.ts`.
3. **Theme & Accessibility**:
   - `src/context/SettingsContext.tsx:27-45`: `applyTheme` only executes on initial mount. No `matchMedia('(prefers-color-scheme: dark)')` change listener is registered.
   - `src/index.html:6`: Contains `maximum-scale=1.0, user-scalable=no`.
   - `src/utils/native.ts:7-16`: `triggerHaptic()` directly invokes `Haptics.impact` and `navigator.vibrate` without verifying `settings.hapticsEnabled`.
4. **Medication & Symptom Recording**:
   - `src/components/AcutePainMode.tsx:16-21`: `COMMON_ACUTE_MEDS` is hardcoded. Line 298 maps over hardcoded array instead of `settings.medicationPresets`.
   - `src/components/QuickPainLogger.tsx:17`: `QUICK_MEDS` is hardcoded.
   - `src/components/BodyMap.tsx:5-6`: Only supports single selection `selectedPart?: string`.
   - `src/pages/Dashboard.tsx:311-500`: Stacks acute banner, medication follow-up, quick logger, condition cards with inline forms, and clinical briefing banner.
5. **Local AI & Clinical Briefing**:
   - `src/utils/localLlm.ts:125-202 & 318-322`: When server is offline, falls back to `fallbackClinicalStream` which generates pre-scripted fake LLM responses.
   - `src/pages/ClinicalBriefing.tsx:221-350`: Prominently emphasizes clipboard copy (`navigator.clipboard.writeText`) and LLM chat instead of on-screen medical department categorization.
6. **Android Build Infra**:
   - `body-signal/android/app/build.gradle:4-29`: `compileSdk = 34`, `targetSdkVersion = 34`, Java 17.
   - `body-signal/build_apk_local.ps1`: Automated build script for JDK 17, Android SDK 34, and `./gradlew assembleDebug`.

### 2. Logic Chain
1. The user's feedback directly stems from verifiable architectural gaps in the current code:
   - Feedback 1 matches `PinModal.tsx` translucent overlay (`bg-slate-950/95`) and safe-area top gap.
   - Feedback 2 matches lack of WebAuthn / Biometrics in `AuthContext.tsx` and `LockScreen.tsx`.
   - Feedback 3 matches `max-w-[280px]` and non-standard `h-18` classes in `PinModal` and `LockScreen`.
   - Feedback 4 matches missing `matchMedia` listener in `SettingsContext.tsx`.
   - Feedback 5 matches hardcoded `COMMON_ACUTE_MEDS` and `QUICK_MEDS` ignoring `settings.medicationPresets`.
   - Feedback 6 matches lack of inline medication creation modal/action in logging flows.
   - Feedback 7 matches viewport zoom disabling and hardcoded micro-typography (`text-[9px]`, `text-[10px]`).
   - Feedback 8 confirms existing `EntryForm.tsx` works well and must be protected against regressions.
   - Feedback 9 matches duplicate entry points spanning acute mode, quick logger, inline card forms, and floating SOS.
   - Feedback 10 matches `selectedPart: string` in `BodyMap.tsx` preventing multi-region arrays.
   - Feedback 11 matches `fallbackClinicalStream` in `localLlm.ts` silently disguising offline states as AI output.
   - Feedback 12 matches clipboard-centric design in `ClinicalBriefing.tsx` instead of department-categorized on-screen presentation.
   - Feedback 13 matches unconditional `triggerHaptic` execution ignoring `settings.hapticsEnabled`.
   - Feedback 14 matches Android SDK 34 compliance and official APK generation via Gradle.
2. Therefore, mapping these 14 items across requirements R1, R2, R3, R4, R5 provides a comprehensive, complete, and mutually exclusive specification for the Bignal application enhancement.

### 3. Caveats
- Biometric authentication via WebAuthn platform authenticator requires device hardware (fingerprint sensor or facial recognition camera) and biometric enrollment on the Android device; on emulators or devices without hardware, the PIN keypad must remain the primary fallback.
- Local LLM connection relies on a running local endpoint (e.g. Ollama on `10.0.2.2:11434` for Android emulator or localhost for web preview).
- Font scaling test depends on device/emulator font scale settings; responsive layouts must be verified across standard 360dp to 412dp viewport widths.

### 4. Conclusion
All 14 user feedback items have been thoroughly mined, mapped to requirements R1 through R5, grounded in exact code locations, and translated into unambiguous technical specifications with complete acceptance criteria. The application is ready for the orchestrator to synthesize this specification into `PROJECT.md` and downstream implementation phases.

### 5. Verification Method
- **TypeScript Integrity**: `npx tsc --noEmit` in `body-signal` directory.
- **Frontend Build**: `npm run build` in `body-signal` directory.
- **Data & Crypto Test Suite**: `node scripts/test-data-store.mjs` and `npm run test:r2`.
- **Capacitor Sync**: `npx cap sync android` in `body-signal` directory.
- **Android APK Build**: `./gradlew assembleDebug` in `body-signal/android` (or executing `build_apk_local.ps1`), producing `android/app/build/outputs/apk/debug/app-debug.apk`.
- **Manual Feature Inspection**: Inspect `PinModal` full bleed, biometric toggle, keypad touch sizing, system theme change event, custom med prompt, BodyMap multi-selection, local AI offline guard, department-grouped briefing, and haptic suppression.
