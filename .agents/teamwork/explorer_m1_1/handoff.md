# Handoff Report: F1 Full-Bleed PIN Setup Modal Fix Strategy

**Author**: `explorer_m1_1` (Milestone 1: Authentication & Keypad UI Enhancement)  
**Date**: 2026-11-07  
**Status**: COMPLETE (Read-Only Investigation & Architectural Strategy)  
**Recipient**: Parent Orchestrator (`c0c096b2-e043-4359-9001-d946fccdf4ac`)

---

## 1. Observation

### 1.1 Root Cause in `PinModal.tsx`
- **File**: `body-signal/src/components/PinModal.tsx`
- **Lines 94–105**:
  ```tsx
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md px-4 animate-in fade-in duration-200">
      {mode !== 'unlock' && (
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X size={24} />
        </button>
      )}
  ```
- **Direct Defects Observed**:
  1. **5% Translucent Bleed-through**: `bg-slate-950/95 backdrop-blur-md` has an alpha channel of 0.95. On modern mobile displays (OLED/AMOLED with high contrast), the underlying light background of `SettingsPage` (`bg-slate-50`, `#f8fafc`) and bright header elements ("설정", card outlines) bleed through the blurred layer, creating a noticeable milky ghosting effect.
  2. **No Portal Mounting**: `PinModal` returns JSX directly into its parent's DOM subtree. In `Settings.tsx` (lines 690–701), `PinModal` is nested inside `<main className="flex-1 w-full max-w-md mx-auto">`.
  3. **Missing Full Viewport Bounds**: The container relies solely on `fixed inset-0` without explicit `w-screen`, `h-screen`, or `min-h-[100dvh]`. On mobile WebViews, dynamic URL bar collapsing, software navigation bar toggling, and keyboard events cause `inset-0` alone to jitter or leave subpixel gaps.
  4. **Status Bar & Notch Inset Collision**: The close button is hardcoded to `top-6 right-6` (24px). Android status bar insets (`env(safe-area-inset-top)`) on modern devices with punch holes or camera notches range between 32px and 48px, placing the close button directly over or uncomfortably close to the system status bar icons.
  5. **Background Scroll Bleed**: While `PinModal` is open, background scrolling on `document.body` is not locked, allowing users to scroll or bounce the underlying `SettingsPage` during touch interactions.

### 1.2 Contrast with `LockScreen.tsx`
- **File**: `body-signal/src/components/LockScreen.tsx`
- **Line 38**:
  ```tsx
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 px-4 text-white">
  ```
- `LockScreen.tsx` uses 100% solid opacity `bg-slate-950` (`#020617`, alpha 1.0) with zero backdrop blur. Furthermore, in `App.tsx` (line 23), `LockScreen` replaces the entire route tree (`if (!isUnlocked) return <LockScreen />;`), so no background page exists to bleed through.

### 1.3 System Environment & Safe Area Context
- **File**: `body-signal/src/index.css` (lines 13–16):
  ```css
  body {
    @apply min-h-full overflow-y-auto overscroll-none;
    padding-top: env(safe-area-inset-top);
  }
  ```
- **File**: `body-signal/index.html` (line 6):
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  ```
- `viewport-fit=cover` directs WebView rendering to the physical boundaries of the screen (under status bar and navigation pill). When an inline modal with `95%` opacity sits inside `body`, the top area exposes `body`'s background and padding.

---

## 2. Logic Chain

1. **Feedback Analysis**:
   - User feedback item 1 explicitly states: *"비밀번호 설정하는 화면이 휴대폰 화면에 꽉 차지 않고 위에 조금 비어서 이전 화면이 보여."* (The password setting screen does not fill the phone screen, leaving a gap at the top so that the previous screen is visible).
2. **Identification of Bleed Mechanism**:
   - In `PinModal.tsx:95`, `bg-slate-950/95 backdrop-blur-md` was intended as aesthetic glassmorphism, but in a security-critical PIN entry/setup modal, 5% transparency allows the bright white/slate-50 background and header of `SettingsPage` to show through.
   - To an end user, the blurred header text and icons at the top of the screen look like an unfilled gap where the previous screen is visible.
3. **Identification of Stacking & Layout Containment**:
   - In `Settings.tsx:691`, `PinModal` is rendered within `<main className="flex-1 w-full max-w-md mx-auto">`.
   - If an ancestor element has any CSS transform, filter, perspective, or containment, `position: fixed` ceases to be relative to the viewport and becomes trapped within that ancestor's box.
   - Moving the modal to `document.body` via `createPortal` completely isolates the modal from the component hierarchy, guaranteeing viewport-relative coordinate attachment.
4. **Mobile Viewport Robustness**:
   - `fixed inset-0` with `w-screen h-screen min-h-[100dvh]` guarantees full coverage across all mobile viewport dynamics (status bar, dynamic Android navigation bar, keyboard appearance).
5. **Safe-Area Inset Handling**:
   - Adding `pt-[max(1.5rem,env(safe-area-inset-top,0px))]` and `pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]` ensures modal content is centered and never overlaps native cutouts.
   - Relocating the close button to `top-[max(1.5rem,env(safe-area-inset-top,1.5rem))] right-[max(1.5rem,env(safe-area-inset-right,1.5rem))]` guarantees the `X` button remains accessible and distinct from system icons.
6. **Background Scroll & Touch Isolation**:
   - Setting `document.body.style.overflow = 'hidden'` and `touchAction = 'none'` when `isOpen` is true prevents rubber-banding and scroll leaking.

---

## 3. Caveats

1. **SSR / Headless Environment Safety**:
   - Direct calls to `createPortal(..., document.body)` will throw in a non-browser Node environment if `document` is undefined. We guard this with `typeof document !== 'undefined' ? createPortal(...) : modalContent`.
2. **F3 Keypad Styling Dependency**:
   - Keypad button dimensions (`h-18 w-18` defect) reside inside `PinModal.tsx` as well. Feature F3 (handled by `explorer_m1_3` and `worker_m1`) addresses the keypad buttons. The modal container modifications proposed here are completely decoupled and preserve the keypad subtree.
3. **No Changes Required in `Settings.tsx`**:
   - Because `PinModal` internally delegates its DOM rendering to `createPortal(..., document.body)`, no calling code in `Settings.tsx` or any future screen needs adjustment.

---

## 4. Conclusion & Actionable Implementation Plan

### 4.1 Target File: `body-signal/src/components/PinModal.tsx`

#### A. Add `createPortal` and `useEffect` Imports
```tsx
// Before:
import React, { useState } from 'react';
import { Lock, Delete, X, AlertCircle } from 'lucide-react';
import { triggerHaptic } from '../utils/native';

// After:
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Delete, X, AlertCircle } from 'lucide-react';
import { triggerHaptic } from '../utils/native';
```

#### B. Add Scroll Lock & Escape Key Hook
Inside `PinModal`:
```tsx
  // Lock background scrolling and handle Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode !== 'unlock') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, mode]);

  // Reset internal state when opened
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setFirstPin('');
      setStep('enter');
      setLocalError('');
    }
  }, [isOpen]);
```

#### C. Container Class Replacement (100% Solid Full-Bleed Portal)
Replace Line 94–105:
```tsx
  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 w-screen h-screen min-h-[100dvh] overflow-hidden select-none px-4 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]"
    >
      {mode !== 'unlock' && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="닫기"
          className="absolute top-[max(1.5rem,env(safe-area-inset-top,1.5rem))] right-[max(1.5rem,env(safe-area-inset-right,1.5rem))] p-2.5 rounded-full bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition-all z-10"
        >
          <X size={24} />
        </button>
      )}

      {/* Title ID for accessibility */}
      <div className="mb-8 text-center text-white">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-900 shadow-lg">
          <Lock size={30} className="text-emerald-400" />
        </div>
        <h2 id="pin-modal-title" className="text-xl font-bold tracking-wider">{displayTitle}</h2>
        <p className="mt-1 text-xs text-slate-400">데이터를 안전하게 암호화하여 보호합니다</p>
      </div>
      ...
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
```

---

## 5. Verification Method

### 5.1 Verification Commands
Execute in root workspace:
```powershell
# 1. Type check
cd body-signal
npx tsc --noEmit

# 2. Production Web Build
npm run build

# 3. Automated Test Suite
npm run test:data
npm run test:r2
npm run test

# 4. Capacitor Android Sync & Compile
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

### 5.2 Verification Checklist
- [ ] Open Settings (`/settings`), scroll down to the "보안 및 잠금" section, and tap "앱 잠금 (PIN)" toggle to trigger PIN setup.
- [ ] Verify that `PinModal` renders with a 100% solid, jet-black background (`#020617` / `bg-slate-950`). Zero white or blurred elements from `SettingsPage` must be visible anywhere on the screen.
- [ ] Verify the top edge of the modal fully extends beneath the device status bar without any gap or unpainted area.
- [ ] Verify the close button (`X`) is located at a safe distance below the status bar / punch hole notch (`env(safe-area-inset-top)`).
- [ ] Attempt to drag/scroll the screen: confirm the background `SettingsPage` is completely locked and does not scroll or rubber-band.
- [ ] In browser devtools, inspect the DOM tree: confirm `<div role="dialog">` is rendered as an immediate child of `<body>`, completely decoupled from `<div id="root">`.
- [ ] Tap the close button or press the `Escape` key: verify the modal closes cleanly, `document.body` scroll lock is removed, and `SettingsPage` remains fully interactive.

### 5.3 Invalidation Conditions
- If any element from `SettingsPage` remains visible or translucent through the modal background.
- If a white line or gap appears at the top of the mobile screen when the modal mounts.
- If `PinModal` is rendered inside `#root` rather than as a direct child of `<body>`.
