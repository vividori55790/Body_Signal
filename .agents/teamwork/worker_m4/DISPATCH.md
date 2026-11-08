## 2026-11-07T11:02:44Z
You are a Worker (teamwork_worker) implementing Milestone 4 (R4: Local AI Offline Guard & Doctor-Facing Clinical Briefing).

Your Working Directory: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m4
Your Role: Worker M4 Implementation
Parent Conversation ID: 43aee747-1459-4945-94e4-1dbe90f2516e

Read the following authoritative specification and exploration reports first:
1. c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\PROJECT.md
3. c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m4_1\handoff.md (F11 Local AI Disconnection Guard blueprint)
4. c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m4_2\handoff.md (F12 Clinical Department Engine blueprint)
5. c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m4_3\handoff.md (F12 30-Sec Doctor Briefing UI blueprint)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your File Ownership Boundaries (You exclusively own and may edit these files):
- body-signal/src/utils/localLlm.ts
- body-signal/src/utils/clinicalDepartments.ts (new file)
- body-signal/src/pages/ClinicalBriefing.tsx

Detailed Implementation Tasks:
1. F11 (Local AI Disconnection Guard):
   - In `body-signal/src/utils/localLlm.ts`:
     - Define and export `LocalLlmOfflineError`.
     - In `streamChatCompletions`: validate `config?.enabled` upfront (fail fast with zero network requests if false). On fetch failure, timeout (4000ms), or HTTP 500 error, reject with `LocalLlmOfflineError`. Emit ZERO fake tokens to `onChunk`.
     - CRITICAL BASELINE CONSTRAINT: Retain the `fallbackClinicalStream` function declaration (with its original strings `온디바이스 임상 엔진 분석 리포트` and `외부 서버 전송 없이 100% 기기 내부 로컬 분석`) as a deprecated, uncalled function so that baseline regex checks in `npm test` pass cleanly.
     - In `testLocalLlmConnection`: return `{ success: false, message: '... 로컬 LLM 서버 ...' }` when offline/disabled.
2. F12 (Medical Department Classification Engine):
   - Create `body-signal/src/utils/clinicalDepartments.ts`:
     - Define `DepartmentType`: `'정형외과 / 재활의학과' | '신경과 / 신경외과' | '소화기내과' | '일반내과 / 기타 진료과'`.
     - Implement priority-based anatomical classification (Neurology takes precedence over Orthopedics for nerve/headache terms like `'팔 저림(말초신경통)'`).
     - Support multi-region conditions (split comma-separated strings so composite conditions populate all involved clinical departments).
     - Export `categorizeByDepartment(conditions, logs): DepartmentBriefingGroup[]` and summary generators.
3. F12 (Doctor-Facing 30-Second Clinical Briefing Screen):
   - In `body-signal/src/pages/ClinicalBriefing.tsx`:
     - Provide a dedicated, high-contrast, 30-second on-screen presentation screen for clinicians with glanceable metrics (Peak NRS, 7-Day Average, Recent NRS, Log count), immediate Red Flag alerts, and horizontal specialty filter pills (`전체`, `정형·재활`, `신경과`, `소화기`, `일반내과`).
     - Render structured clinical department cards grouping patient symptoms by specialty.
     - When local AI is offline or disabled, render a slim, non-blocking on-device banner with recovery guidance (terminal command, host URLs) and an in-place zero-reload retry button.
     - Demote clipboard text copy and printing to secondary toolbar actions.

Verification Requirements:
1. Run feedback tests:
   `node body-signal/test/run-feedback-tests.mjs --feature F11`
   `node body-signal/test/run-feedback-tests.mjs --feature F12`
   `node body-signal/test/run-feedback-tests.mjs` (All 161 tests must pass)
2. Run baseline test suite:
   `npm --prefix body-signal test` (All 170 baseline tests must pass)
3. Run build:
   `npm --prefix body-signal run build` (Must succeed with zero TypeScript or Vite errors)

Write your full handoff report to `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m4\handoff.md`.
Send a completion message back to me via send_message.
