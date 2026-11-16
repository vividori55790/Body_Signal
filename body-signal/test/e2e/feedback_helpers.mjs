/**
 * Test Helpers and Environment Simulators for Bignal Feedback 14 Features (F1 - F14)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Re-export common crypto and storage helpers from baseline
export {
  PROJECT_DIR,
  REPO_ROOT,
  SRC_DIR,
  ANDROID_DIR,
  APK_PATH,
  computeSha256Checksum,
  deriveKeyFromPin,
  encryptWithPin,
  decryptWithPin,
  canonicalSignPainRecord,
  InMemoryHealthStorage,
  inspectApkEntries,
} from '../../src/test/e2e/test_helpers.mjs';

/**
 * Mock Biometric Service (Simulates Native Biometrics / Passkeys)
 */
export class MockBiometricService {
  constructor(options = {}) {
    this.hardwareAvailable = options.hardwareAvailable ?? true;
    this.enrolled = options.enrolled ?? true;
    this.failCount = 0;
    this.lastPromptMessage = null;
    this.forceResult = options.forceResult ?? null; // true, false, or 'cancel'
  }

  async isAvailable() {
    return this.hardwareAvailable && this.enrolled;
  }

  async authenticate(promptMessage = '지문 또는 얼굴로 인증해 주세요') {
    this.lastPromptMessage = promptMessage;
    if (!this.hardwareAvailable || !this.enrolled) {
      throw new Error('생체 인식 하드웨어를 사용할 수 없습니다.');
    }
    if (this.forceResult === 'cancel') {
      return { success: false, reason: 'user_cancel' };
    }
    if (this.forceResult === false) {
      this.failCount++;
      return { success: false, reason: 'auth_failed' };
    }
    return { success: true };
  }
}

/**
 * Mock Theme Environment (Simulates OS prefers-color-scheme matchMedia)
 */
export class MockThemeEnvironment {
  constructor(initialDark = false) {
    this.isDark = initialDark;
    this.listeners = new Set();
    this.rootClasses = new Set(initialDark ? ['dark'] : []);
  }

  matchMedia(query) {
    const isDarkQuery = query.includes('prefers-color-scheme: dark');
    return {
      matches: isDarkQuery ? this.isDark : !this.isDark,
      media: query,
      addEventListener: (event, handler) => {
        if (event === 'change') this.listeners.add(handler);
      },
      removeEventListener: (event, handler) => {
        if (event === 'change') this.listeners.delete(handler);
      },
    };
  }

  setSystemTheme(isDark) {
    if (this.isDark !== isDark) {
      this.isDark = isDark;
      const event = { matches: isDark, media: '(prefers-color-scheme: dark)' };
      for (const listener of this.listeners) {
        listener(event);
      }
    }
  }

  applyTheme(theme) {
    const shouldBeDark =
      theme === 'dark' || (theme === 'system' && this.isDark);
    if (shouldBeDark) {
      this.rootClasses.add('dark');
    } else {
      this.rootClasses.delete('dark');
    }
  }
}

/**
 * Mock Haptics Spy (Verifies strict vibration suppression)
 */
export class MockHapticsSpy {
  constructor() {
    this.calls = [];
    this.vibrateCalls = [];
    this.enabled = true;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  async triggerHaptic(style = 'Light') {
    if (!this.enabled) {
      // Guarded: zero native or web invocation
      return;
    }
    this.calls.push({ style, timestamp: Date.now() });
  }

  recordVibrate(duration) {
    if (!this.enabled) return;
    this.vibrateCalls.push({ duration, timestamp: Date.now() });
  }

  clear() {
    this.calls = [];
    this.vibrateCalls = [];
  }
}

/**
 * Department Classification Oracle & Rules
 */
export const DEPARTMENT_KEYS = {
  ORTHOPEDICS: '정형외과 / 재활의학과',
  NEUROLOGY: '신경과 / 신경외과',
  GASTROENTEROLOGY: '소화기내과',
  INTERNAL_MEDICINE: '일반내과 / 기타 진료과',
};

export function classifyAnatomicalPart(partName) {
  if (!partName) return DEPARTMENT_KEYS.INTERNAL_MEDICINE;
  const lower = partName.toLowerCase();

  // Head, Neuropathy, Radiating pain -> Neurology / Neurosurgery
  // (Check first so neurological extremity symptoms like '팔 저림' or '다리 방사통' map to Neurology)
  if (
    lower.includes('머리') ||
    lower.includes('두통') ||
    lower.includes('안면') ||
    lower.includes('신경') ||
    lower.includes('저림') ||
    lower.includes('방사통') ||
    lower.includes('어지럼') ||
    lower.includes('뇌')
  ) {
    return DEPARTMENT_KEYS.NEUROLOGY;
  }

  // Abdomen, Stomach, Digestive tract -> Gastroenterology
  if (
    lower.includes('복부') ||
    lower.includes('위장') ||
    lower.includes('위경련') ||
    lower.includes('체함') ||
    lower.includes('속쓰림') ||
    lower.includes('복통') ||
    lower.includes('배/') ||
    lower.includes('소화')
  ) {
    return DEPARTMENT_KEYS.GASTROENTEROLOGY;
  }

  // Spine, Joints, Extremities -> Orthopedics / Physiatry
  if (
    lower.includes('허리') ||
    lower.includes('목(앞)') ||
    lower.includes('목(뒤)') ||
    lower.includes('목/경추') ||
    lower.includes('어깨') ||
    lower.includes('무릎') ||
    lower.includes('팔') ||
    lower.includes('손') ||
    lower.includes('발') ||
    lower.includes('골반') ||
    lower.includes('허벅지') ||
    lower.includes('종아리') ||
    lower.includes('척추') ||
    lower.includes('디스크') ||
    lower.includes('관절')
  ) {
    return DEPARTMENT_KEYS.ORTHOPEDICS;
  }

  // Fallback -> Internal Medicine / Other
  return DEPARTMENT_KEYS.INTERNAL_MEDICINE;
}

export function parseMultiRegionParts(bodyPartStr) {
  if (!bodyPartStr || typeof bodyPartStr !== 'string') return [];
  return bodyPartStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatMultiRegionParts(parts) {
  if (!Array.isArray(parts)) return '';
  return Array.from(new Set(parts.map((p) => p.trim()).filter(Boolean))).join(', ');
}
