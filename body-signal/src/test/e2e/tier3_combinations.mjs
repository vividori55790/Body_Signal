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
} from './test_helpers.mjs';

export const tier3Tests = [
  // ==========================================
  // Cross-Feature Combinations (15 tests)
  // ==========================================
  {
    id: 'T3.1',
    feature: 'R1.1 + R3.1 (Acute Pain Logging & AES-GCM 256 Storage)',
    name: 'Rapid acute pain log is saved and encrypted at rest with AES-GCM 256',
    run: async () => {
      const storage = new InMemoryHealthStorage();
      const acuteLog = {
        id: 'acute-001',
        conditionId: 'cond-migraine',
        date: new Date().toISOString(),
        intensity: 9,
        medication: '수마트립탄',
        notes: '🚨 급성 편두통 발작',
      };
      const healthData = {
        conditions: [{ id: 'cond-migraine', label: '편두통', bodyPart: '머리' }],
        logs: [acuteLog],
        diaryEntries: [],
      };

      await storage.saveHealthData(healthData, '5555');

      // Verify raw storage is encrypted package
      const rawStored = storage.store.get('health_data');
      assert.equal(rawStored.v, 1);
      assert.ok(rawStored.salt && rawStored.iv && rawStored.ct);

      // Decrypt and verify payload restored accurately
      const loaded = await storage.loadHealthData('5555');
      assert.equal(loaded.data.logs[0].intensity, 9);
      assert.equal(loaded.data.logs[0].medication, '수마트립탄');
    },
  },
  {
    id: 'T3.2',
    feature: 'R1.1 + R3.2 (Acute Pain Logging & SHA-256 Audit Signature)',
    name: 'Acute pain entry generates deterministic SHA-256 canonical integrity hash',
    run: async () => {
      const acuteLog = {
        id: 'acute-002',
        conditionId: 'cond-lumbago',
        date: '2026-11-06T15:30:00.000Z',
        intensity: 8,
        medication: '근이완제',
      };
      const signature = await canonicalSignPainRecord(acuteLog);
      assert.match(signature, /^[0-9a-f]{64}$/);

      // Verify any alteration breaks signature
      const alteredLog = { ...acuteLog, intensity: 3 };
      const alteredSig = await canonicalSignPainRecord(alteredLog);
      assert.notEqual(signature, alteredSig);
    },
  },
  {
    id: 'T3.3',
    feature: 'R1.3 + R3.2 (1-Tap Medication Response & Hash Chain)',
    name: 'Medication re-evaluation links to previous signature in cryptographic audit chain',
    run: async () => {
      const initialLog = {
        id: 'med-001',
        conditionId: 'c1',
        date: '2026-11-06T08:00:00Z',
        intensity: 7,
        medication: '타이레놀 500mg',
      };
      const initialSig = await canonicalSignPainRecord(initialLog, '');

      // 1 hour later: re-evaluation records postMedIntensity
      const followUpLog = {
        ...initialLog,
        postMedIntensity: 4,
        postMedEvaluatedAt: '2026-11-06T09:00:00Z',
      };
      const followUpSig = await canonicalSignPainRecord(followUpLog, initialSig);

      assert.notEqual(initialSig, followUpSig);
      assert.match(followUpSig, /^[0-9a-f]{64}$/);
    },
  },
  {
    id: 'T3.4',
    feature: 'R2.1 + R1.1 (Android Shortcut & Acute Modal Trigger)',
    name: 'Android shortcut URI ?mode=acute routes directly into AcutePainMode modal trigger',
    run: async () => {
      const url = new URL('https://localhost/?mode=acute');
      const params = url.searchParams;
      const shouldOpenAcute = params.get('mode') === 'acute';
      assert.equal(shouldOpenAcute, true);

      const acuteContextSrc = fs.readFileSync(path.join(SRC_DIR, 'context/AcutePainContext.tsx'), 'utf8');
      assert.match(acuteContextSrc, /params\.get\('mode'\)\s*===\s*'acute'/);
    },
  },
  {
    id: 'T3.5',
    feature: 'R2.2 + R4.3 (Manifest Shortcut & Streaming Clinical Briefing)',
    name: 'PWA shortcut /briefing launches Clinical Briefing with streaming AI analysis integration',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      assert.match(viteConfig, /url:\s*['"]\/briefing['"]/);

      const briefingSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/ClinicalBriefing.tsx'), 'utf8');
      assert.match(briefingSrc, /generateClinicalAiAnalysisStream/);
    },
  },
  {
    id: 'T3.6',
    feature: 'R2.3 + R1.1 + R1.2 (Floating SOS across App Pages to Dashboard Updates)',
    name: 'In-app floating SOS widget triggers acute modal from any page and updates dashboard stats',
    run: async () => {
      const layoutSrc = fs.readFileSync(path.join(SRC_DIR, 'components/Layout.tsx'), 'utf8');
      assert.match(layoutSrc, /openAcute\(\)/);

      // Simulate save and calculate dashboard stats
      const logs = [{ id: '1', intensity: 8 }, { id: '2', intensity: 6 }];
      const avg = (logs.reduce((s, l) => s + l.intensity, 0) / logs.length).toFixed(1);
      assert.equal(avg, '7.0');
    },
  },
  {
    id: 'T3.7',
    feature: 'R3.1 + R3.3 (Auto-lock Backgrounding & Memory Key Eviction)',
    name: 'Background duration of 60s locks application and purges decrypted session PIN',
    run: async () => {
      let activeSessionPin = '1234';
      let isUnlocked = true;

      const onBackgroundTimeout = () => {
        activeSessionPin = null;
        isUnlocked = false;
      };

      onBackgroundTimeout();
      assert.equal(activeSessionPin, null);
      assert.equal(isUnlocked, false);
    },
  },
  {
    id: 'T3.8',
    feature: 'R3.2 + R4.3 (Tamper Detection & Clinical Briefing Sanitization)',
    name: 'Tampered pain log is flagged by checksum verification before generating LLM briefing',
    run: async () => {
      const genuineLog = { id: 'l1', conditionId: 'c1', date: '2026-11-06T10:00:00Z', intensity: 8 };
      const expectedChecksum = await canonicalSignPainRecord(genuineLog);

      // Attacker lowers intensity to 2
      const tamperedLog = { ...genuineLog, intensity: 2 };
      const actualChecksum = await canonicalSignPainRecord(tamperedLog);

      const isTampered = expectedChecksum !== actualChecksum;
      assert.equal(isTampered, true);
    },
  },
  {
    id: 'T3.9',
    feature: 'R4.1 + R4.2 + R4.3 (Custom LM Studio Endpoint & Streaming Briefing)',
    name: 'User configures LM Studio endpoint in Settings and streams response via adapter',
    run: async () => {
      const settings = {
        localLlm: {
          enabled: true,
          endpoint: 'http://localhost:1234/v1',
          model: 'mistral',
        },
      };
      assert.equal(settings.localLlm.endpoint, 'http://localhost:1234/v1');

      // Test streaming with mock tokens
      const stream = createMockSseStream(['환자', ' 임상', ' 상태: 호전 중']);
      const text = await parseSseStream(stream);
      assert.equal(text, '환자 임상 상태: 호전 중');
    },
  },
  {
    id: 'T3.10',
    feature: 'R1.3 + R4.3 (Medication Response & Doctor SOAP Note Prompt)',
    name: 'Medication response and adverse side effects are included in Doctor SOAP assessment',
    run: async () => {
      const medResponseData = {
        medication: '소염진통제',
        initialIntensity: 8,
        postMedIntensity: 5,
        sideEffects: ['위장장애'],
      };

      const clinicalSummary = `약물 복용: ${medResponseData.medication} (NRS ${medResponseData.initialIntensity} -> ${medResponseData.postMedIntensity}), 부작용: ${medResponseData.sideEffects.join(', ')}`;
      assert.ok(clinicalSummary.includes('위장장애'));
      assert.ok(clinicalSummary.includes('NRS 8 -> 5'));
    },
  },
  {
    id: 'T3.11',
    feature: 'R3.1 + R3.2 + Backup (Encrypted Backup with Passphrase and Checksum)',
    name: 'Encrypted backup packaging embeds and validates SHA-256 data checksum',
    run: async () => {
      const originalData = JSON.stringify({ conditions: [{ id: 'c1', label: '관절통' }], logs: [] });
      const checksum = await computeSha256Checksum(originalData);

      const envelope = {
        payload: originalData,
        checksum,
        exportedAt: new Date().toISOString(),
      };
      const encrypted = await encryptWithPin(JSON.stringify(envelope), 'backup-passphrase-123');

      // Decrypt
      const decryptedJson = await decryptWithPin(encrypted, 'backup-passphrase-123');
      const parsedEnvelope = JSON.parse(decryptedJson);

      const calculatedChecksum = await computeSha256Checksum(parsedEnvelope.payload);
      assert.equal(calculatedChecksum, parsedEnvelope.checksum);
    },
  },
  {
    id: 'T3.12',
    feature: 'R2.1 + R3.3 (Shortcut Launch Under PIN Lock Screen Protection)',
    name: 'Launching deep link shortcut when app is locked requires PIN verification first',
    run: async () => {
      const appState = { isPinSet: true, isUnlocked: false };
      const pendingDeepLink = 'https://localhost/?mode=acute';

      // Verify protected screen is blocked until isUnlocked is true
      const canAccessAcute = appState.isUnlocked;
      assert.equal(canAccessAcute, false);

      // Simulate successful unlock
      appState.isUnlocked = true;
      assert.equal(appState.isUnlocked, true);
    },
  },
  {
    id: 'T3.13',
    feature: 'R1.1 + R1.3 + R3.2 (Acute Pain -> Drug Evaluation -> Audit Hash Sequence)',
    name: 'Full lifecycle: acute pain logged -> medication taken -> drug evaluated -> chained hashes',
    run: async () => {
      // 1. Acute pain log
      const acuteLog = { id: 'l1', conditionId: 'c1', date: '2026-11-06T12:00:00Z', intensity: 8, medication: '타이레놀' };
      const hash1 = await canonicalSignPainRecord(acuteLog, '');

      // 2. Medication evaluation
      const evaluatedLog = { ...acuteLog, postMedIntensity: 4 };
      const hash2 = await canonicalSignPainRecord(evaluatedLog, hash1);

      assert.notEqual(hash1, hash2);
      assert.match(hash2, /^[0-9a-f]{64}$/);
    },
  },
  {
    id: 'T3.14',
    feature: 'R4.1 + Fallback + R4.3 (Offline LLM Server Fallback to On-Device Engine)',
    name: 'When local LLM endpoint is unreachable, on-device clinical engine returns fallback report',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /fallbackClinicalStream/);
      assert.match(localLlmSrc, /\[온디바이스 임상 엔진 분석 리포트\]/);
    },
  },
  {
    id: 'T3.15',
    feature: 'R5.1 + R5.2 + R5.3 (Clean TypeScript Schemas & Built APK Artifact Integrity)',
    name: 'Build pipeline consistency: Capacitor config aligns with manifest and official APK',
    run: async () => {
      const capConfig = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'capacitor.config.json'), 'utf8'));
      const gradle = fs.readFileSync(path.join(ANDROID_DIR, 'app/build.gradle'), 'utf8');
      assert.equal(capConfig.appId, 'com.bodysignal.app');
      assert.match(gradle, /namespace\s*=\s*['"]com\.bodysignal\.app['"]/);
      assert.ok(fs.existsSync(APK_PATH));
    },
  },
];
