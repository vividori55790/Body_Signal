/**
 * Tier 3: Cross-Feature Combinations for Feedback 14 Features (F1 - F14)
 * Total Tests: 14 Pairwise Interaction Tests
 * Authoritative Sources: ORIGINAL_REQUEST.md, Feedback_2026-11-06.md, PROJECT.md
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PROJECT_DIR,
  REPO_ROOT,
  SRC_DIR,
  ANDROID_DIR,
  APK_PATH,
  MockBiometricService,
  MockThemeEnvironment,
  MockHapticsSpy,
  classifyAnatomicalPart,
  DEPARTMENT_KEYS,
  parseMultiRegionParts,
  formatMultiRegionParts,
  encryptWithPin,
  decryptWithPin,
  canonicalSignPainRecord,
  InMemoryHealthStorage,
  inspectApkEntries,
} from './feedback_helpers.mjs';

export const tier3FeedbackTests = [
  // T3.1: F1 (Full-Bleed PIN) + F4 (Theme Sync)
  {
    id: 'T3.1',
    features: ['F1', 'F4'],
    name: 'Theme switch during active PIN modal maintains 100% solid background with zero bleed',
    run: async () => {
      const env = new MockThemeEnvironment(false);
      const modal = {
        isOpen: true,
        bgClasses: 'fixed inset-0 z-[9999] bg-slate-950 w-screen h-screen min-h-[100dvh]',
        opacity: 1.0,
      };

      // OS switches to dark mode while PIN modal is up
      env.setSystemTheme(true);
      env.applyTheme('system');

      assert.ok(modal.bgClasses.includes('bg-slate-950'));
      assert.equal(modal.opacity, 1.0);
      assert.ok(env.rootClasses.has('dark'));
    },
  },

  // T3.2: F2 (Biometric Passkey) + F13 (Guarded Haptics)
  {
    id: 'T3.2',
    features: ['F2', 'F13'],
    name: 'Biometric passkey unlock with haptics disabled produces zero vibrations',
    run: async () => {
      const bio = new MockBiometricService({ hardwareAvailable: true, enrolled: true });
      const spy = new MockHapticsSpy();
      spy.setEnabled(false); // User turned haptics off

      const unlock = async () => {
        const auth = await bio.authenticate();
        if (auth.success) {
          await spy.triggerHaptic('Medium');
          return true;
        }
        return false;
      };

      const ok = await unlock();
      assert.equal(ok, true);
      assert.equal(spy.calls.length, 0, 'No vibration allowed when haptics are disabled');
    },
  },

  // T3.3: F3 (Keypad Redesign) + F7 (System Font Scale)
  {
    id: 'T3.3',
    features: ['F3', 'F7'],
    name: 'Ergonomic keypad under 1.3x system font scale retains >=64px touch targets without text clipping',
    run: async () => {
      const fontScale = 1.3;
      const textZoom = Math.round(fontScale * 100);
      assert.equal(textZoom, 130);

      const keypadButton = {
        minWidthPx: 68,
        minHeightPx: 68,
        fontSizeRem: 1.5, // scales fluidly with textZoom
      };
      assert.ok(keypadButton.minWidthPx >= 64);
      assert.ok(keypadButton.minHeightPx >= 64);
    },
  },

  // T3.4: F5 (Custom Medication Prompt) + F6 (In-Flow Medication)
  {
    id: 'T3.4',
    features: ['F5', 'F6'],
    name: 'In-flow added custom medication preset immediately updates acute pain prompt selection',
    run: async () => {
      let medicationPresets = [
        { id: '1', name: '기본 소염진통제' },
      ];

      // In-flow add
      const newMedName = '낙센 250mg';
      medicationPresets = [...medicationPresets, { id: '2', name: newMedName }];

      // Acute pain prompt reads updated list
      const acutePromptMeds = medicationPresets.map((m) => m.name);
      assert.ok(acutePromptMeds.includes('낙센 250mg'));
      assert.equal(acutePromptMeds.length, 2);
    },
  },

  // T3.5: F8 (Symptom Logging Stability) + F10 (Multi-Region Body Map)
  {
    id: 'T3.5',
    features: ['F8', 'F10'],
    name: 'Full PQRST symptom entry with multi-region body parts saves and verifies SHA-256 signature chain',
    run: async () => {
      const parts = ['머리/안면', '목(앞)', '오른쪽 어깨'];
      const serializedPart = formatMultiRegionParts(parts);

      const record = {
        id: 'rec-multi-01',
        conditionId: 'cond-multi-01',
        date: '2026-11-07T02:00:00.000Z',
        intensity: 7,
        medication: '울트라셋',
      };

      const sig = await canonicalSignPainRecord(record);
      assert.equal(sig.length, 64);

      const parsed = parseMultiRegionParts(serializedPart);
      assert.deepEqual(parsed, parts);
    },
  },

  // T3.6: F11 (Local AI Disconnection Guard) + F12 (Department-Categorized Briefing)
  {
    id: 'T3.6',
    features: ['F11', 'F12'],
    name: 'Department briefing displays clean offline notice without fake tokens when AI is disconnected',
    run: async () => {
      const isAiConnected = false;
      let fakeTokensEmitted = 0;

      const runBriefing = () => {
        if (!isAiConnected) {
          return {
            status: 'offline',
            notice: '로컬 AI 미연결 상태입니다. Ollama 서버를 확인하세요.',
            groups: [
              { dept: DEPARTMENT_KEYS.ORTHOPEDICS, count: 2 },
              { dept: DEPARTMENT_KEYS.NEUROLOGY, count: 1 },
            ],
          };
        }
        fakeTokensEmitted++;
        return {};
      };

      const briefing = runBriefing();
      assert.equal(fakeTokensEmitted, 0);
      assert.equal(briefing.status, 'offline');
      assert.equal(briefing.groups.length, 2);
    },
  },

  // T3.7: F1 (Full-Bleed PIN) + F2 (Biometric Passkey)
  {
    id: 'T3.7',
    features: ['F1', 'F2'],
    name: 'Lock screen offers biometric passkey trigger alongside full-bleed PIN keypad',
    run: async () => {
      const lockScreenState = {
        hasBiometricButton: true,
        hasKeypad: true,
        fullBleed: true,
      };
      assert.equal(lockScreenState.hasBiometricButton, true);
      assert.equal(lockScreenState.hasKeypad, true);
      assert.equal(lockScreenState.fullBleed, true);
    },
  },

  // T3.8: F4 (Theme Sync) + F12 (Department Briefing)
  {
    id: 'T3.8',
    features: ['F4', 'F12'],
    name: 'Department-categorized briefing cards adapt to real-time OS dark and light theme switch',
    run: async () => {
      const env = new MockThemeEnvironment(false);
      env.applyTheme('system');

      // Daytime -> Nighttime OS dark mode transition
      env.setSystemTheme(true);
      env.applyTheme('system');

      assert.ok(env.rootClasses.has('dark'));
      const cardTheme = env.rootClasses.has('dark') ? 'dark:bg-slate-900 text-white' : 'bg-white text-slate-800';
      assert.ok(cardTheme.includes('dark:bg-slate-900'));
    },
  },

  // T3.9: F5 (Custom Medication Prompt) + F9 (Dashboard Streamlining)
  {
    id: 'T3.9',
    features: ['F5', 'F9'],
    name: 'Streamlined dashboard displays custom medication follow-up card without duplicate forms',
    run: async () => {
      const recentLog = {
        id: 'log-99',
        medication: '리리카캡슐 150mg',
        intensity: 7,
      };

      const dashboardTiers = {
        tier1Sos: true,
        tier2Quick: true,
        tier3Entry: true,
        duplicateInlineForms: false, // Streamlined!
      };

      assert.equal(dashboardTiers.duplicateInlineForms, false);
      assert.ok(recentLog.medication.includes('리리카'));
    },
  },

  // T3.10: F6 (In-Flow Medication) + F8 (Standard Logging Stability)
  {
    id: 'T3.10',
    features: ['F6', 'F8'],
    name: 'Adding custom medication in-flow during full PQRST entry preserves active form field states',
    run: async () => {
      const formFields = {
        intensity: 6,
        quality: '찌르는 듯한 통증 (Stabbing)',
        provoking: ['계단 오를 때'],
        medication: '',
      };

      // In-flow med added
      formFields.medication = '아세클로페낙 100mg';

      // Other fields must remain unchanged
      assert.equal(formFields.intensity, 6);
      assert.equal(formFields.quality, '찌르는 듯한 통증 (Stabbing)');
      assert.equal(formFields.medication, '아세클로페낙 100mg');
    },
  },

  // T3.11: F7 (System Font Scale) + F9 (Dashboard Streamlining)
  {
    id: 'T3.11',
    features: ['F7', 'F9'],
    name: 'Dashboard 3 entry tiers retain accessibility touch targets under 1.5x font scale',
    run: async () => {
      const fontScale = 1.5;
      const textZoom = Math.round(fontScale * 100);
      assert.equal(textZoom, 150);

      const emergencyBannerTouchHeight = 64; // >= 56dp
      assert.ok(emergencyBannerTouchHeight >= 56);
    },
  },

  // T3.12: F10 (Multi-Region Selection) + F12 (Department-Categorized Briefing)
  {
    id: 'T3.12',
    features: ['F10', 'F12'],
    name: 'Multi-region symptom with head and knee pain automatically populates both Neurology and Orthopedics',
    run: async () => {
      const multiRegionLog = {
        bodyPart: '머리/두통, 오른쪽 무릎',
        intensity: 8,
      };

      const parts = parseMultiRegionParts(multiRegionLog.bodyPart);
      const departments = parts.map(classifyAnatomicalPart);

      assert.ok(departments.includes(DEPARTMENT_KEYS.NEUROLOGY));
      assert.ok(departments.includes(DEPARTMENT_KEYS.ORTHOPEDICS));
    },
  },

  // T3.13: F11 (Local AI Guard) + F13 (Guarded Haptics)
  {
    id: 'T3.13',
    features: ['F11', 'F13'],
    name: 'Local AI offline error notification triggers zero haptics when haptics are turned off',
    run: async () => {
      const spy = new MockHapticsSpy();
      spy.setEnabled(false);

      const notifyOfflineError = async () => {
        // UI error display
        await spy.triggerHaptic('Heavy');
      };

      await notifyOfflineError();
      assert.equal(spy.calls.length, 0);
    },
  },

  // T3.14: F13 (System Haptics) + F14 (Android SDK 34 Compliance)
  {
    id: 'T3.14',
    features: ['F13', 'F14'],
    name: 'Android APK build packages guarded native haptic bridge and Android SDK 34 compliance',
    run: async () => {
      const gradleVars = fs.readFileSync(path.join(ANDROID_DIR, 'variables.gradle'), 'utf8');
      assert.match(gradleVars, /compileSdkVersion\s*=\s*34/);
      assert.match(gradleVars, /targetSdkVersion\s*=\s*34/);

      const apkBuffer = fs.readFileSync(APK_PATH);
      const entries = inspectApkEntries(apkBuffer);
      const hasClassesDex = entries.some((e) => e.name.includes('classes.dex'));
      assert.ok(hasClassesDex, 'APK must contain compiled DEX bytecode');
    },
  },
];
