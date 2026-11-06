## 2026-11-06T09:33:48Z
You are Worker M3 (teamwork_worker).
Your working directory is: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m3

Read ORIGINAL_REQUEST.md at: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md
Read Survey Explorer 3 Report at: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\survey_explorer_3\report.md
Read Survey Explorer 3 Handoff at: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\survey_explorer_3\handoff.md
Read PROJECT.md at: c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\PROJECT.md

Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Task for Milestone 3 (On-Device Security & Data Integrity - Requirement R3):
1. **On-Device AES-GCM 256 Encryption at Rest (`body-signal/src/utils/storage.ts` & `crypto.ts`)**:
   - Ensure 100% on-device AES-GCM 256 encryption at rest without cloud sync.
   - When no user PIN is set, generate/retrieve a persistent device master key (in a dedicated IndexedDB store or secure local key store) to encrypt health data packages (`EncryptedPackage`) before storing in `app_state`.
   - When PIN is set, wrap/encrypt data using PBKDF2 derived PIN key.
   - Never write raw unencrypted plaintext health data into persistent storage.
2. **SHA-256 Per-Record Cryptographic Signatures & Tamper Verification (`body-signal/src/utils/crypto.ts` & `body-signal/src/context/HealthContext.tsx`)**:
   - In `crypto.ts`: implement `computeRecordSignature(record: PainLog, prevSignature?: string): Promise<string>` using canonical SHA-256 digest over normalized record fields.
   - Implement `verifyRecordSignature(record: PainLog): Promise<boolean>` to detect unauthorized data manipulation.
   - In `HealthContext.tsx`: on `saveEntry` and `updateLog`, automatically compute and attach `signature` (and chain `prevSignature`).
3. **Auto-lock Timeout & App Switcher Masking (`body-signal/src/context/AuthContext.tsx` & `body-signal/android/app/src/main/java/com/bodysignal/app/MainActivity.java`)**:
   - In `AuthContext.tsx`: Fix the privacy curtain condition so that when the app goes to background (`visibilitychange` / `AppState`), the privacy curtain masks the screen immediately.
   - In `MainActivity.java`: Add `getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)` in `onCreate()` for Android task switcher thumbnail blanking.

Files You Own Exclusively:
- `body-signal/src/utils/crypto.ts`
- `body-signal/src/utils/storage.ts`
- `body-signal/src/context/HealthContext.tsx`
- `body-signal/src/context/AuthContext.tsx`
- `body-signal/android/app/src/main/java/com/bodysignal/app/MainActivity.java`

Verification Requirements:
1. `Set-Location body-signal; npx tsc --noEmit` -> Must be 0 compilation errors.
2. `npm run test:data` -> Must pass.
3. `npm test` -> Must pass all 170 E2E tests.
4. `npm run build` -> Must succeed cleanly.
5. Document all commands, file changes, and test results in `handoff.md`.
6. Message your orchestrator parent when complete.
