# Milestone 3 Implementation Strategy: Features F5 & F6
**Subject**: Dynamic Medication Prompt Linking (F5) & In-Flow Medication Management (F6)  
**Investigator**: Codebase Explorer M3 Meds (`explorer_m3_1`)  
**Date**: 2026-11-07  

---

## 1. Observation

### 1.1 Medication Presets in `SettingsContext.tsx` & Data Layer
- **Schema Definition** (`body-signal/src/types/health.ts:56-62, 94-100`):
  ```ts
  export const MedicationPresetSchema = z.object({
    id: z.string(),
    name: z.string(),
    dosage: z.string().optional(),
  });
  export type MedicationPreset = z.infer<typeof MedicationPresetSchema>;
  ```
  `UserSettingsSchema` includes:
  ```ts
  medicationPresets: z.array(MedicationPresetSchema).default([
    { id: '1', name: '타이레놀 500mg' },
    { id: '2', name: '이부프로펜 400mg' },
    { id: '3', name: '소염진통제' },
    { id: '4', name: '근이완제' },
    { id: '5', name: '위장보호제' },
  ])
  ```
- **Context API** (`body-signal/src/context/SettingsContext.tsx:15, 131-149`):
  ```ts
  addMedicationPreset: (name: string, dosage?: string) => Promise<void>;
  removeMedicationPreset: (id: string) => Promise<void>;
  ```
  `addMedicationPreset` creates `{ id: crypto.randomUUID(), name: name.trim(), dosage: dosage?.trim() || undefined }` and calls `updateAndSave`. It returns `Promise<void>`, does not return the created preset object, does not perform duplicate checks, and does not provide an `updateMedicationPreset` method.
- **Persistence** (`body-signal/src/utils/storage.ts:339-355`):
  `saveUserSettings(settings)` persists to IndexedDB store `app_state` key `'user_settings'`. On app launch, `loadUserSettings()` reads from `'user_settings'` and validates against `UserSettingsSchema`.

### 1.2 Current State of '약을 먹었나요' / Medication Prompts
1. **`AcutePainMode.tsx` (`body-signal/src/components/AcutePainMode.tsx:16-21, 260-322`)**:
   - Hardcoded constant array:
     ```ts
     const COMMON_ACUTE_MEDS = [
       '타이레놀(아세트아미노펜)',
       '이부프로펜/소염제',
       '병원 처방 진통제',
       '근육이완제',
     ];
     ```
   - Section 3 ("진통제나 약을 드셨나요?") checks `tookMed` boolean.
   - When `tookMed === true`, renders buttons mapping exclusively over `COMMON_ACUTE_MEDS`.
   - `SettingsContext` is **NOT imported or consumed**.
   - No mechanism exists to render the user's actual registered presets (`settings.medicationPresets`).
   - No mechanism exists to add/edit medication presets inline.
   - Saves: `medication: tookMed ? selectedMed : ''`.
   - **Root Cause of Feedback #5**: *"약을 먹었나요를 물어볼 때 먹었다고 하면 뭘 먹었는지 나오는데 내가 설정한 약은 안 나오고 기본값만 출력돼."*

2. **`QuickPainLogger.tsx` (`body-signal/src/components/QuickPainLogger.tsx:17, 201-224`)**:
   - Hardcoded constant array:
     ```ts
     const QUICK_MEDS = ['타이레놀', '소염진통제', '처방약', '근이완제'];
     ```
   - Section 3 ("3. 복약 여부 (선택)") maps over `QUICK_MEDS`.
   - `SettingsContext` is **NOT imported or consumed**.
   - Completely ignores user's configured presets.
   - No inline "+ 약 추가" action exists.

3. **`EntryForm.tsx` (`body-signal/src/pages/EntryForm.tsx:561-595`)**:
   - Imports `useSettings()` and reads `settings.medicationPresets`.
   - Maps `preset.name` into quick chips: `+ {preset.name}`.
   - Tapping preset appends `preset.name` to `medication` string state.
   - **Deficiencies**:
     - Ignores `preset.dosage` even if configured.
     - Does **NOT** allow adding or managing presets inline. Users must navigate out to Settings (`Settings.tsx`) to register a new preset (causes Feedback #6: *"약을 설정에서 관리해야 하는 게 불편해"*).

4. **`Settings.tsx` (`body-signal/src/pages/Settings.tsx:465-524`)**:
   - Manages presets via `settings.medicationPresets.map((preset) => ...)` with delete buttons (`removeMedicationPreset(preset.id)`).
   - Has `showAddMed` toggle showing input and button calling `addMedicationPreset(newMedName)`.
   - Lacks dosage field input in the UI (only accepts name string).

### 1.3 Test Suite & Interface Contracts
- **E2E Test Runner** (`body-signal/test/run-feedback-tests.mjs`):
  - `T1.F5.1` - `T1.F5.5`: Tests AcutePainMode and QuickPainLogger reading `userSettings.medicationPresets`, preserving custom medication name in logs, and reflecting custom med on Dashboard drug re-evaluation banner.
  - `T1.F6.1` - `T1.F6.5`: Verifies in-flow add medication action `{ label: '+ 약 추가', isInline: true }`, appends to presets, immediately selects for current record, persists to store, and EntryForm has inline med add.
  - `T2.F5.1` - `T2.F5.5`: Verifies fallback handling when presets empty, verbatim special symbols/dosages, wrapping long medication names (`break-words`), deselection clearing medication, and deleting preset leaving historical logs intact.
  - `T2.F6.1` - `T2.F6.4`: Empty/whitespace validation, duplicate medication name prevention/merge, preserving existing pain intensity/form state during inline add, and capping names at 80 characters.
  - `T3.4`, `T3.10`: Cross-feature combination tests verifying in-flow added preset immediately appears in prompts and preserves active form fields.
  - `T4.1`, `T4.2`: Real clinical workflow tests verifying custom medication presets in acute flare-up and post-op pain logging.
- **Baseline Test Suite** (`npm --prefix body-signal test` via `body-signal/scripts/run-e2e-tests.mjs`):
  - 170 tests passing cleanly across Tiers 1-4.

---

## 2. Logic Chain

1. **User Problem Origin**:
   - Users who register customized medications (e.g. "낙센프리정 500mg", "세레브렉스 200mg") in Settings find that the rapid logging entry points (`AcutePainMode.tsx` and `QuickPainLogger.tsx`) completely ignore their configurations and present hardcoded standard options (`COMMON_ACUTE_MEDS`, `QUICK_MEDS`).
   - When users need to log a new medicine during an acute or standard pain episode, there is no way to register it on the spot; they are forced to leave their recording session, navigate to Settings, add the medicine, and return.
2. **Connecting Data to UI**:
   - Both `AcutePainMode.tsx` and `QuickPainLogger.tsx` must consume `useSettings()`.
   - Hardcoded arrays (`COMMON_ACUTE_MEDS`, `QUICK_MEDS`) must be replaced with `effectiveMeds` derived dynamically from `settings.medicationPresets`.
   - When `settings.medicationPresets` is empty (e.g. user deleted all presets), a fallback list (`['타이레놀', '이부프로펜', '병원 처방약']`) or an invitation to add a medication must be supplied so the UI never breaks (`T2.F5.1`).
3. **Handling Dosages Uniformly**:
   - `MedicationPreset` supports `name: string` and optional `dosage?: string`.
   - A single canonical formatter `formatMedicationPreset(preset)` should format the label:
     - If `dosage` exists and is not already part of `name`: `${preset.name} ${preset.dosage}`.
     - Otherwise: `preset.name`.
   - This ensures dosages configured in settings or created inline are seamlessly visible in prompt buttons, chips, and persisted into `PainLog.medication`.
4. **Designing In-Flow Medication Management (F6)**:
   - To prevent losing user form context (such as selected NRS intensity or active body part, per `T2.F6.3` and `T3.10`), inline creation must NOT cause navigation, full reloads, or unmounting of the parent form.
   - An inline micro-component (`AddMedicationInline.tsx`) or expandable micro-card within the medication section satisfies all requirements:
     - Includes a `+ 약 추가` trigger button (`T1.F6.1`).
     - Expands in-place with inputs for 약 이름 (Name, required) and 복용량/용법 (Dosage, optional).
     - Validates input: rejects empty/whitespace strings (`T2.F6.1`), caps length at 80 characters (`T2.F6.4`), and deduplicates against existing preset names (`T2.F6.2`).
     - On submit: saves preset via `addMedicationPreset`, automatically marks the new medication as selected for the active record (`T1.F6.3`), and closes the inline form.
     - Triggers tactile haptic feedback and preserves all current form states (`intensity`, `bodyPart`, `notes`).
5. **Upgrading `SettingsContext.tsx`**:
   - Update `addMedicationPreset` signature:
     `addMedicationPreset: (name: string, dosage?: string) => Promise<MedicationPreset | null>`.
   - Returning the created or merged preset allows callers in `AcutePainMode`, `QuickPainLogger`, and `EntryForm` to immediately access the newly assigned item and select it.
   - Add duplicate protection and whitespace trimming in `addMedicationPreset`.
   - Add `updateMedicationPreset: (id: string, updates: Partial<MedicationPreset>) => Promise<void>` for full CRUD completeness.

---

## 3. Caveats

1. **Multiple Selection vs Single Selection**:
   - In `AcutePainMode.tsx`, the prompt asks "진통제나 약을 드셨나요?" and historically logs a single medication string.
   - In `QuickPainLogger.tsx`, chips allow single-select toggle.
   - In `EntryForm.tsx`, clicking preset chips appends comma-separated medication names (`+ name`).
   - Strategy: Maintain single-select for rapid 1-sec/3-sec loggers (`AcutePainMode`, `QuickPainLogger`) for maximum speed, and comma-separated multi-select appending for full PQRST `EntryForm`.
2. **Schema Compatibility**:
   - `PainLog.medication` in IndexedDB is `z.string().max(500)`. Formatted preset strings (e.g. `"타이레놀 500mg"`, `"낙센프리정 500mg, 위장보호제"`) are completely compatible with existing schemas and cryptographic signing (`canonicalSignPainRecord`). No database migration is required.
3. **Dashboard Redundant Inline Form (F9 Intersection)**:
   - In `Dashboard.tsx`, `DetailedConditionCard` currently has an inline form (lines 171-226) with a basic medication text input. Note that Milestone 3 Feature F9 ("Dashboard Entry Streamlining") will eliminate redundant duplicate inline forms from condition cards. F5/F6 changes should focus on `AcutePainMode`, `QuickPainLogger`, `EntryForm`, and `Settings`.

---

## 4. Conclusion & Technical Implementation Plan

### Recommended Architectural Changes

#### Step 1: Utility Formatter (`body-signal/src/utils/medication.ts`)
Create a shared helper to standardize medication display and validation:
```ts
import { MedicationPreset } from '../types/health';

export function formatMedicationPreset(preset: { name: string; dosage?: string }): string {
  if (!preset.dosage || preset.name.includes(preset.dosage)) {
    return preset.name.trim();
  }
  return `${preset.name.trim()} ${preset.dosage.trim()}`;
}

export function validateMedicationInput(name: string): { valid: boolean; error?: string; cleanName?: string } {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return { valid: false, error: '약 이름을 입력해 주세요.' };
  }
  if (trimmed.length > 80) {
    return { valid: false, error: '약 이름은 최대 80자까지 입력 가능합니다.' };
  }
  return { valid: true, cleanName: trimmed };
}
```

#### Step 2: Context Upgrade (`body-signal/src/context/SettingsContext.tsx`)
1. Update `addMedicationPreset`:
   - Validate non-empty and max 80 chars.
   - Check if preset with identical trimmed name already exists (case-insensitive); if so, return existing preset.
   - Otherwise, create `MedicationPreset` with UUID, append to `prev.medicationPresets`, persist via `updateAndSave`, and return the new preset.
2. Add `updateMedicationPreset(id: string, updates: Partial<MedicationPreset>): Promise<void>`.

#### Step 3: Shared In-Flow Component (`body-signal/src/components/AddMedicationInline.tsx`)
Create a lightweight, ergonomic micro-component for inline medication registration:
- Props:
  ```ts
  interface AddMedicationInlineProps {
    isOpen: boolean;
    onClose: () => void;
    onAdded: (formattedMedName: string) => void;
    placeholder?: string;
  }
  ```
- Layout:
  - Input: 약 이름 (Required, autofocus)
  - Input: 복용량 (Optional, e.g. "500mg", "1정")
  - Action buttons: "취소" (Cancel), "추가 및 선택" (Save & Select)
  - Accessible touch targets (≥44px button height), haptic on submit.

#### Step 4: Component Integration
1. **`AcutePainMode.tsx`**:
   - Read `const { settings, addMedicationPreset } = useSettings();`.
   - Compute `effectiveMeds`: `settings.medicationPresets.length > 0 ? settings.medicationPresets.map(formatMedicationPreset) : ['타이레놀', '이부프로펜', '병원 처방 진통제', '근육이완제']`.
   - Render `effectiveMeds` in 2-column grid.
   - Add `+ 약 추가` button next to/below grid.
   - When user adds a medication inline:
     - Sets `tookMed = true`
     - Sets `selectedMed = newlyAddedMedName`
     - Preserves current `intensity` and `selectedPart`.
2. **`QuickPainLogger.tsx`**:
   - Read `const { settings, addMedicationPreset } = useSettings();`.
   - Compute `effectiveMeds` from `settings.medicationPresets`.
   - Render `effectiveMeds` chips + a trailing `+ 약 추가` chip.
   - Tapping `+ 약 추가` toggles inline add input.
   - Newly created med is immediately toggled as `selectedMed`.
3. **`EntryForm.tsx`**:
   - Format chips using `formatMedicationPreset(preset)`.
   - Add `+ 약 추가` chip alongside preset chips.
   - Tapping `+ 약 추가` toggles inline add form.
   - Adding a preset registers it and appends it to `medication` string state.
4. **`Settings.tsx`**:
   - Enhance preset management to optionally allow dosage input alongside name.

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Feedback Test Suite (All 161 Tests)**:
   ```powershell
   node body-signal/test/run-feedback-tests.mjs --feature f5
   node body-signal/test/run-feedback-tests.mjs --feature f6
   node body-signal/test/run-feedback-tests.mjs
   ```
   *Expected*: 100% pass across all F5, F6, Tiers 1-4 tests.

2. **Baseline Regression Suite (170 Tests)**:
   ```powershell
   npm --prefix body-signal test
   ```
   *Expected*: All 170 legacy tests pass without regression.

3. **TypeScript & Production Build Verification**:
   ```powershell
   npm --prefix body-signal run build
   ```
   *Expected*: Zero TypeScript compilation errors, Vite bundle completes cleanly.

### 5.2 Files to Inspect
- `body-signal/src/context/SettingsContext.tsx`
- `body-signal/src/components/AcutePainMode.tsx`
- `body-signal/src/components/QuickPainLogger.tsx`
- `body-signal/src/pages/EntryForm.tsx`
- `body-signal/src/components/AddMedicationInline.tsx` (new component)
- `body-signal/src/utils/medication.ts` (new helper)

### 5.3 Invalidation Conditions
- If `AcutePainMode.tsx` still renders hardcoded `COMMON_ACUTE_MEDS` without referencing `settings.medicationPresets`.
- If clicking `+ 약 추가` causes a full-page reload or resets NRS intensity in `AcutePainMode`.
- If adding a medication fails to persist to IndexedDB upon restart.
- If an empty or whitespace medication name can be submitted.
