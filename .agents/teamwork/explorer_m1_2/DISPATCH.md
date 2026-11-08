# Task Assignment: Explorer 2 (Milestone 1: F2 Biometric Passkey Unlock)

**Working Directory**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_2`
**Identity**: `explorer_m1_2` (Type: `teamwork_explorer`)
**Parent**: Top-level Project Orchestrator (`c0c096b2-e043-4359-9001-d946fccdf4ac`)

## Objective
Read `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md` and `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\PROJECT.md`.
Investigate and design the exact implementation strategy for **Feature 2 (F2): Biometric Passkey / Fingerprint / Face Unlock**:
- Analyze `body-signal/src/context/AuthContext.tsx`, `body-signal/src/components/LockScreen.tsx`, and `body-signal/src/pages/Settings.tsx`.
- Formulate the biometric authentication engine (using standard Web Authentication / WebAuthn `PublicKeyCredential` / `navigator.credentials` and/or Capacitor bridge).
- Detail how `AuthContext` will manage `isBiometricSupported`, `isBiometricEnabled`, `enableBiometrics()`, `unlockWithBiometrics()`.
- Detail the UI in `LockScreen.tsx` for presenting the biometric button and triggering it automatically/on-tap.
- Detail the fallback behavior when biometrics fail or are canceled (smooth continuation with PIN keypad).
- You are READ-ONLY. DO NOT implement. Recommend fix strategy.

## Output Requirements
Write your report to `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_2\handoff.md` and notify parent via `send_message`.


## 2026-11-07T02:27:41Z
You are explorer_m1_2, operating in c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_2.
Your parent orchestrator is c0c096b2-e043-4359-9001-d946fccdf4ac.

Read the following instructions carefully:
1. Read ORIGINAL_REQUEST.md at:
   c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md
2. Read PROJECT.md at:
   c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\PROJECT.md
3. Read DISPATCH.md at:
   c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_2\DISPATCH.md
4. Formulate the exact fix strategy for F2 (Biometric Passkey / Fingerprint / Face Unlock).
5. You are READ-ONLY. DO NOT write or edit application code.
6. Create progress.md in your working directory.
7. Write your report to handoff.md and notify parent via send_message.
