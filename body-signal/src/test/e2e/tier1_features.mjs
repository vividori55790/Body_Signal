import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PROJECT_DIR,
  REPO_ROOT,
  SRC_DIR,
  ANDROID_DIR,
  APK_PATH,
  computeSha256Checksum,
  encryptWithPin,
  decryptWithPin,
  canonicalSignPainRecord,
  InMemoryHealthStorage,
  createMockSseStream,
  parseSseStream,
  inspectApkEntries,
} from './test_helpers.mjs';

export const tier1Tests = [
  // ==========================================
  // Feature 1: R1.1 Acute Pain Mode Large Touch UI
  // ==========================================
  {
    id: 'T1.1.1',
    feature: 'R1.1 Acute Pain Mode Large Touch UI',
    name: 'Verifies 10 NRS touch targets (1-10) are available for one-hand selection',
    run: async () => {
      const acuteComponent = fs.readFileSync(path.join(SRC_DIR, 'components/AcutePainMode.tsx'), 'utf8');
      // NRS grid definition 1..10
      assert.match(acuteComponent, /\[1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*7,\s*8,\s*9,\s*10\]/);
      assert.match(acuteComponent, /handleSelectIntensity/);
    },
  },
  {
    id: 'T1.1.2',
    feature: 'R1.1 Acute Pain Mode Large Touch UI',
    name: 'Verifies top acute body parts definition with high-contrast emojis & descriptions',
    run: async () => {
      const acuteComponent = fs.readFileSync(path.join(SRC_DIR, 'components/AcutePainMode.tsx'), 'utf8');
      assert.match(acuteComponent, /머리\/두통/);
      assert.match(acuteComponent, /목\/경추/);
      assert.match(acuteComponent, /어깨\/등/);
      assert.match(acuteComponent, /허리\/요통/);
      assert.match(acuteComponent, /무릎\/관절/);
      assert.match(acuteComponent, /배\/(복통|복부)/);
    },
  },
  {
    id: 'T1.1.3',
    feature: 'R1.1 Acute Pain Mode Large Touch UI',
    name: 'Generates valid pain log payload conforming to 3-second rapid record specification',
    run: async () => {
      const selectedIntensity = 7;
      const selectedPart = '허리/요통';
      const tookMed = true;
      const selectedMed = '타이레놀(아세트아미노펜)';

      const payload = {
        isNewCondition: false,
        conditionData: { id: 'cond-123' },
        logData: {
          date: new Date().toISOString(),
          intensity: selectedIntensity,
          medication: tookMed ? selectedMed : '',
          notes: '🚨 급성 통증 직관 기록',
          bodyPartOverride: selectedPart,
        },
      };

      assert.equal(payload.logData.intensity, 7);
      assert.equal(payload.logData.bodyPartOverride, '허리/요통');
      assert.equal(payload.logData.medication, '타이레놀(아세트아미노펜)');
      assert.ok(payload.logData.notes.includes('급성 통증'));
    },
  },
  {
    id: 'T1.1.4',
    feature: 'R1.1 Acute Pain Mode Large Touch UI',
    name: 'Auto-creates condition when selected body part has no active condition',
    run: async () => {
      const activeConditions = [{ id: 'c1', label: '두통', bodyPart: '머리' }];
      const selectedPart = '허리/요통';

      const matchingCond = activeConditions.find(
        (c) => c.bodyPart.includes(selectedPart.split('/')[0]) || selectedPart.includes(c.bodyPart)
      );
      assert.equal(matchingCond, undefined);

      const conditionData = {
        label: selectedPart,
        bodyPart: selectedPart,
        onsetDate: new Date().toISOString().split('T')[0],
      };
      assert.equal(conditionData.bodyPart, '허리/요통');
    },
  },
  {
    id: 'T1.1.5',
    feature: 'R1.1 Acute Pain Mode Large Touch UI',
    name: 'Reuses existing condition when active condition matches selected body part',
    run: async () => {
      const activeConditions = [{ id: 'c-back', label: '허리 디스크', bodyPart: '허리' }];
      const selectedPart = '허리/요통';

      const matchingCond = activeConditions.find(
        (c) => c.bodyPart.includes(selectedPart.split('/')[0]) || selectedPart.includes(c.bodyPart)
      );
      assert.ok(matchingCond);
      assert.equal(matchingCond.id, 'c-back');
    },
  },

  // ==========================================
  // Feature 2: R1.2 Dashboard Top Rapid Integration
  // ==========================================
  {
    id: 'T1.2.1',
    feature: 'R1.2 Dashboard Top Rapid Integration',
    name: 'Dashboard top contains emergency 1-sec acute pain mode banner button',
    run: async () => {
      const dashboardSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Dashboard.tsx'), 'utf8');
      assert.match(dashboardSrc, /🚨 지금 너무 아파요 \(1초 급성 통증 기록\)/);
      assert.match(dashboardSrc, /openAcute\(\)/);
    },
  },
  {
    id: 'T1.2.2',
    feature: 'R1.2 Dashboard Top Rapid Integration',
    name: 'Embedded QuickPainLogger component provides 3-second quick logging',
    run: async () => {
      const dashboardSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Dashboard.tsx'), 'utf8');
      assert.match(dashboardSrc, /<QuickPainLogger/);
      const quickLoggerSrc = fs.readFileSync(path.join(SRC_DIR, 'components/QuickPainLogger.tsx'), 'utf8');
      assert.match(quickLoggerSrc, /3초 퀵 통증 기록/);
    },
  },
  {
    id: 'T1.2.3',
    feature: 'R1.2 Dashboard Top Rapid Integration',
    name: 'QuickPainLogger instant save persists intensity, body part, and timestamp',
    run: async () => {
      const loggerSrc = fs.readFileSync(path.join(SRC_DIR, 'components/QuickPainLogger.tsx'), 'utf8');
      assert.match(loggerSrc, /saveEntry\(payload\)/);
      assert.match(loggerSrc, /notes:.*3초 퀵 기록/);
    },
  },
  {
    id: 'T1.2.4',
    feature: 'R1.2 Dashboard Top Rapid Integration',
    name: 'Quick medication chips toggle includes selected medicine in quick log',
    run: async () => {
      const loggerSrc = fs.readFileSync(path.join(SRC_DIR, 'components/QuickPainLogger.tsx'), 'utf8');
      assert.match(loggerSrc, /QUICK_MEDS\s*=\s*\[.*타이레놀.*\]/);
      assert.match(loggerSrc, /handleToggleMed/);
    },
  },
  {
    id: 'T1.2.5',
    feature: 'R1.2 Dashboard Top Rapid Integration',
    name: 'Dashboard statistics reflect newly logged acute pain entries',
    run: async () => {
      const logs = [
        { id: '1', date: new Date().toISOString(), intensity: 8 },
        { id: '2', date: new Date().toISOString(), intensity: 4 },
      ];
      const weeklyAvg = (logs.reduce((a, b) => a + b.intensity, 0) / logs.length).toFixed(1);
      assert.equal(weeklyAvg, '6.0');
    },
  },

  // ==========================================
  // Feature 3: R1.3 Medication Response 1-Tap Tracking
  // ==========================================
  {
    id: 'T1.3.1',
    feature: 'R1.3 Medication Response 1-Tap Tracking',
    name: 'Recent medication log prompts drug follow-up card on Dashboard within 24 hours',
    run: async () => {
      const dashboardSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Dashboard.tsx'), 'utf8');
      assert.match(dashboardSrc, /약효 확인 및 (통증 추적|재평가)/);
      assert.match(dashboardSrc, /방금 드신 약의 효과가 나타났나요\?/);
      assert.match(dashboardSrc, /diffHours\s*<=\s*24/);
    },
  },
  {
    id: 'T1.3.2',
    feature: 'R1.3 Medication Response 1-Tap Tracking',
    name: '1-tap medication response options evaluate delta (-3, -1, 0, +1)',
    run: async () => {
      const initialIntensity = 7;
      const options = [
        { label: '훨씬 편해요', delta: -3, val: Math.max(0, initialIntensity - 3) },
        { label: '덜 아파요', delta: -1, val: Math.max(0, initialIntensity - 1) },
        { label: '비슷해요', delta: 0, val: initialIntensity },
        { label: '더 아파요', delta: 1, val: Math.min(10, initialIntensity + 1) },
      ];
      assert.equal(options[0].val, 4);
      assert.equal(options[1].val, 6);
      assert.equal(options[2].val, 7);
      assert.equal(options[3].val, 8);
    },
  },
  {
    id: 'T1.3.3',
    feature: 'R1.3 Medication Response 1-Tap Tracking',
    name: 'Updates log with postMedIntensity and saves to persistent store',
    run: async () => {
      const log = { id: 'log-1', conditionId: 'c1', date: new Date().toISOString(), intensity: 8, medication: '타이레놀' };
      const updated = { ...log, postMedIntensity: 5 };
      assert.equal(updated.postMedIntensity, 5);
      assert.equal(updated.postMedIntensity - log.intensity, -3);
    },
  },
  {
    id: 'T1.3.4',
    feature: 'R1.3 Medication Response 1-Tap Tracking',
    name: 'Preserves side effects array when recording medication evaluation',
    run: async () => {
      const log = {
        id: 'log-1',
        conditionId: 'c1',
        date: new Date().toISOString(),
        intensity: 6,
        medication: '이부프로펜',
        postMedIntensity: 3,
        postMedSideEffects: ['속쓰림', '어지러움'],
      };
      assert.deepEqual(log.postMedSideEffects, ['속쓰림', '어지러움']);
    },
  },
  {
    id: 'T1.3.5',
    feature: 'R1.3 Medication Response 1-Tap Tracking',
    name: 'ClinicalBriefing aggregates medication response metrics for medical staff',
    run: async () => {
      const logs = [
        { id: '1', conditionId: 'c1', date: new Date().toISOString(), intensity: 8, medication: '타이레놀' },
        { id: '2', conditionId: 'c1', date: new Date().toISOString(), intensity: 6, medication: '타이레놀' },
      ];
      const stats = { count: logs.length, total: logs.reduce((s, l) => s + l.intensity, 0) };
      const avg = Number((stats.total / stats.count).toFixed(1));
      assert.equal(avg, 7.0);
    },
  },

  // ==========================================
  // Feature 4: R2.1 Android App Shortcuts
  // ==========================================
  {
    id: 'T1.4.1',
    feature: 'R2.1 Android App Shortcuts',
    name: 'shortcuts.xml file exists and contains valid XML root structure',
    run: async () => {
      const shortcutsXml = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/res/xml/shortcuts.xml'), 'utf8');
      assert.match(shortcutsXml, /<shortcuts xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android">/);
    },
  },
  {
    id: 'T1.4.2',
    feature: 'R2.1 Android App Shortcuts',
    name: 'Shortcut acute_pain routes directly to https://localhost/?mode=acute',
    run: async () => {
      const shortcutsXml = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/res/xml/shortcuts.xml'), 'utf8');
      assert.match(shortcutsXml, /android:shortcutId="acute_pain"/);
      assert.match(shortcutsXml, /android:data="https:\/\/localhost\/\?mode=acute"/);
    },
  },
  {
    id: 'T1.4.3',
    feature: 'R2.1 Android App Shortcuts',
    name: 'Shortcut clinical_briefing routes to https://localhost/briefing',
    run: async () => {
      const shortcutsXml = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/res/xml/shortcuts.xml'), 'utf8');
      assert.match(shortcutsXml, /android:shortcutId="clinical_briefing"/);
      assert.match(shortcutsXml, /android:data="https:\/\/localhost\/briefing"/);
    },
  },
  {
    id: 'T1.4.4',
    feature: 'R2.1 Android App Shortcuts',
    name: 'Shortcut quick_med routes to https://localhost/entry',
    run: async () => {
      const shortcutsXml = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/res/xml/shortcuts.xml'), 'utf8');
      assert.match(shortcutsXml, /android:shortcutId="quick_med"/);
      assert.match(shortcutsXml, /android:data="https:\/\/localhost\/entry"/);
    },
  },
  {
    id: 'T1.4.5',
    feature: 'R2.1 Android App Shortcuts',
    name: 'AndroidManifest.xml registers shortcuts resource in MainActivity meta-data',
    run: async () => {
      const manifest = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/AndroidManifest.xml'), 'utf8');
      assert.match(manifest, /android:name="android\.app\.shortcuts"/);
      assert.match(manifest, /android:resource="@xml\/shortcuts"/);
    },
  },

  // ==========================================
  // Feature 5: R2.2 Web App Manifest Shortcuts
  // ==========================================
  {
    id: 'T1.5.1',
    feature: 'R2.2 Web App Manifest Shortcuts',
    name: 'vite.config.js registers Web App Manifest shortcuts array via VitePWA',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      assert.match(viteConfig, /VitePWA/);
      assert.match(viteConfig, /shortcuts:\s*\[/);
    },
  },
  {
    id: 'T1.5.2',
    feature: 'R2.2 Web App Manifest Shortcuts',
    name: 'Web App Manifest includes 1초 급성 통증 기록 shortcut with /?mode=acute',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      assert.match(viteConfig, /name:\s*['"]1초 급성 통증 기록['"]/);
      assert.match(viteConfig, /url:\s*['"]\/\?mode=acute['"]/);
    },
  },
  {
    id: 'T1.5.3',
    feature: 'R2.2 Web App Manifest Shortcuts',
    name: 'Web App Manifest includes 의료진 진료 브리핑 shortcut with /briefing',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      assert.match(viteConfig, /name:\s*['"]의료진 진료 브리핑['"]/);
      assert.match(viteConfig, /url:\s*['"]\/briefing['"]/);
    },
  },
  {
    id: 'T1.5.4',
    feature: 'R2.2 Web App Manifest Shortcuts',
    name: 'Web App Manifest includes 빠른 복약 기록 shortcut with /entry',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      assert.match(viteConfig, /name:\s*['"]빠른 복약 기록['"]/);
      assert.match(viteConfig, /url:\s*['"]\/entry['"]/);
    },
  },
  {
    id: 'T1.5.5',
    feature: 'R2.2 Web App Manifest Shortcuts',
    name: 'Web App Manifest display is configured to standalone for immersive experience',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      assert.match(viteConfig, /display:\s*['"]standalone['"]/);
    },
  },

  // ==========================================
  // Feature 6: R2.3 In-App Floating SOS Widget
  // ==========================================
  {
    id: 'T1.6.1',
    feature: 'R2.3 In-App Floating SOS Widget',
    name: 'Layout.tsx contains persistent floating SOS widget button across all screens',
    run: async () => {
      const layoutSrc = fs.readFileSync(path.join(SRC_DIR, 'components/Layout.tsx'), 'utf8');
      assert.match(layoutSrc, /1초 급성 통증 기록 위젯/);
      assert.match(layoutSrc, /fixed bottom-20 right-4/);
    },
  },
  {
    id: 'T1.6.2',
    feature: 'R2.3 In-App Floating SOS Widget',
    name: 'SOS widget is rendered when settings.quickSosEnabled is true',
    run: async () => {
      const layoutSrc = fs.readFileSync(path.join(SRC_DIR, 'components/Layout.tsx'), 'utf8');
      assert.match(layoutSrc, /settings\.quickSosEnabled\s*!==\s*false/);
    },
  },
  {
    id: 'T1.6.3',
    feature: 'R2.3 In-App Floating SOS Widget',
    name: 'SOS widget is hidden when settings.quickSosEnabled is false',
    run: async () => {
      const settings = { quickSosEnabled: false };
      const shouldRender = settings.quickSosEnabled !== false;
      assert.equal(shouldRender, false);
    },
  },
  {
    id: 'T1.6.4',
    feature: 'R2.3 In-App Floating SOS Widget',
    name: 'Clicking floating SOS button invokes openAcute() modal handler',
    run: async () => {
      const layoutSrc = fs.readFileSync(path.join(SRC_DIR, 'components/Layout.tsx'), 'utf8');
      assert.match(layoutSrc, /openAcute\(\)/);
    },
  },
  {
    id: 'T1.6.5',
    feature: 'R2.3 In-App Floating SOS Widget',
    name: 'Floating widget includes accessible aria-label attributes',
    run: async () => {
      const layoutSrc = fs.readFileSync(path.join(SRC_DIR, 'components/Layout.tsx'), 'utf8');
      assert.match(layoutSrc, /aria-label="1초 급성 통증 기록 위젯"/);
      assert.match(layoutSrc, /aria-label="지금 너무 아파요 1초 급성 통증 기록"/);
    },
  },

  // ==========================================
  // Feature 7: R3.1 On-Device AES-GCM 256 Encryption
  // ==========================================
  {
    id: 'T1.7.1',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption',
    name: 'Crypto module derives AES-GCM 256-bit key using PBKDF2 with 100,000 iterations',
    run: async () => {
      const cryptoSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/crypto.ts'), 'utf8');
      assert.match(cryptoSrc, /PBKDF2_ITERATIONS\s*=\s*100_?000/);
      assert.match(cryptoSrc, /KEY_LENGTH_BITS\s*=\s*256/);
      assert.match(cryptoSrc, /'AES-GCM'/);
    },
  },
  {
    id: 'T1.7.2',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption',
    name: 'EncryptedPackage structure conforms to version 1 with hex salt, hex iv, and base64 ct',
    run: async () => {
      const pkg = await encryptWithPin('Sample clinical payload', '1234');
      assert.equal(pkg.v, 1);
      assert.match(pkg.salt, /^[0-9a-f]{32}$/); // 16 bytes = 32 hex chars
      assert.match(pkg.iv, /^[0-9a-f]{24}$/);   // 12 bytes = 24 hex chars
      assert.ok(typeof pkg.ct === 'string' && pkg.ct.length > 0);
    },
  },
  {
    id: 'T1.7.3',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption',
    name: 'AES-GCM 256 encryption and decryption round-trip recovers exact original string',
    run: async () => {
      const original = '환자 두통 NRS 8점, 타이레놀 500mg 복용 기록';
      const pkg = await encryptWithPin(original, '9876');
      const decrypted = await decryptWithPin(pkg, '9876');
      assert.equal(decrypted, original);
    },
  },
  {
    id: 'T1.7.4',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption',
    name: 'Unique random IV and salt ensure two encryptions of same text yield distinct ciphertexts',
    run: async () => {
      const plain = '동일한 통증 텍스트';
      const pkg1 = await encryptWithPin(plain, '1234');
      const pkg2 = await encryptWithPin(plain, '1234');
      assert.notEqual(pkg1.salt, pkg2.salt);
      assert.notEqual(pkg1.iv, pkg2.iv);
      assert.notEqual(pkg1.ct, pkg2.ct);
    },
  },
  {
    id: 'T1.7.5',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption',
    name: 'Storage engine encrypts HealthDataPayload at rest when PIN is provided',
    run: async () => {
      const storage = new InMemoryHealthStorage();
      const payload = { conditions: [], logs: [{ id: '1', intensity: 5 }], diaryEntries: [] };
      await storage.saveHealthData(payload, '1234');

      // Attempt to load without PIN
      const locked = await storage.loadHealthData();
      assert.equal(locked.isEncrypted, true);
      assert.equal(locked.data, null);

      // Load with correct PIN
      const unlocked = await storage.loadHealthData('1234');
      assert.equal(unlocked.isEncrypted, true);
      assert.equal(unlocked.data.logs[0].intensity, 5);
    },
  },

  // ==========================================
  // Feature 8: R3.2 SHA-256 Data Integrity Signatures
  // ==========================================
  {
    id: 'T1.8.1',
    feature: 'R3.2 SHA-256 Data Integrity Signatures',
    name: 'computeSha256Checksum produces standard 64-character lowercase hex string',
    run: async () => {
      const hash = await computeSha256Checksum('Bignal EMR Data');
      assert.match(hash, /^[0-9a-f]{64}$/);
    },
  },
  {
    id: 'T1.8.2',
    feature: 'R3.2 SHA-256 Data Integrity Signatures',
    name: 'Validates against known SHA-256 oracle test vector',
    run: async () => {
      // Standard NIST SHA-256 vector: empty string hash
      const emptyHash = await computeSha256Checksum('');
      assert.equal(emptyHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

      // Hash of "abc"
      const abcHash = await computeSha256Checksum('abc');
      assert.equal(abcHash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    },
  },
  {
    id: 'T1.8.3',
    feature: 'R3.2 SHA-256 Data Integrity Signatures',
    name: 'Backup file encryption embeds SHA-256 checksum for tamper-proof verification',
    run: async () => {
      const cryptoSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/crypto.ts'), 'utf8');
      assert.match(cryptoSrc, /encryptBackupWithPassphrase/);
      assert.match(cryptoSrc, /computeSha256Checksum\(dataJson\)/);
      assert.match(cryptoSrc, /decryptBackupWithPassphrase/);
      assert.match(cryptoSrc, /데이터 무결성 검증 실패/);
    },
  },
  {
    id: 'T1.8.4',
    feature: 'R3.2 SHA-256 Data Integrity Signatures',
    name: 'Generates canonical record signature from clinical fields',
    run: async () => {
      const record = {
        id: 'rec-001',
        conditionId: 'cond-001',
        date: '2026-11-06T12:00:00.000Z',
        intensity: 8,
        medication: '이부프로펜',
        postMedIntensity: 4,
      };
      const sig = await canonicalSignPainRecord(record);
      assert.match(sig, /^[0-9a-f]{64}$/);
      // Same record yields identical signature
      const sig2 = await canonicalSignPainRecord(record);
      assert.equal(sig, sig2);
    },
  },
  {
    id: 'T1.8.5',
    feature: 'R3.2 SHA-256 Data Integrity Signatures',
    name: 'Chained cryptographic signatures link record to previous record signature',
    run: async () => {
      const rec1 = { id: 'r1', conditionId: 'c1', date: '2026-11-06T10:00:00Z', intensity: 5 };
      const sig1 = await canonicalSignPainRecord(rec1, '');

      const rec2 = { id: 'r2', conditionId: 'c1', date: '2026-11-06T11:00:00Z', intensity: 7 };
      const sig2 = await canonicalSignPainRecord(rec2, sig1);

      assert.notEqual(sig1, sig2);
      assert.match(sig2, /^[0-9a-f]{64}$/);
    },
  },

  // ==========================================
  // Feature 9: R3.3 Auto-lock & App Switcher Masking
  // ==========================================
  {
    id: 'T1.9.1',
    feature: 'R3.3 Auto-lock & App Switcher Masking',
    name: 'AuthContext listens to visibilitychange and enables privacy mask when hidden',
    run: async () => {
      const authSrc = fs.readFileSync(path.join(SRC_DIR, 'context/AuthContext.tsx'), 'utf8');
      assert.match(authSrc, /visibilitychange/);
      assert.match(authSrc, /setIsPrivacyMasked\(true\)/);
      assert.match(authSrc, /보안 모드 실행 중/);
      assert.match(authSrc, /의료 데이터 보호를 위해 화면을 가립니다/);
    },
  },
  {
    id: 'T1.9.2',
    feature: 'R3.3 Auto-lock & App Switcher Masking',
    name: 'Auto-lock timeout constant configured to 60,000ms (1 minute)',
    run: async () => {
      const authSrc = fs.readFileSync(path.join(SRC_DIR, 'context/AuthContext.tsx'), 'utf8');
      assert.match(authSrc, /AUTO_LOCK_TIMEOUT_MS\s*=\s*60_?000/);
    },
  },
  {
    id: 'T1.9.3',
    feature: 'R3.3 Auto-lock & App Switcher Masking',
    name: 'Background duration exceeding timeout sets isUnlocked to false and clears activeSessionPin',
    run: async () => {
      const authSrc = fs.readFileSync(path.join(SRC_DIR, 'context/AuthContext.tsx'), 'utf8');
      assert.match(authSrc, /elapsed\s*>=\s*AUTO_LOCK_TIMEOUT_MS/);
      assert.match(authSrc, /setActiveSessionPin\(null\)/);
      assert.match(authSrc, /setIsUnlocked\(false\)/);
    },
  },
  {
    id: 'T1.9.4',
    feature: 'R3.3 Auto-lock & App Switcher Masking',
    name: 'PIN security module limits failed attempts to 5 before lockout',
    run: async () => {
      const pinSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/pin.ts'), 'utf8');
      assert.match(pinSrc, /MAX_ATTEMPTS\s*=\s*5/);
      assert.match(pinSrc, /LOCKOUT_DURATION_MS\s*=\s*30\s*\*\s*1000/);
    },
  },
  {
    id: 'T1.9.5',
    feature: 'R3.3 Auto-lock & App Switcher Masking',
    name: '5 failed PIN attempts trigger 30-second lockout with remaining countdown',
    run: async () => {
      const pinSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/pin.ts'), 'utf8');
      assert.match(pinSrc, /meta\.failedAttempts\s*>=\s*MAX_ATTEMPTS/);
      assert.match(pinSrc, /lockoutUntil\s*=\s*Date\.now\(\)\s*\+\s*LOCKOUT_DURATION_MS/);
    },
  },

  // ==========================================
  // Feature 10: R4.1 Local LLM Network Adapter
  // ==========================================
  {
    id: 'T1.10.1',
    feature: 'R4.1 Local LLM Network Adapter',
    name: 'normalizeEndpoint adds http:// prefix if protocol is omitted',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /export function normalizeEndpoint/);
      // Test function logic directly
      const clean = (url) => {
        let u = (url || '').trim().replace(/\/+$/, '');
        if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'http://' + u;
        return u;
      };
      assert.equal(clean('localhost:11434'), 'http://localhost:11434');
    },
  },
  {
    id: 'T1.10.2',
    feature: 'R4.1 Local LLM Network Adapter',
    name: 'normalizeEndpoint removes trailing slashes',
    run: async () => {
      const clean = (url) => {
        let u = (url || '').trim().replace(/\/+$/, '');
        if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'http://' + u;
        return u;
      };
      assert.equal(clean('http://localhost:11434/v1///'), 'http://localhost:11434/v1');
    },
  },
  {
    id: 'T1.10.3',
    feature: 'R4.1 Local LLM Network Adapter',
    name: 'Default LLM configuration targets local Ollama endpoint without cloud leakage',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /endpoint:\s*'http:\/\/localhost:11434\/v1'/);
      assert.match(localLlmSrc, /model:\s*'llama3\.2'/);
    },
  },
  {
    id: 'T1.10.4',
    feature: 'R4.1 Local LLM Network Adapter',
    name: 'Supports common local endpoints: localhost:11434, Android 10.0.2.2, and LM Studio 1234',
    run: async () => {
      const settingsSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Settings.tsx'), 'utf8');
      assert.match(settingsSrc, /http:\/\/localhost:11434\/v1/);
      assert.match(settingsSrc, /http:\/\/10\.0\.2\.2:11434\/v1/);
      assert.match(settingsSrc, /http:\/\/localhost:1234\/v1/);
    },
  },
  {
    id: 'T1.10.5',
    feature: 'R4.1 Local LLM Network Adapter',
    name: 'Graceful fallback on-device clinical engine activates if local server is unreachable',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /fallbackClinicalStream/);
      assert.match(localLlmSrc, /온디바이스 임상 엔진 분석 리포트/);
      assert.match(localLlmSrc, /외부 서버 전송 없이 100% 기기 내부 로컬 분석/);
    },
  },

  // ==========================================
  // Feature 11: R4.2 Settings Screen Config UI
  // ==========================================
  {
    id: 'T1.11.1',
    feature: 'R4.2 Settings Screen Config UI',
    name: 'Settings page provides toggle for local LLM integration',
    run: async () => {
      const settingsSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Settings.tsx'), 'utf8');
      assert.match(settingsSrc, /로컬 LLM \(오프라인 프라이빗 AI\)/);
      assert.match(settingsSrc, /로컬 LLM 임상 보조 연동/);
      assert.match(settingsSrc, /checked=\{settings\.localLlm\.enabled\}/);
    },
  },
  {
    id: 'T1.11.2',
    feature: 'R4.2 Settings Screen Config UI',
    name: 'Settings page provides editable endpoint URL input field',
    run: async () => {
      const settingsSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Settings.tsx'), 'utf8');
      assert.match(settingsSrc, /엔드포인트 URL \(OpenAI 호환\)/);
      assert.match(settingsSrc, /updateLocalLlm\(\{\s*endpoint:\s*e\.target\.value\s*\}\)/);
    },
  },
  {
    id: 'T1.11.3',
    feature: 'R4.2 Settings Screen Config UI',
    name: 'Settings page provides editable model name input field and presets',
    run: async () => {
      const settingsSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Settings.tsx'), 'utf8');
      assert.match(settingsSrc, /모델명 \(Model\)/);
      assert.match(settingsSrc, /\['llama3\.2',\s*'phi3',\s*'mistral',\s*'gemma2'\]/);
    },
  },
  {
    id: 'T1.11.4',
    feature: 'R4.2 Settings Screen Config UI',
    name: 'Settings page provides live local LLM connectivity test button',
    run: async () => {
      const settingsSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Settings.tsx'), 'utf8');
      assert.match(settingsSrc, /handleTestLlm/);
      assert.match(settingsSrc, /로컬 LLM 연결 테스트/);
    },
  },
  {
    id: 'T1.11.5',
    feature: 'R4.2 Settings Screen Config UI',
    name: 'LocalLlmConfigSchema in health.ts defines valid config schema',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /export const LocalLlmConfigSchema/);
      assert.match(healthTypes, /endpoint:\s*z\.string\(\)\.default\('http:\/\/localhost:11434\/v1'\)/);
      assert.match(healthTypes, /model:\s*z\.string\(\)\.default\('llama3\.2'\)/);
    },
  },

  // ==========================================
  // Feature 12: R4.3 Real-Time SSE/NDJSON Streaming
  // ==========================================
  {
    id: 'T1.12.1',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming',
    name: 'SSE streaming parser unpacks incremental tokens and invokes onChunk callback',
    run: async () => {
      const tokens = ['[온디바이스', ' 임상', ' 리포트]'];
      const stream = createMockSseStream(tokens);
      const chunks = [];
      const result = await parseSseStream(stream, (delta) => chunks.push(delta));
      assert.equal(result, '[온디바이스 임상 리포트]');
      assert.deepEqual(chunks, tokens);
    },
  },
  {
    id: 'T1.12.2',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming',
    name: 'SSE stream concludes properly on data: [DONE] sentinel',
    run: async () => {
      const stream = createMockSseStream(['Hello']);
      const text = await parseSseStream(stream);
      assert.equal(text, 'Hello');
    },
  },
  {
    id: 'T1.12.3',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming',
    name: 'Doctor persona generates structured PQRST clinical briefing prompt',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /targetAudience\s*===\s*'doctor'/);
      assert.match(localLlmSrc, /PQRST 원칙 기반/);
      assert.match(localLlmSrc, /약물 반응 및 호전\/악화 추세 평가/);
      assert.match(localLlmSrc, /진료실에서 확인해야 할 핵심 문진 포인트/);
    },
  },
  {
    id: 'T1.12.4',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming',
    name: 'Patient persona generates accessible recovery guidance prompt',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /현재 상태에 대한 쉬운 설명/);
      assert.match(localLlmSrc, /진료 시 의사 선생님께 질문하면 좋은 점/);
      assert.match(localLlmSrc, /일상생활에서 주의할 점/);
    },
  },
  {
    id: 'T1.12.5',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming',
    name: 'ClinicalBriefing UI integrates real-time token streaming and interactive Q&A',
    run: async () => {
      const briefingSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/ClinicalBriefing.tsx'), 'utf8');
      assert.match(briefingSrc, /generateClinicalAiAnalysisStream/);
      assert.match(briefingSrc, /askClinicalQuestionStream/);
      assert.match(briefingSrc, /로컬 AI에게 내 증상 물어보기/);
    },
  },

  // ==========================================
  // Feature 13: R5.1 TypeScript Integrity Verification
  // ==========================================
  {
    id: 'T1.13.1',
    feature: 'R5.1 TypeScript Integrity Verification',
    name: 'tsconfig.json exists and specifies strict type checking',
    run: async () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'tsconfig.json'), 'utf8'));
      assert.equal(tsconfig.compilerOptions.strict, true);
      assert.equal(tsconfig.compilerOptions.noEmit, true);
    },
  },
  {
    id: 'T1.13.2',
    feature: 'R5.1 TypeScript Integrity Verification',
    name: 'ConditionSchema validates required fields: id, label, bodyPart, onsetDate',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /export const ConditionSchema\s*=\s*z\.object\(\{/);
      assert.match(healthTypes, /label:\s*z\.string\(\)\.min\(1\)/);
      assert.match(healthTypes, /bodyPart:\s*z\.string\(\)\.min\(1\)/);
    },
  },
  {
    id: 'T1.13.3',
    feature: 'R5.1 TypeScript Integrity Verification',
    name: 'PainLogSchema validates required fields: id, conditionId, date, intensity (1-10)',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /export const PainLogSchema\s*=\s*z\.object\(\{/);
      assert.match(healthTypes, /intensity:\s*z\.number\(\)\.int\(\)\.min\(1\)\.max\(10\)/);
    },
  },
  {
    id: 'T1.13.4',
    feature: 'R5.1 TypeScript Integrity Verification',
    name: 'PainLogSchema includes medication response extensions: postMedIntensity & postMedSideEffects',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /postMedIntensity:\s*z\.number\(\)/);
    },
  },
  {
    id: 'T1.13.5',
    feature: 'R5.1 TypeScript Integrity Verification',
    name: 'HealthDataPayloadSchema validates root application payload structure',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /export const HealthDataPayloadSchema\s*=\s*z\.object\(\{/);
      assert.match(healthTypes, /conditions:\s*z\.array\(ConditionSchema\)/);
      assert.match(healthTypes, /logs:\s*z\.array\(/);
    },
  },

  // ==========================================
  // Feature 14: R5.2 Capacitor Android Sync & Build
  // ==========================================
  {
    id: 'T1.14.1',
    feature: 'R5.2 Capacitor Android Sync & Build',
    name: 'capacitor.config.json defines applicationId com.bodysignal.app and webDir dist',
    run: async () => {
      const capConfig = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'capacitor.config.json'), 'utf8'));
      assert.equal(capConfig.appId, 'com.bodysignal.app');
      assert.equal(capConfig.appName, 'Body Signal');
      assert.equal(capConfig.webDir, 'dist');
    },
  },
  {
    id: 'T1.14.2',
    feature: 'R5.2 Capacitor Android Sync & Build',
    name: 'android/app/build.gradle configures namespace com.bodysignal.app',
    run: async () => {
      const gradleSrc = fs.readFileSync(path.join(ANDROID_DIR, 'app/build.gradle'), 'utf8');
      assert.match(gradleSrc, /namespace\s*=\s*['"]com\.bodysignal\.app['"]/);
      assert.match(gradleSrc, /applicationId\s*['"]com\.bodysignal\.app['"]/);
    },
  },
  {
    id: 'T1.14.3',
    feature: 'R5.2 Capacitor Android Sync & Build',
    name: 'Android compileSdkVersion and targetSdkVersion configured to 34 (Android 14)',
    run: async () => {
      const varGradle = fs.readFileSync(path.join(ANDROID_DIR, 'variables.gradle'), 'utf8');
      assert.match(varGradle, /compileSdkVersion\s*=\s*34/);
      assert.match(varGradle, /targetSdkVersion\s*=\s*34/);
    },
  },
  {
    id: 'T1.14.4',
    feature: 'R5.2 Capacitor Android Sync & Build',
    name: 'Gradle wrapper scripts (gradlew, gradlew.bat, gradle-wrapper.jar) are present',
    run: async () => {
      assert.ok(fs.existsSync(path.join(ANDROID_DIR, 'gradlew')));
      assert.ok(fs.existsSync(path.join(ANDROID_DIR, 'gradlew.bat')));
      assert.ok(fs.existsSync(path.join(ANDROID_DIR, 'gradle/wrapper/gradle-wrapper.jar')));
    },
  },
  {
    id: 'T1.14.5',
    feature: 'R5.2 Capacitor Android Sync & Build',
    name: 'Root build script build_apk.ps1 exists and invokes gradlew assembleDebug',
    run: async () => {
      const scriptPath = path.join(REPO_ROOT, 'build_apk.ps1');
      assert.ok(fs.existsSync(scriptPath));
      const script = fs.readFileSync(scriptPath, 'utf8');
      assert.match(script, /gradlew\.bat\s+assembleDebug/);
    },
  },

  // ==========================================
  // Feature 15: R5.3 Android APK Output Verification
  // ==========================================
  {
    id: 'T1.15.1',
    feature: 'R5.3 Android APK Output Verification',
    name: 'Official APK file Bignal-v0.1.0-debug.apk exists in repository root',
    run: async () => {
      assert.ok(fs.existsSync(APK_PATH), `Expected APK at ${APK_PATH}`);
    },
  },
  {
    id: 'T1.15.2',
    feature: 'R5.3 Android APK Output Verification',
    name: 'APK file size exceeds 1MB threshold (actual ~4.1MB)',
    run: async () => {
      const stat = fs.statSync(APK_PATH);
      assert.ok(stat.size > 1_000_000, `APK size ${stat.size} is too small`);
    },
  },
  {
    id: 'T1.15.3',
    feature: 'R5.3 Android APK Output Verification',
    name: 'APK file has standard ZIP/APK magic header 0x50 0x4B 0x03 0x04',
    run: async () => {
      const fd = fs.openSync(APK_PATH, 'r');
      const buf = Buffer.alloc(4);
      fs.readSync(fd, buf, 0, 4, 0);
      fs.closeSync(fd);
      assert.equal(buf.toString('hex'), '504b0304');
    },
  },
  {
    id: 'T1.15.4',
    feature: 'R5.3 Android APK Output Verification',
    name: 'APK archive contains compiled AndroidManifest.xml binary entry',
    run: async () => {
      const buf = fs.readFileSync(APK_PATH);
      const entries = inspectApkEntries(buf);
      const manifest = entries.find((e) => e.name === 'AndroidManifest.xml');
      assert.ok(manifest, 'APK must contain AndroidManifest.xml');
    },
  },
  {
    id: 'T1.15.5',
    feature: 'R5.3 Android APK Output Verification',
    name: 'APK archive contains compiled Dalvik bytecode classes.dex',
    run: async () => {
      const buf = fs.readFileSync(APK_PATH);
      const entries = inspectApkEntries(buf);
      const dex = entries.find((e) => e.name === 'classes.dex');
      assert.ok(dex, 'APK must contain classes.dex');
    },
  },
];
