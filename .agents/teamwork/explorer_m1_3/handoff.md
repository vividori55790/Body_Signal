# Handoff Report: F3 (Keypad UI & Ergonomics Redesign)

**Author**: `explorer_m1_3`  
**Milestone**: Milestone 1 (M1)  
**Target Feature**: Feature 3 (F3) — Ergonomic Keypad Redesign  
**Related Requirements**: R1 (피드백 3: "비밀번호를 입력하는 키패드가 너무 못생기고 작게 만들어두었어")  
**Target Files Owned by M1**:
- `body-signal/src/components/LockScreen.tsx`
- `body-signal/src/components/PinModal.tsx`

---

## 1. Observation

### Observation 1.1: Verbatim Code in `body-signal/src/components/LockScreen.tsx`
Lines 76–108:
```tsx
      {/* Mobile Pad */}
      <div className="grid grid-cols-3 gap-4 max-w-[280px] w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            disabled={lockoutRemainingMs > 0}
            onClick={() => handleDigit(num)}
            className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-900/90 text-2xl font-bold border border-slate-800 shadow-md transition-all active:scale-90 active:bg-slate-700 disabled:opacity-30"
          >
            {num}
          </button>
        ))}

        <div />

        <button
          type="button"
          disabled={lockoutRemainingMs > 0}
          onClick={() => handleDigit('0')}
          className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-900/90 text-2xl font-bold border border-slate-800 shadow-md transition-all active:scale-90 active:bg-slate-700 disabled:opacity-30"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="flex h-18 w-18 items-center justify-center rounded-full text-slate-400 transition-all hover:text-white active:scale-90"
        >
          <Delete size={28} />
        </button>
      </div>
```

### Observation 1.2: Verbatim Code in `body-signal/src/components/PinModal.tsx`
Lines 140–171:
```tsx
      {/* Mobile Number Keypad */}
      <div className="grid grid-cols-3 gap-4 max-w-[280px] w-full text-white">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            disabled={lockoutRemainingMs > 0}
            onClick={() => handleDigit(num)}
            className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-800/80 text-2xl font-bold shadow-sm transition-all hover:bg-slate-700 active:scale-90 active:bg-emerald-500/20 disabled:opacity-40"
          >
            {num}
          </button>
        ))}

        <div />

        <button
          type="button"
          disabled={lockoutRemainingMs > 0}
          onClick={() => handleDigit('0')}
          className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-800/80 text-2xl font-bold shadow-sm transition-all hover:bg-slate-700 active:scale-90 active:bg-emerald-500/20 disabled:opacity-40"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="flex h-18 w-18 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-800 hover:text-white active:scale-90"
        >
          <Delete size={26} />
        </button>
      </div>
```

### Observation 1.3: `body-signal/tailwind.config.js` Spacing Scale
Lines 8–31 of `body-signal/tailwind.config.js`:
```js
  theme: {
    extend: {
      colors: {
        bg: '#f8fafc',
        surface: '#ffffff',
        primary: '#334155',
        secondary: '#64748b',
        border: '#e2e8f0',
        improved: '#10b981',
        worsened: '#f43f5e',
        stable: '#cbd5e1',
        pain: {
            low: '#fcd34d',
            high: '#f43f5e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
```
Notice that `spacing` or `height`/`width` is **NOT extended** in `tailwind.config.js`.

### Observation 1.4: Tailwind CSS v3 Default Spacing Specification
In Tailwind CSS v3, the default spacing scale defines:
- `14` = 3.5rem (56px)
- `16` = 4rem (64px)
- `20` = 5rem (80px)
- `24` = 6rem (96px)
`18` does **NOT** exist in the default spacing scale. Consequently, neither `.h-18` nor `.w-18` is generated in the compiled stylesheet.

### Observation 1.5: User Feedback #3 Verbatim Quote
From `body-signal/user_feedback/Feedback_2026-11-06.md`:
> `3. 비밀번호를 입력하는 키패드가 너무 못생기고 작게 만들어두었어.`
> (The keypad for entering password/PIN is too ugly and small.)

### Observation 1.6: Boundary & Ownership from `PROJECT.md`
`PROJECT.md` Table "Milestone File Boundaries":
- `M1: Auth & UI` has exclusive write ownership of:
  - `body-signal/src/components/PinModal.tsx`
  - `body-signal/src/components/LockScreen.tsx`
  - `body-signal/src/context/AuthContext.tsx`
  - `body-signal/src/utils/biometrics.ts`
  - `body-signal/src/pages/Settings.tsx` (auth section)
- `M2: System & A11y` owns `tailwind.config.js` and `index.css`.
Therefore, M1 changes must NOT modify `tailwind.config.js` to add `18`. All styles must be fully supported by default Tailwind utilities.

---

## 2. Logic Chain

1. **Root Cause Analysis (Observations 1.1, 1.2, 1.3, 1.4)**:
   Because `h-18` and `w-18` are invalid utility classes in Tailwind v3 and are not extended in `tailwind.config.js`, Tailwind outputs zero CSS rules for them. When rendered in the browser, the keypad buttons have no explicit `width` or `height` properties. They collapse vertically to the intrinsic line-height of the text glyphs (~32px), resulting in squashed, flattened, or misshapen pill-like shapes instead of circular buttons.
2. **Container Width Restriction (Observations 1.1, 1.2)**:
   The container width is hardcoded to `max-w-[280px]`. On standard modern smartphone viewports (typically 360px–412px width), this leaves an excessive margin (~80px–130px empty gutters), forcing buttons to be crowded together. This increases accidental tap error rates (Fitts's Law violation).
3. **Android Accessibility & Ergonomics Standards**:
   According to Android Material Design accessibility specifications and WCAG 2.1 (Target Size AAA / AA):
   - Minimum interactive touch target: **48dp × 48dp**.
   - Recommended numeric keypad touch target: **64dp to 72dp**.
   Replacing the invalid `h-18 w-18` with `h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square rounded-full` guarantees a minimum 64px physical diameter on all devices, scaling up to 80px on tablets/larger displays.
4. **Container Expansion**:
   Expanding the keypad grid container from `max-w-[280px]` to `w-full max-w-[320px] sm:max-w-[340px] place-items-center` provides the ideal horizontal spacing (`gap-x-6 gap-y-4`) for 64px–80px buttons without crowding.
5. **Aesthetic & Visual Feedback Refinement**:
   - Digit buttons: Use high-contrast dark theme `bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 text-slate-100 text-2xl sm:text-3xl font-bold shadow-lg`.
   - Active state: Replace `active:bg-slate-700` with `active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60` (Bignal's signature medical emerald brand color), providing instant tactile and visual confirmation on touch.
   - Delete button: Elevate from an unbordered text icon to a dedicated circular touch target identical in dimensions (`h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px]`), with `active:scale-90 active:text-rose-400 active:bg-rose-500/15` for clear destructive action feedback.
   - PIN Progress Indicator (Dots): Increase dot diameter (`h-4 w-4 sm:h-5 sm:w-5`) with glowing emerald ring on input (`scale-110 bg-emerald-400 border-2 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]`), and glowing rose-red ring on error/lockout (`scale-110 bg-rose-500 border-2 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.9)]`).
6. **Architectural Boundary Adherence (Observation 1.6)**:
   By utilizing standard default Tailwind classes (`w-16 h-16 sm:w-20 sm:h-20 min-w-[64px] min-h-[64px]`), the implementation remains strictly contained inside `LockScreen.tsx` and `PinModal.tsx` without modifying `tailwind.config.js` (owned by M2).

---

## 3. Caveats

1. **Dependency on F2 (Biometric Passkey Unlock)**:
   In `LockScreen.tsx`, bottom-left slot (column 1, row 4) is currently an empty `<div />`. Feature 2 introduces biometric authentication. When biometric authentication is active, this slot will render a biometric trigger button (`<Fingerprint size={28} />`). When inactive or unconfigured, it must render a placeholder element of identical dimensions (`w-16 h-16 sm:w-20 sm:h-20 min-w-[64px] min-h-[64px]`) to maintain 3x4 grid symmetry.
2. **Haptic Feedback**:
   Every digit and delete touch invokes `triggerHaptic()`. M2 (F13) introduces a centralized guard in `triggerHaptic()` to honor system vibration settings. F3 must retain these invocations without alteration.
3. **Android Gesture Pill Safe Area**:
   On devices with Android gesture navigation enabled, buttons at the very bottom can trigger the home bar. A bottom margin (`mb-8` or safe-area bottom padding) must be preserved in both `LockScreen.tsx` and `PinModal.tsx`.

---

## 4. Conclusion & Concrete Implementation Proposal

### Proposed Code Changes for `body-signal/src/components/LockScreen.tsx`

#### A. PIN Dots Enhancement (Lines 47–59):
```tsx
      {/* PIN dots */}
      <div className="mb-6 flex gap-4 sm:gap-5 justify-center">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full transition-all duration-200 ${
              errorMsg || lockoutRemainingMs > 0
                ? 'scale-110 bg-rose-500 border-2 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.9)]'
                : pin.length > i
                ? 'scale-110 bg-emerald-400 border-2 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                : 'border-2 border-slate-700 bg-slate-900/80'
            }`}
          />
        ))}
      </div>
```

#### B. Ergonomic Keypad Grid (Lines 76–108):
```tsx
      {/* Mobile Pad */}
      <div
        role="group"
        aria-label="PIN 입력 키패드"
        className="grid grid-cols-3 gap-y-4 gap-x-6 w-full max-w-[320px] sm:max-w-[340px] place-items-center mb-6"
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            aria-label={`숫자 ${num}`}
            disabled={lockoutRemainingMs > 0}
            onClick={() => handleDigit(num)}
            className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-slate-700 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
          >
            {num}
          </button>
        ))}

        {/* Slot 1: Biometric button slot (F2 hook) or spacer */}
        <div className="h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px]" />

        {/* Slot 2: Digit 0 */}
        <button
          type="button"
          aria-label="숫자 0"
          disabled={lockoutRemainingMs > 0}
          onClick={() => handleDigit('0')}
          className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-slate-700 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
        >
          0
        </button>

        {/* Slot 3: Delete / Backspace */}
        <button
          type="button"
          aria-label="한 글자 지우기"
          onClick={handleDelete}
          className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:text-slate-200 hover:bg-slate-900/60 active:scale-90 active:text-rose-400 active:bg-rose-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Delete size={28} />
        </button>
      </div>
```

---

### Proposed Code Changes for `body-signal/src/components/PinModal.tsx`

#### A. PIN Dots Enhancement (Lines 116–127):
```tsx
      {/* 4 Dots Indicator */}
      <div className="mb-4 flex gap-4 sm:gap-5 justify-center">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full transition-all duration-200 ${
              localError
                ? 'scale-110 bg-rose-500 border-2 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.9)]'
                : pin.length > i
                ? 'scale-110 bg-emerald-400 border-2 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                : 'border-2 border-slate-700 bg-slate-900/80'
            }`}
          />
        ))}
      </div>
```

#### B. Ergonomic Keypad Grid (Lines 140–171):
```tsx
      {/* Mobile Number Keypad */}
      <div
        role="group"
        aria-label="PIN 입력 키패드"
        className="grid grid-cols-3 gap-y-4 gap-x-6 w-full max-w-[320px] sm:max-w-[340px] place-items-center text-white mb-6"
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            aria-label={`숫자 ${num}`}
            disabled={lockoutRemainingMs > 0}
            onClick={() => handleDigit(num)}
            className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-slate-700 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
          >
            {num}
          </button>
        ))}

        {/* Slot 1: Spacer */}
        <div className="h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px]" />

        {/* Slot 2: Digit 0 */}
        <button
          type="button"
          aria-label="숫자 0"
          disabled={lockoutRemainingMs > 0}
          onClick={() => handleDigit('0')}
          className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-slate-700 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
        >
          0
        </button>

        {/* Slot 3: Delete */}
        <button
          type="button"
          aria-label="한 글자 지우기"
          onClick={handleDelete}
          className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:text-slate-200 hover:bg-slate-900/60 active:scale-90 active:text-rose-400 active:bg-rose-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Delete size={28} />
        </button>
      </div>
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Automated E2E Suite Run**:
   ```bash
   npm --prefix body-signal test
   ```
   Ensures all 170 tests across Tiers 1–4 pass with zero regressions.
2. **Build and Bundler Verification**:
   ```bash
   npm --prefix body-signal run build
   ```
   Confirms Tailwind generates the correct `.w-16`, `.h-16`, `.min-w-[64px]`, `.min-h-[64px]` CSS classes and Vite completes bundling with no syntax or type errors.

### 5.2 Source Code Inspection Checks
- Execute `git grep "h-18"` in `body-signal/src/`. Verification passes when grep returns **0 results**.
- Verify `body-signal/src/components/LockScreen.tsx` contains `min-w-[64px]` and `max-w-[320px]`.
- Verify `body-signal/src/components/PinModal.tsx` contains `min-w-[64px]` and `max-w-[320px]`.

### 5.3 Invalidation Conditions
- If buttons measure less than 48dp on any viewport, or if buttons appear distorted (non-1:1 aspect ratio), the implementation is invalid.
- If `tailwind.config.js` is modified by M1, boundary compliance is invalidated (as `tailwind.config.js` is owned by M2).
