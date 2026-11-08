# Task Assignment: Worker Milestone 1 (R1 Auth & Keypad UI Enhancement)

**Working Directory**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m1`
**Identity**: `worker_m1` (Type: `teamwork_worker`)
**Parent**: Top-level Project Orchestrator (`c0c096b2-e043-4359-9001-d946fccdf4ac`)

## Objective
Implement Milestone 1 (Features F1, F2, F3) for Bignal mobile application based on the comprehensive findings of the three M1 Explorers.

## Exclusive Write Ownership
You own and may ONLY edit or create the following files:
1. `body-signal/src/components/PinModal.tsx`
2. `body-signal/src/components/LockScreen.tsx`
3. `body-signal/src/context/AuthContext.tsx`
4. `body-signal/src/utils/biometrics.ts` (new file)
5. `body-signal/src/pages/Settings.tsx` (auth section)

DO NOT touch any files outside this list (e.g. `tailwind.config.js` or `index.css` belong to M2).

## Explorer Reports to Read
1. `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_1\handoff.md` (F1: Full-Bleed PIN Setup Modal)
2. `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_2\handoff.md` (F2: Biometric Passkey / Fingerprint / Face Unlock)
3. `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_3\handoff.md` (F3: Ergonomic Keypad Redesign)

## Implementation Instructions

### F1: Full-Bleed PIN Setup Modal (`PinModal.tsx`)
- Render `PinModal` via `createPortal(modalContent, document.body)`.
- Use 100% solid opacity `bg-slate-950` (remove `/95` and `backdrop-blur-md`).
- Viewport styling: `fixed inset-0 z-[9999] w-screen h-screen min-h-[100dvh] overflow-hidden select-none`.
- Safe-area insets: `pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]`.
- Close button positioned with safe area: `top-[max(1.5rem,env(safe-area-inset-top,1.5rem))] right-[max(1.5rem,env(safe-area-inset-right,1.5rem))]`.
- Body scroll lock & Escape key handling when `isOpen` is true.

### F2: Biometric Passkey / Fingerprint / Face Unlock
- Create `body-signal/src/utils/biometrics.ts`:
  - Implement WebAuthn platform authenticator (`navigator.credentials.create` & `navigator.credentials.get`).
  - Securely wrap/unwrap user PIN with device master key so that unlocking via biometric assertion recovers `activeSessionPin` for encrypted health data decryption.
  - On biometric prompt cancellation or failure, resolve `false` without throwing, smoothly falling back to PIN.
- Update `body-signal/src/context/AuthContext.tsx`:
  - Add `isBiometricAvailable`, `isBiometricEnabled`, `toggleBiometric()`, `unlockWithBiometric()`, `unlockWithPin()`.
  - Preserve all existing regex checks (e.g. `visibilitychange`, `AUTO_LOCK_TIMEOUT_MS = 60_000`, etc.).
- Update `body-signal/src/components/LockScreen.tsx`:
  - Slot in row 4 column 1: render `<button onClick={unlockWithBiometric}><Fingerprint size={28} /></button>` when `isBiometricEnabled && isBiometricAvailable`.
  - Auto-prompt biometric on screen mount if enabled.
- Update `body-signal/src/pages/Settings.tsx`:
  - Add biometric toggle switch under Security & App Lock section when PIN is set.

### F3: Ergonomic Keypad Redesign (`LockScreen.tsx` & `PinModal.tsx`)
- Keypad grid container: `w-full max-w-[320px] sm:max-w-[340px] place-items-center mb-6`.
- Replace non-existent `h-18 w-18` with valid standard Tailwind sizes:
  `flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60`.
- Delete button: `flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] ... active:scale-90 active:text-rose-400 active:bg-rose-500/15`.
- PIN dots: glowing emerald ring on input, glowing rose-red ring on error.

## Verification Requirements
Worker MUST run:
1. `npm --prefix body-signal run build` or `npx tsc --noEmit`
2. `npm --prefix body-signal test` (all 170 tests must pass)
3. Ensure zero regressions.

## Output Requirements
Write your handoff report to `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m1\handoff.md` and notify parent via `send_message`.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.


## 2026-11-07T02:37:29Z
[Message] timestamp=2026-11-07T02:37:29Z sender=c0c096b2-e043-4359-9001-d946fccdf4ac priority=MESSAGE_PRIORITY_HIGH content=You are worker_m1, operating in c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m1.
Your parent orchestrator is c0c096b2-e043-4359-9001-d946fccdf4ac.

Read the following instructions carefully:
1. Read ORIGINAL_REQUEST.md at:
   c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\ORIGINAL_REQUEST.md
2. Read PROJECT.md at:
   c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\PROJECT.md
3. Read your task assignment in DISPATCH.md at:
   c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\worker_m1\DISPATCH.md
4. Read the 3 Explorer handoff reports:
   - c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_1\handoff.md
   - c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_2\handoff.md
   - c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\explorer_m1_3\handoff.md
5. Implement Milestone 1 (F1, F2, F3) following your exclusive write ownership:
   - body-signal/src/components/PinModal.tsx
   - body-signal/src/components/LockScreen.tsx
   - body-signal/src/context/AuthContext.tsx
   - body-signal/src/utils/biometrics.ts (create)
   - body-signal/src/pages/Settings.tsx (auth section)
6. Run build and tests to verify:
   - npm --prefix body-signal run build
   - npm --prefix body-signal test
7. MANDATORY INTEGRITY WARNING:
   DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
8. Create progress.md in your working directory.
9. Write your handoff report to handoff.md and notify parent via send_message.
