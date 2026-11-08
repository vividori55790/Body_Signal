# Task Assignment: Feature Modules Explorer (Survey)

**Working Directory**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_survey_features`
**Identity**: `survey_feature_modules` (Type: `teamwork_explorer`)
**Parent**: Top-level Project Orchestrator (`c0c096b2-e043-4359-9001-d946fccdf4ac`)

## Objective
Read `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md` and explore existing source code to map all target feature implementations corresponding to:
1. **R1: Authentication & PIN/Keypad**
   - Current password/PIN setup and entry screens.
   - Screen bounds, window insets, top space issues (why previous screen is visible).
   - Biometric authentication status (is BiometricPrompt implemented? dependencies like `androidx.biometric`?).
   - Keypad UI component, touch target sizes, click listeners.
2. **R2: System Environment & Accessibility**
   - Theme implementation (dark/light mode switching, is it reactive to system configuration?).
   - Font scale inheritance across Text components (sp vs dp, typography settings).
   - Haptic feedback implementation (Vibrator, HapticFeedbackConstants, VibrationEffect, system setting checks).
3. **R3: Medication & Symptom Logging & Dashboard**
   - Medication tracking flow: '약을 먹었나요' confirmation dialog/card, medication database/models, default data vs user registered data.
   - Medication management entry points (currently in settings? where else?).
   - Symptom recording screens and models: body map screen, body part selection logic (currently single-select?), multi-select support.
   - Dashboard navigation and recording entry points (where are the redundant entry points?).
4. **R4: Local AI & Doctor Briefing**
   - Local AI integration: model loader, inference engine, fallback/offline error handling, what default text is currently returned when disconnected.
   - Doctor briefing / clinical summary: current clipboard copy implementation vs dedicated briefing screen, UI layout for symptom/department categorization.

## Output Requirements
Write your detailed feature inventory and codebase mapping report to:
`c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_survey_features\handoff.md`
and notify the orchestrator via `send_message`.
