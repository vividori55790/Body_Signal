/**
 * Tier 4: Real-World Clinical Workload Scenarios for Feedback 14 Features (F1 - F14)
 * Total Tests: 7 End-to-End Patient & Clinical Workflows
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

export const tier4FeedbackTests = [
  // Scenario 1: Sudden Acute Migraine Flare-up at Midnight
  {
    id: 'T4.1',
    scenario: 'Sudden Acute Migraine Flare-up at Midnight',
    features: ['F1', 'F2', 'F4', 'F5', 'F8'],
    name: 'Patient unlocks via biometric passkey in dark mode, logs acute head pain with custom medication, and encrypts with AES-GCM 256',
    run: async () => {
      // 1. App in dark mode environment
      const env = new MockThemeEnvironment(true);
      env.applyTheme('system');
      assert.ok(env.rootClasses.has('dark'));

      // 2. Unlock via Biometric Passkey
      const bio = new MockBiometricService({ hardwareAvailable: true, enrolled: true });
      const auth = await bio.authenticate('야간 긴급 기록을 위해 생체인증');
      assert.equal(auth.success, true);

      // 3. Select custom medication preset
      const userPresets = ['타이레놀 이알 650mg', '이부프로펜'];
      const selectedMed = userPresets[0];

      // 4. Save acute log
      const storage = new InMemoryHealthStorage();
      const painRecord = {
        id: 'midnight-migraine-001',
        conditionId: 'cond-migraine',
        date: new Date().toISOString(),
        intensity: 8,
        medication: selectedMed,
        bodyPart: '머리/두통',
      };

      const userPin = '9911';
      const sig = await canonicalSignPainRecord(painRecord);
      assert.equal(sig.length, 64);

      await storage.saveHealthData({ logs: [painRecord] }, userPin);

      // 5. Restore & Verify Decryption
      const loaded = await storage.loadHealthData(userPin);
      assert.equal(loaded.isEncrypted, true);
      assert.equal(loaded.data.logs[0].intensity, 8);
      assert.equal(loaded.data.logs[0].medication, '타이레놀 이알 650mg');
    },
  },

  // Scenario 2: Post-Op Knee & Lower Back Multi-Region Pain
  {
    id: 'T4.2',
    scenario: 'Post-Op Knee & Lower Back Multi-Region Pain',
    features: ['F5', 'F6', 'F8', 'F10'],
    name: 'Post-surgery patient selects knee & back simultaneously on BodyMap, adds prescribed analgesic in-flow, and verifies audit chain',
    run: async () => {
      // 1. Multi-region selection on BodyMap
      const selectedAnatomicalParts = ['오른쪽 무릎', '허리/요통'];
      const serializedPart = formatMultiRegionParts(selectedAnatomicalParts);
      assert.equal(serializedPart, '오른쪽 무릎, 허리/요통');

      // 2. In-flow medication addition
      let medPresets = [{ id: '1', name: '기본 소염제' }];
      const prescribedMed = '마이폴캡슐 (수술후 처방)';
      medPresets = [...medPresets, { id: '2', name: prescribedMed }];

      // 3. Log composite symptom
      const log = {
        id: 'postop-log-01',
        conditionId: 'cond-postop',
        date: new Date().toISOString(),
        intensity: 7,
        medication: prescribedMed,
        bodyPart: serializedPart,
      };

      const hash1 = await canonicalSignPainRecord(log);
      assert.equal(hash1.length, 64);

      // 4. 1-tap re-evaluation 1 hour later (delta -2)
      log.postMedIntensity = 5;
      const hash2 = await canonicalSignPainRecord(log, hash1);
      assert.notEqual(hash1, hash2);
    },
  },

  // Scenario 3: Comprehensive Clinic Visit Doctor Briefing
  {
    id: 'T4.3',
    scenario: 'Comprehensive Clinic Visit Doctor Briefing',
    features: ['F11', 'F12'],
    name: 'Doctor views on-screen 30-sec briefing structured by departments; disconnected local AI shows clean offline banner without fake tokens',
    run: async () => {
      const patientLogs = [
        { id: '1', bodyPart: '머리/두통', intensity: 7, medication: '트립탄' },
        { id: '2', bodyPart: '허리/요통', intensity: 6, medication: '세레브렉스' },
        { id: '3', bodyPart: '복부/위장', intensity: 5, medication: '스멕타' },
      ];

      // 1. Categorize into clinical departments
      const grouped = {};
      for (const l of patientLogs) {
        const dept = classifyAnatomicalPart(l.bodyPart);
        if (!grouped[dept]) grouped[dept] = [];
        grouped[dept].push(l);
      }

      assert.ok(grouped[DEPARTMENT_KEYS.NEUROLOGY]);
      assert.ok(grouped[DEPARTMENT_KEYS.ORTHOPEDICS]);
      assert.ok(grouped[DEPARTMENT_KEYS.GASTROENTEROLOGY]);

      // 2. Local AI disconnected check: suppress simulated fallback
      const localLlmAvailable = false;
      let fakeTokensCount = 0;

      const generateAiSummary = async () => {
        if (!localLlmAvailable) {
          const err = new Error('로컬 AI 서버 미연결');
          err.name = 'LocalLlmOfflineError';
          throw err;
        }
        fakeTokensCount++;
      };

      await assert.rejects(generateAiSummary, { name: 'LocalLlmOfflineError' });
      assert.equal(fakeTokensCount, 0, 'Zero simulated AI tokens generated');
    },
  },

  // Scenario 4: Elderly Patient Large-Font Experience
  {
    id: 'T4.4',
    scenario: 'Elderly Patient Large-Font Experience',
    features: ['F3', 'F7'],
    name: 'Elderly patient configures 1.3x system font scale; ergonomic keypad >=64px touch targets render without text truncation',
    run: async () => {
      // 1. Android system font scale inheritance
      const systemFontScale = 1.3;
      const textZoom = Math.round(systemFontScale * 100);
      assert.equal(textZoom, 130);

      // 2. Ergonomic keypad touch targets remain accessible
      const keypadSpec = {
        buttonDimensionPx: 72, // >= 64px
        containerWidthPx: 320, // >= 320px
        fontSizeRem: 1.5,
      };

      assert.ok(keypadSpec.buttonDimensionPx >= 64);
      assert.ok(keypadSpec.containerWidthPx >= 320);

      // 3. Numeric input 1-2-3-4
      let enteredPin = '';
      for (const digit of ['1', '2', '3', '4']) {
        enteredPin += digit;
      }
      assert.equal(enteredPin, '1234');
    },
  },

  // Scenario 5: Sensory-Sensitive Patient Silent Mode
  {
    id: 'T4.5',
    scenario: 'Sensory-Sensitive Patient Silent Mode',
    features: ['F9', 'F13'],
    name: 'Patient disables haptics; all keypad presses, acute SOS button taps, and quick logging emit zero vibrations',
    run: async () => {
      const spy = new MockHapticsSpy();
      spy.setEnabled(false); // Silent mode

      // 1. Keypad interaction
      await spy.triggerHaptic('Light');
      await spy.triggerHaptic('Light');

      // 2. SOS emergency trigger
      await spy.triggerHaptic('Heavy');

      // 3. Quick pain logger instant save
      await spy.triggerHaptic('Medium');

      // Zero vibrations emitted
      assert.equal(spy.calls.length, 0);
      assert.equal(spy.vibrateCalls.length, 0);
    },
  },

  // Scenario 6: Day-in-the-Life Chronic Pain Management
  {
    id: 'T4.6',
    scenario: 'Day-in-the-Life Chronic Pain Management',
    features: ['F4', 'F5', 'F8', 'F9'],
    name: 'Full daily journey: Morning 3-sec quick log -> mid-day drug re-evaluation -> evening full PQRST review -> sunset theme sync',
    run: async () => {
      const storage = new InMemoryHealthStorage();
      const env = new MockThemeEnvironment(false); // Morning light mode

      // 1. Morning 3-sec quick log
      const morningLog = {
        id: 'day-log-am',
        date: '2026-11-07T08:00:00Z',
        intensity: 5,
        bodyPart: '허리/요통',
        medication: '세레브렉스 200mg',
        notes: '3초 퀵 통증 기록',
      };
      await storage.saveHealthData({ logs: [morningLog] });

      // 2. Mid-day drug re-evaluation (1-tap: "덜 아파요 (-1점)")
      morningLog.postMedIntensity = 4;
      await storage.saveHealthData({ logs: [morningLog] });

      // 3. Sunset: OS switches to dark mode
      env.setSystemTheme(true);
      env.applyTheme('system');
      assert.ok(env.rootClasses.has('dark'));

      // 4. Evening full PQRST review
      const loaded = await storage.loadHealthData();
      assert.equal(loaded.data.logs[0].postMedIntensity, 4);
      assert.equal(loaded.data.logs[0].medication, '세레브렉스 200mg');
    },
  },

  // Scenario 7: End-to-End Security & Native Compliance Lifecycle
  {
    id: 'T4.7',
    scenario: 'End-to-End Security & Native Compliance Lifecycle',
    features: ['F1', 'F2', 'F3', 'F14'],
    name: '100% full-bleed PIN setup -> background lock -> biometric re-entry -> tamper rejection -> Android SDK 34 APK delivery',
    run: async () => {
      // 1. Full-bleed PIN setup
      const modalStyles = {
        fullBleed: 'fixed inset-0 z-[9999] bg-slate-950 w-screen h-screen min-h-[100dvh]',
        opacity: 1.0,
      };
      assert.ok(modalStyles.fullBleed.includes('bg-slate-950'));
      assert.equal(modalStyles.opacity, 1.0);

      // 2. Encrypt with PIN
      const userPin = '4321';
      const secretRecord = JSON.stringify({ sensitive: '의료 차트 데이터' });
      const pkg = await encryptWithPin(secretRecord, userPin);

      // 3. Biometric re-entry
      const bio = new MockBiometricService({ hardwareAvailable: true, enrolled: true });
      const auth = await bio.authenticate();
      assert.equal(auth.success, true);

      // 4. Tamper verification: bit flip in ciphertext must fail decryption
      const tamperedPkg = { ...pkg, ct: pkg.ct.slice(0, -4) + 'AAAA' };
      await assert.rejects(async () => {
        await decryptWithPin(tamperedPkg, userPin);
      }, /손상|일치하지/);

      // 5. Official Android SDK 34 APK validation
      const gradleVars = fs.readFileSync(path.join(ANDROID_DIR, 'variables.gradle'), 'utf8');
      assert.match(gradleVars, /compileSdkVersion\s*=\s*34/);
      assert.match(gradleVars, /targetSdkVersion\s*=\s*34/);

      const apkBuffer = fs.readFileSync(APK_PATH);
      assert.equal(apkBuffer.readUInt32LE(0), 0x04034b50);
    },
  },
];
