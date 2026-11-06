## 2026-11-06T09:34:07Z
You are Worker M4 (teamwork_worker).
Your working directory is: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m4

Read ORIGINAL_REQUEST.md at: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md
Read Survey Explorer 3 Report at: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\survey_explorer_3\report.md
Read Survey Explorer 3 Handoff at: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\survey_explorer_3\handoff.md
Read PROJECT.md at: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\PROJECT.md

Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Task for Milestone 4 (Local LLM Integration & Streaming - Requirement R4):
1. **Android Cleartext Traffic (`body-signal/android/app/src/main/AndroidManifest.xml`)**:
   - Add `android:usesCleartextTraffic="true"` to `<application ...>` in `AndroidManifest.xml` so mobile WebViews and Capacitor can reach LAN HTTP endpoints (e.g. `http://192.168.0.x:11434`, `http://10.0.2.2:11434`, `http://localhost:1234`).
2. **Dual Streaming Protocol Parser: SSE & Ollama NDJSON (`body-signal/src/utils/localLlm.ts`)**:
   - In `streamChatCompletions`, enhance the stream chunk processor so it seamlessly decodes:
     - Standard SSE (`data: { "choices": [{ "delta": { "content": "..." } }] }` or `data: [DONE]`)
     - Native Ollama NDJSON lines (`{ "message": { "content": "..." }, "done": false }`)
   - Preserve offline mock fallback (`fallbackClinicalStream`) when endpoint is unreachable.
3. **Doctor vs Patient Clinical Persona Selection (`body-signal/src/pages/ClinicalBriefing.tsx`)**:
   - In `ClinicalBriefing.tsx`, add persona selection tabs/buttons for the AI summary:
     - "의사용 전문 임상 요약 (SOAP)" -> `persona: 'doctor'`
     - "환자용 쉬운 소견 요약" -> `persona: 'patient'`
   - Wire the active persona into `generateClinicalAiAnalysisStream(briefing, onChunk, signal, activePersona)`.

Files You Own Exclusively:
- `body-signal/android/app/src/main/AndroidManifest.xml`
- `body-signal/src/utils/localLlm.ts`
- `body-signal/src/pages/ClinicalBriefing.tsx`

Verification Requirements:
1. `Set-Location body-signal; npx tsc --noEmit` -> Must be 0 compilation errors.
2. `npm run test:data` -> Must pass.
3. `npm test` -> Must pass all 170 E2E tests.
4. `npm run build` -> Must succeed cleanly.
5. Document all commands, file changes, and test results in `handoff.md`.
6. Message your orchestrator parent when complete.
