# Task Assignment: E2E Test Suite Creation (Dual Track)

**Working Directory**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\test_writer_e2e`
**Identity**: `e2e_test_writer` (Type: `teamwork_test_writer`)
**Parent**: Top-level Project Orchestrator (`c0c096b2-e043-4359-9001-d946fccdf4ac`)

## Objective
Design and implement a comprehensive opaque-box E2E test suite derived strictly from `ORIGINAL_REQUEST.md` and `body-signal/user_feedback/Feedback_2026-11-06.md`.

## Methodology (4-Tier Requirement Coverage)
1. **Tier 1 - Feature Coverage (≥5 per feature, 14 features = ≥70 tests)**:
   - Happy-path tests for each of the 14 features in isolation.
2. **Tier 2 - Boundary & Corner Cases (≥5 per feature, 14 features = ≥70 tests)**:
   - Boundary inputs, maximum values, empty states, canceling prompts, network timeouts, rapid multi-taps.
3. **Tier 3 - Cross-Feature Combinations (pairwise interactions, ≥14 tests)**:
   - E.g. Theme change during PIN modal, biometric toggle + haptics disabled, multi-region body map + custom medication presets, local AI offline + clinical briefing.
4. **Tier 4 - Real-World Application Scenarios (≥7 realistic workloads)**:
   - Realistic patient day-in-the-life journeys (Morning chronic log -> acute pain flareup -> doctor consultation briefing mode).

## Specific Verification Requirements
- Read `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md`.
- Read `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\PROJECT.md`.
- Inspect existing tests in `body-signal/test/` or root `test/` (currently 170 tests passing).
- Add or expand test suites to comprehensively test all 14 new feedback specifications (F1 through F14).
- Ensure the test runner executes cleanly via `npm run test` or `node <test_script>`.
- Create/update `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\TEST_INFRA.md` and `TEST_READY.md`.

## Output Requirements
Write your handoff report to:
`c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\test_writer_e2e\handoff.md`
and notify the orchestrator via `send_message`.
