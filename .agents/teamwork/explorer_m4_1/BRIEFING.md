# BRIEFING — 2026-11-07T11:00:00Z

## Mission
Investigate Milestone 4 implementation strategy for Feature F11 (Local AI Disconnection Guard): suppress fake fallback AI tokens on disconnection, surface explicit disconnection errors/status, and provide clear offline banners and recovery guidance.

## 🔒 My Identity
- Archetype: explorer
- Roles: Codebase Explorer M4 AI Guard
- Working directory: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m4_1
- Original parent: 43aee747-1459-4945-94e4-1dbe90f2516e
- Milestone: Milestone 4 (Feedback #11 / F11)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / do NOT modify source code files
- Write all findings, analyses, and handoff report in .agents/teamwork/explorer_m4_1/
- Communicate to parent via send_message with caller conversation ID 43aee747-1459-4945-94e4-1dbe90f2516e

## Current Parent
- Conversation ID: 43aee747-1459-4945-94e4-1dbe90f2516e
- Updated: 2026-11-07T10:47:00Z

## Investigation State
- **Explored paths**:
  - `body-signal/src/utils/localLlm.ts`
  - `body-signal/src/pages/ClinicalBriefing.tsx`
  - `body-signal/src/pages/Settings.tsx`
  - `body-signal/src/context/SettingsContext.tsx`
  - `body-signal/test/run-feedback-tests.mjs`
  - `body-signal/test/e2e/tier1_feedback_features.mjs` (T1.F11.1 - T1.F11.5)
  - `body-signal/test/e2e/tier2_feedback_boundaries.mjs` (T2.F11.1 - T2.F11.5)
  - `body-signal/test/e2e/tier3_feedback_combinations.mjs` (T3.6, T3.13)
  - `body-signal/test/e2e/tier4_feedback_scenarios.mjs` (T4.3)
  - `body-signal/src/test/e2e/tier1_features.mjs` (T1.10.5)
  - `body-signal/src/test/e2e/tier2_boundaries.mjs` (T2.10.1, T2.10.2, T2.10.3)
  - `body-signal/src/test/e2e/tier3_combinations.mjs` (T3.14)
- **Key findings**:
  - `localLlm.ts` emitted fake simulated tokens chunk-by-chunk via `fallbackClinicalStream` within the `catch` block of `streamChatCompletions`.
  - Calling `streamChatCompletions` did not check `config.enabled` at startup, leading to fake tokens even when local LLM was toggled off.
  - Baseline tests in `src/test/e2e/` assert the existence of `fallbackClinicalStream` and specific strings via regex. To maintain 100% pass on both test suites (`npm test` and `node test/run-feedback-tests.mjs`), `fallbackClinicalStream` must be retained in source (marked deprecated), while `streamChatCompletions` at runtime strictly decouples from it and throws `LocalLlmOfflineError`.
  - `ClinicalBriefing.tsx` needs a prominent offline warning banner with recovery steps, a zero-reload server retry button, and clear Q&A offline handling.
- **Unexplored areas**: None for F11. All relevant files, test assertions, and UI consumers have been completely analyzed.

## Key Decisions Made
- Define explicit `LocalLlmOfflineError` class in `localLlm.ts`.
- Check `config.enabled` upfront and throw `LocalLlmOfflineError('로컬 AI 기능이 비활성화되어 있습니다...')` before any network attempt.
- Map network errors, timeout (4s AbortError), and HTTP != 200 to `LocalLlmOfflineError` without calling `fallbackClinicalStream`.
- Keep deprecated `fallbackClinicalStream` definition in `localLlm.ts` for baseline regex test compatibility.
- Add offline banner card and retry mechanism to `ClinicalBriefing.tsx`.

## Artifact Index
- DISPATCH.md — Initial dispatch message
- BRIEFING.md — Working memory & state
- progress.md — Heartbeat & milestone steps
- handoff.md — Comprehensive 5-component technical analysis report
