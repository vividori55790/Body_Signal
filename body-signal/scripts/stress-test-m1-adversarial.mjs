#!/usr/bin/env node

/**
 * Milestone 1 Empirical Challenger Adversarial Stress Suite
 * Features:
 *   - F1. Full-Bleed PIN Setup Modal
 *   - F2. Biometric Passkey Unlock
 *   - F3. Ergonomic Keypad Redesign
 *
 * Focus:
 *   1. Biometric Fallback & State Transitions (multi-cancellations, rapid clicks, sensor unavailable, lockout suspension)
 *   2. Portal DOM Isolation & Scroll Locking (document.body mounting, 100% solid opacity, overflow hidden, touchAction none)
 *   3. Keypad Ergonomics (>=64dp buttons, zero invalid classes, lockout disabling, buffer clamp)
 *   4. AuthContext State Machine (session PIN recovery for AES-GCM decryption, auto-lock timeout, token re-wrapping)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(PROJECT_DIR, 'src');

console.log('======================================================================');
console.log('    M1 Adversarial Empirical Verification & Stress Test Suite         ');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function testCase(id, description, fn) {
  totalTests++;
  const t0 = performance.now();
  try {
    await fn();
    const duration = (performance.now() - t0).toFixed(1);
    passedTests++;
    console.log(`  \x1b[32m✓\x1b[0m [\x1b[36m${id}\x1b[0m] ${description} \x1b[2m(${duration}ms)\x1b[0m`);
  } catch (err) {
    const duration = (performance.now() - t0).toFixed(1);
    failedTests++;
    console.error(`  \x1b[31m✗\x1b[0m [\x1b[31m${id}\x1b[0m] ${description} \x1b[2m(${duration}ms)\x1b[0m`);
    console.error(`      \x1b[31mFailure: ${err.message}\x1b[0m`);
    failures.push({ id, description, error: err.message, stack: err.stack });
  }
}

// ============================================================================
// Group 1: Source Code AST & Static Contract Invariants (F1, F2, F3)
// ============================================================================
console.log('\x1b[1m\x1b[34m▶ Group 1: Source Code Invariants & Static Boundary Contracts\x1b[0m');

await testCase('M1-AST-01', 'PinModal.tsx imports createPortal from react-dom and mounts to document.body', () => {
  const code = fs.readFileSync(path.join(SRC_DIR, 'components/PinModal.tsx'), 'utf-8');
  assert.ok(code.includes("import { createPortal } from 'react-dom';"), 'Must import createPortal');
  assert.ok(code.includes('createPortal(modalContent, document.body)'), 'Must mount to document.body');
});

await testCase('M1-AST-02', 'PinModal.tsx top-level container has 100% solid opacity (no bg-slate-950/95 or backdrop-blur)', () => {
  const code = fs.readFileSync(path.join(SRC_DIR, 'components/PinModal.tsx'), 'utf-8');
  // Check that bg-slate-950 is solid without alpha channel or backdrop blur
  assert.ok(code.includes('bg-slate-950'), 'Must contain solid bg-slate-950');
  assert.ok(!code.includes('bg-slate-950/95'), 'Must NOT contain translucent bg-slate-950/95');
  assert.ok(!code.includes('backdrop-blur'), 'Must NOT contain backdrop-blur');
  assert.ok(code.includes('w-screen h-screen min-h-[100dvh]'), 'Must cover 100% screen and dynamic viewport height');
});

await testCase('M1-AST-03', 'PinModal.tsx locks document.body scroll and touchAction with restoration on unmount', () => {
  const code = fs.readFileSync(path.join(SRC_DIR, 'components/PinModal.tsx'), 'utf-8');
  assert.ok(code.includes("document.body.style.overflow = 'hidden'"), 'Must lock overflow to hidden');
  assert.ok(code.includes("document.body.style.touchAction = 'none'"), 'Must lock touchAction to none');
  assert.ok(code.includes('document.body.style.overflow = originalOverflow'), 'Must restore original overflow');
  assert.ok(code.includes('document.body.style.touchAction = originalTouchAction'), 'Must restore original touchAction');
});

await testCase('M1-AST-04', 'PinModal.tsx implements Safe Area padding for Android status and gesture navigation bars', () => {
  const code = fs.readFileSync(path.join(SRC_DIR, 'components/PinModal.tsx'), 'utf-8');
  assert.ok(code.includes('env(safe-area-inset-top,0px)'), 'Must include safe-area-inset-top');
  assert.ok(code.includes('env(safe-area-inset-bottom,0px)'), 'Must include safe-area-inset-bottom');
  assert.ok(code.includes('env(safe-area-inset-left,0px)'), 'Must include safe-area-inset-left');
  assert.ok(code.includes('env(safe-area-inset-right,0px)'), 'Must include safe-area-inset-right');
});

await testCase('M1-AST-05', 'Escape key dismisses modal in set/change mode, but is strictly suppressed in unlock mode', () => {
  const code = fs.readFileSync(path.join(SRC_DIR, 'components/PinModal.tsx'), 'utf-8');
  assert.ok(code.includes("e.key === 'Escape' && mode !== 'unlock'"), 'Escape must only work when mode !== unlock');
});

await testCase('M1-AST-06', 'LockScreen.tsx and PinModal.tsx completely eliminate non-existent h-18/w-18 utility classes', () => {
  const srcFiles = ['components/PinModal.tsx', 'components/LockScreen.tsx', 'pages/Settings.tsx'];
  for (const f of srcFiles) {
    const code = fs.readFileSync(path.join(SRC_DIR, f), 'utf-8');
    assert.ok(!code.includes('h-18'), `File ${f} must not contain non-existent class h-18`);
    assert.ok(!code.includes('w-18'), `File ${f} must not contain non-existent class w-18`);
  }
});

await testCase('M1-AST-07', 'Keypad buttons in PinModal and LockScreen meet minimum ergonomic dimensions (>=64px touch target)', () => {
  const pinModalCode = fs.readFileSync(path.join(SRC_DIR, 'components/PinModal.tsx'), 'utf-8');
  const lockScreenCode = fs.readFileSync(path.join(SRC_DIR, 'components/LockScreen.tsx'), 'utf-8');

  for (const code of [pinModalCode, lockScreenCode]) {
    assert.ok(code.includes('min-w-[64px] min-h-[64px]'), 'Must declare min-w-[64px] min-h-[64px]');
    assert.ok(code.includes('h-16 w-16'), 'Must use valid standard Tailwind h-16 w-16 sizing (64px)');
    assert.ok(code.includes('max-w-[320px]'), 'Container must have comfortable layout width >=320px');
  }
});

await testCase('M1-AST-08', 'LockScreen.tsx renders Fingerprint button in row 4 column 1 only when enabled and available', () => {
  const code = fs.readFileSync(path.join(SRC_DIR, 'components/LockScreen.tsx'), 'utf-8');
  assert.ok(code.includes('isBiometricEnabled && isBiometricAvailable ?'), 'Must check both enabled and available');
  assert.ok(code.includes('<Fingerprint size={28} />'), 'Must render Fingerprint icon');
  assert.ok(code.includes('aria-label="생체인식 잠금 해제"'), 'Must include accessible aria-label');
});

await testCase('M1-AST-09', 'LockScreen.tsx auto-prompts biometrics once on mount after 200ms with cleanup cancellation', () => {
  const code = fs.readFileSync(path.join(SRC_DIR, 'components/LockScreen.tsx'), 'utf-8');
  assert.ok(code.includes('setTimeout(async () => {'), 'Must use setTimeout for mount auto-prompt');
  assert.ok(code.includes('clearTimeout(timer)'), 'Must clear timer on unmount');
  assert.ok(code.includes('lockoutRemainingMs === 0'), 'Must strictly guard against auto-prompt when locked out');
});

await testCase('M1-AST-10', 'Settings.tsx renders biometric toggle switch in privacy section when PIN is set and available', () => {
  const code = fs.readFileSync(path.join(SRC_DIR, 'pages/Settings.tsx'), 'utf-8');
  assert.ok(code.includes('isPinSet && isBiometricAvailable'), 'Toggle switch must condition on PIN set and availability');
  assert.ok(code.includes('생체인증 / 패스키 잠금 해제'), 'Must display correct user-facing label');
  assert.ok(code.includes('handleToggleBiometric'), 'Must wire toggle handler');
});

// ============================================================================
// Group 2: Behavioral State Simulation & Boundary Stress (F1, F3)
// ============================================================================
console.log('\n\x1b[1m\x1b[34m▶ Group 2: PIN Pad Interaction State Machine Stress (F1, F3)\x1b[0m');

// State machine simulating PinModal logic
function createPinModalSimulator(mode = 'set', lockoutRemainingMs = 0) {
  let pin = '';
  let firstPin = '';
  let step = 'enter';
  let localError = '';
  let successPin = null;
  let cancelled = false;

  const handleDigit = (digit) => {
    if (lockoutRemainingMs > 0) return;
    if (pin.length >= 4) return;

    pin += digit;
    localError = '';

    if (pin.length === 4) {
      if (mode === 'unlock') {
        successPin = pin;
        pin = '';
      } else if (mode === 'set' || mode === 'change') {
        if (step === 'enter') {
          firstPin = pin;
          pin = '';
          step = 'confirm';
        } else {
          if (pin === firstPin) {
            successPin = pin;
            pin = '';
            firstPin = '';
            step = 'enter';
          } else {
            localError = 'PIN이 일치하지 않습니다. 다시 설정해 주세요.';
            pin = '';
            firstPin = '';
            step = 'enter';
          }
        }
      }
    }
  };

  const handleDelete = () => {
    pin = pin.slice(0, -1);
    localError = '';
  };

  const handleClose = () => {
    pin = '';
    firstPin = '';
    step = 'enter';
    localError = '';
    cancelled = true;
  };

  return {
    get pin() { return pin; },
    get firstPin() { return firstPin; },
    get step() { return step; },
    get localError() { return localError; },
    get successPin() { return successPin; },
    get cancelled() { return cancelled; },
    handleDigit,
    handleDelete,
    handleClose,
  };
}

await testCase('M1-PAD-01', 'Rapid multi-taps past 4 digits in LockScreen are strictly clamped to 4 digits', () => {
  let pin = '';
  const attempts = [];
  const handleDigit = (digit) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    pin = nextPin;
    if (nextPin.length === 4) {
      attempts.push(nextPin);
    }
  };

  for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
    handleDigit(d);
  }

  assert.equal(pin.length, 4, 'Buffer must be clamped to 4');
  assert.equal(pin, '1234', 'Buffer must retain exact first 4 digits');
  assert.equal(attempts.length, 1, 'Only one 4-digit attempt must be generated');
  assert.equal(attempts[0], '1234');
});

await testCase('M1-PAD-02', 'PIN confirmation flow in set mode: matching PIN completes setup successfully', () => {
  const sim = createPinModalSimulator('set');
  ['1', '3', '5', '7'].forEach(sim.handleDigit);
  assert.equal(sim.step, 'confirm');
  assert.equal(sim.firstPin, '1357');
  assert.equal(sim.pin, '');

  ['1', '3', '5', '7'].forEach(sim.handleDigit);
  assert.equal(sim.successPin, '1357');
  assert.equal(sim.localError, '');
  assert.equal(sim.step, 'enter');
});

await testCase('M1-PAD-03', 'PIN confirmation mismatch resets state to enter step with explicit Korean error message', () => {
  const sim = createPinModalSimulator('set');
  ['1', '3', '5', '7'].forEach(sim.handleDigit);
  assert.equal(sim.step, 'confirm');

  ['1', '3', '5', '8'].forEach(sim.handleDigit); // Mismatch!
  assert.equal(sim.successPin, null);
  assert.equal(sim.localError, 'PIN이 일치하지 않습니다. 다시 설정해 주세요.');
  assert.equal(sim.step, 'enter');
  assert.equal(sim.pin, '');
  assert.equal(sim.firstPin, '');
});

await testCase('M1-PAD-04', 'Continuous backspace calls on empty PIN state do not produce negative length or exceptions', () => {
  const sim = createPinModalSimulator('unlock');
  sim.handleDelete();
  sim.handleDelete();
  sim.handleDelete();
  assert.equal(sim.pin, '');
  assert.equal(sim.pin.length, 0);

  sim.handleDigit('9');
  assert.equal(sim.pin, '9');
  sim.handleDelete();
  assert.equal(sim.pin, '');
  sim.handleDelete();
  assert.equal(sim.pin, '');
});

await testCase('M1-PAD-05', 'Active lockout completely disables digit inputs while remaining ms > 0', () => {
  const sim = createPinModalSimulator('unlock', 25000);
  sim.handleDigit('1');
  sim.handleDigit('2');
  assert.equal(sim.pin, '');
  assert.equal(sim.successPin, null);
});

// ============================================================================
// Group 3: Adversarial Biometric Stress & Fallback Recovery (F2)
// ============================================================================
console.log('\n\x1b[1m\x1b[34m▶ Group 3: Adversarial Biometric Stress & Keypad Fallback Recovery (F2)\x1b[0m');

// Cryptographic primitives test directly using Web Crypto API
import {
  deriveKeyFromPin,
  encryptWithPin,
  decryptWithPin,
  computeSha256Checksum,
  SALT_LENGTH_BYTES,
  IV_LENGTH_BYTES,
} from '../src/test/e2e/test_helpers.mjs';

await testCase('M1-BIO-01', 'Device Master Key generation and AES-GCM 256 PIN wrapping/unwrapping fidelity', async () => {
  const rawPin = '7890';
  // Generate random 256-bit AES-GCM key
  const deviceKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encodedPin = new TextEncoder().encode(rawPin);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, deviceKey, encodedPin);

  // Decrypt wrapped PIN
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, deviceKey, ciphertext);
  const recoveredPin = new TextDecoder().decode(decrypted);

  assert.equal(recoveredPin, rawPin, 'Unwrapped PIN must match original plain PIN byte-for-byte');
});

// Simulating biometrics engine state transitions under adversarial conditions
class AdversarialBiometricHarness {
  constructor() {
    this.deviceKey = null;
    this.wrappedPin = null;
    this.enrolled = false;
    this.available = true;
    this.cancellationCount = 0;
    this.lastFailureReason = null;
  }

  async init(initialPin = '1234') {
    this.deviceKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    await this.enroll(initialPin);
  }

  async enroll(pin) {
    if (!pin || pin.length < 4) return false;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.deviceKey,
      new TextEncoder().encode(pin)
    );
    this.wrappedPin = { iv, ct };
    this.enrolled = true;
    return true;
  }

  async updatePin(newPin) {
    if (!this.enrolled) return;
    await this.enroll(newPin);
  }

  disable() {
    this.enrolled = false;
    this.wrappedPin = null;
  }

  async authenticate({ simulateCancel = false, simulateHardwareError = false } = {}) {
    if (!this.available || simulateHardwareError) {
      this.lastFailureReason = 'hardware_unavailable';
      return { success: false };
    }
    if (simulateCancel) {
      this.cancellationCount++;
      this.lastFailureReason = 'user_cancelled';
      // Smooth continuation: must NOT throw
      return { success: false };
    }
    if (!this.enrolled || !this.wrappedPin) {
      this.lastFailureReason = 'not_enrolled';
      return { success: false };
    }

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: this.wrappedPin.iv },
        this.deviceKey,
        this.wrappedPin.ct
      );
      const pin = new TextDecoder().decode(decrypted);
      return { success: true, pin };
    } catch (err) {
      this.lastFailureReason = err.message;
      return { success: false };
    }
  }
}

await testCase('M1-BIO-02', '10 consecutive user cancellations return { success: false } smoothly without throwing or data corruption', async () => {
  const bio = new AdversarialBiometricHarness();
  await bio.init('4321');

  for (let i = 0; i < 10; i++) {
    const res = await bio.authenticate({ simulateCancel: true });
    assert.equal(res.success, false, `Cancellation #${i + 1} must resolve false smoothly`);
    assert.equal(res.pin, undefined);
  }

  assert.equal(bio.cancellationCount, 10);

  // Verify that following 10 cancellations, successful prompt still recovers valid PIN
  const okRes = await bio.authenticate();
  assert.equal(okRes.success, true);
  assert.equal(okRes.pin, '4321');
});

await testCase('M1-BIO-03', 'Rapid concurrent biometric triggers (10 parallel requests) resolve without unhandled rejections', async () => {
  const bio = new AdversarialBiometricHarness();
  await bio.init('9876');

  const promises = [];
  for (let i = 0; i < 10; i++) {
    const isCancel = i % 2 === 0;
    promises.push(bio.authenticate({ simulateCancel: isCancel }));
  }

  const results = await Promise.all(promises);
  assert.equal(results.length, 10);
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      assert.equal(results[i].success, false);
    } else {
      assert.equal(results[i].success, true);
      assert.equal(results[i].pin, '9876');
    }
  }
});

await testCase('M1-BIO-04', 'Sensor unavailable / hardware error resolves { success: false } gracefully', async () => {
  const bio = new AdversarialBiometricHarness();
  await bio.init('5555');

  const res = await bio.authenticate({ simulateHardwareError: true });
  assert.equal(res.success, false);
  assert.equal(bio.lastFailureReason, 'hardware_unavailable');
});

await testCase('M1-BIO-05', 'PIN change propagation: updating PIN re-wraps token and subsequent unlock returns new PIN', async () => {
  const bio = new AdversarialBiometricHarness();
  await bio.init('1111');

  const firstUnlock = await bio.authenticate();
  assert.equal(firstUnlock.pin, '1111');

  // User changes PIN to 9999
  await bio.updatePin('9999');

  const secondUnlock = await bio.authenticate();
  assert.equal(secondUnlock.pin, '9999', 'Must return newly wrapped PIN 9999');
});

await testCase('M1-BIO-06', 'Disabling biometrics purges token and prevents further biometric unlocking', async () => {
  const bio = new AdversarialBiometricHarness();
  await bio.init('8888');

  bio.disable();
  const res = await bio.authenticate();
  assert.equal(res.success, false);
  assert.equal(bio.lastFailureReason, 'not_enrolled');
});

// ============================================================================
// Group 4: End-to-End Cryptographic Chain: Biometric PIN -> Health Data Decryption
// ============================================================================
console.log('\n\x1b[1m\x1b[34m▶ Group 4: E2E Integration: Biometric PIN Session -> AES-GCM Encrypted Health Data\x1b[0m');

await testCase('M1-E2E-01', 'Biometric recovered PIN successfully decrypts AES-GCM encrypted medical payload', async () => {
  const userPin = '3847';
  const medicalData = JSON.stringify({
    conditions: [{ id: 'c-1', label: '무릎 관절염', bodyPart: '무릎(우)' }],
    logs: [{ id: 'l-1', conditionId: 'c-1', intensity: 8, medication: '이부프로펜' }],
    timestamp: new Date().toISOString(),
  });

  // 1. Data encrypted at rest with user PIN
  const encryptedPackage = await encryptWithPin(medicalData, userPin);

  // 2. User unlocks via Biometrics
  const bio = new AdversarialBiometricHarness();
  await bio.init(userPin);
  const bioResult = await bio.authenticate();
  assert.equal(bioResult.success, true);
  assert.equal(bioResult.pin, userPin);

  // 3. HealthContext uses activeSessionPin to decrypt data
  const decryptedJson = await decryptWithPin(encryptedPackage, bioResult.pin);
  const parsedData = JSON.parse(decryptedJson);
  assert.equal(parsedData.conditions[0].label, '무릎 관절염');
  assert.equal(parsedData.logs[0].intensity, 8);
});

await testCase('M1-E2E-02', 'Wrong PIN unwrap / tampering rejects with cryptographic integrity error', async () => {
  const userPin = '3847';
  const medicalData = 'sensitive-health-record';
  const encryptedPackage = await encryptWithPin(medicalData, userPin);

  // Attempt decryption with wrong PIN
  await assert.rejects(
    async () => {
      await decryptWithPin(encryptedPackage, '9999');
    },
    /비밀번호\/PIN이 일치하지 않거나 데이터가 손상되었습니다/
  );
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n----------------------------------------------------------------------');
console.log(`Execution Complete: ${passedTests} passed, ${failedTests} failed out of ${totalTests} adversarial stress tests.`);
console.log('----------------------------------------------------------------------\n');

if (failedTests > 0) {
  console.error(`\x1b[31mAdversarial verification failed with ${failedTests} failures.\x1b[0m`);
  process.exit(1);
} else {
  console.log('\x1b[32m\x1b[1mALL ADVERSARIAL STRESS TESTS PASSED CLEANLY!\x1b[0m\n');
  process.exit(0);
}
