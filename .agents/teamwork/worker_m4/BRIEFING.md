# BRIEFING — 2026-11-07T11:03:00Z

## Mission
Implement Milestone 4 (R4: Local AI Offline Guard & Doctor-Facing Clinical Briefing) covering F11 and F12.

## 🔒 My Identity
- Archetype: teamwork_worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m4
- Original parent: 43aee747-1459-4945-94e4-1dbe90f2516e
- Milestone: M4 (R4: Local AI Offline Guard & Doctor-Facing Clinical Briefing)

## 🔒 Key Constraints
- File Ownership Boundaries:
  - `body-signal/src/utils/localLlm.ts`
  - `body-signal/src/utils/clinicalDepartments.ts` (new file)
  - `body-signal/src/pages/ClinicalBriefing.tsx`
- Genuine implementation required (No cheating, no fake tokens emitted on offline, true classification logic).
- CRITICAL BASELINE CONSTRAINT: Retain `fallbackClinicalStream` function declaration (with original strings `온디바이스 임상 엔진 분석 리포트` and `외부 서버 전송 없이 100% 기기 내부 로컬 분석`) as deprecated/uncalled so baseline tests pass.
- Verification pass criteria:
  - `node body-signal/test/run-feedback-tests.mjs --feature F11`
  - `node body-signal/test/run-feedback-tests.mjs --feature F12`
  - `node body-signal/test/run-feedback-tests.mjs` (All 161 tests pass)
  - `npm --prefix body-signal test` (All 170 baseline tests pass)
  - `npm --prefix body-signal run build` (Succeed with zero TS/Vite errors)

## Current Parent
- Conversation ID: 43aee747-1459-4945-94e4-1dbe90f2516e
- Updated: 2026-11-07T11:03:00Z

## Task Summary
- **What to build**:
  1. F11 Local AI Disconnection Guard in `localLlm.ts`: `LocalLlmOfflineError`, upfront config.enabled check, timeout (4000ms), 500 error handling, zero fake tokens, testLocalLlmConnection offline handling.
  2. F12 Medical Department Classification Engine in `clinicalDepartments.ts`: `DepartmentType`, priority-based anatomical classification (Neurology > Orthopedics for nerve/headache terms), multi-region string parsing, `categorizeByDepartment` and summary generators.
  3. F12 Doctor-Facing 30-Sec Clinical Briefing Screen in `ClinicalBriefing.tsx`: High-contrast on-screen presentation screen for clinicians with glanceable metrics, immediate Red Flags, horizontal specialty filter pills, department cards, slim offline banner with recovery guidance & zero-reload retry, secondary toolbar for copy/print.
- **Success criteria**: All feedback tests (161) pass, all baseline tests (170) pass, build succeeds.
- **Interface contracts**: `handoff.md` blueprints from explorer_m4_1, explorer_m4_2, explorer_m4_3.

## Change Tracker
- **Files modified**: None yet
- **Build status**: Untested
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: Pending
- **Tests added/modified**: Pending

## Loaded Skills
None requested.
