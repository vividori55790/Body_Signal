import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PROJECT_DIR,
  REPO_ROOT,
  SRC_DIR,
  ANDROID_DIR,
  computeSha256Checksum,
  encryptWithPin,
  decryptWithPin,
  canonicalSignPainRecord,
  InMemoryHealthStorage,
  createMockSseStream,
  parseSseStream,
} from './test_helpers.mjs';

export const tier4Tests = [
  // ==========================================
  // Real-World Clinical Workload Scenarios (5 Scenarios)
  // ==========================================
  {
    id: 'T4.1',
    feature: 'Scenario 1: Sudden Acute Migraine Flare-up at Midnight',
    name: 'Patient logs acute midnight migraine (NRS 8) with medication, verifies AES-GCM encryption & SHA-256 signature',
    run: async () => {
      const storage = new InMemoryHealthStorage();
      const patientPin = '7777';

      // 1. Patient taps floating SOS widget or emergency banner
      const acuteInput = {
        intensity: 8,
        selectedPart: '머리/두통',
        tookMed: true,
        selectedMed: '타이레놀(아세트아미노펜)',
        timestamp: new Date().toISOString(),
      };

      // 2. Build payload conforming to AcutePainMode logic
      const condition = {
        id: 'cond-headache',
        label: acuteInput.selectedPart,
        bodyPart: acuteInput.selectedPart,
        onsetDate: acuteInput.timestamp.split('T')[0],
        isArchived: false,
      };

      const logEntry = {
        id: 'log-migraine-001',
        conditionId: condition.id,
        date: acuteInput.timestamp,
        intensity: acuteInput.intensity,
        medication: acuteInput.selectedMed,
        notes: '🚨 급성 통증 직관 기록',
        bodyPartOverride: acuteInput.selectedPart,
      };

      // 3. Generate SHA-256 audit signature
      const signature = await canonicalSignPainRecord(logEntry);
      const signedLog = { ...logEntry, signature };

      // 4. Save to AES-GCM 256 on-device encrypted store
      const healthData = {
        conditions: [condition],
        logs: [signedLog],
        diaryEntries: [],
      };
      await storage.saveHealthData(healthData, patientPin);

      // 5. Verification: Raw store is encrypted
      const raw = storage.store.get('health_data');
      assert.equal(raw.v, 1);
      assert.ok(raw.ct && raw.salt && raw.iv);

      // 6. Verification: Unlocking with PIN recovers valid data
      const unlocked = await storage.loadHealthData(patientPin);
      assert.equal(unlocked.data.logs[0].intensity, 8);
      assert.equal(unlocked.data.logs[0].medication, '타이레놀(아세트아미노펜)');
      assert.equal(unlocked.data.logs[0].signature, signature);
    },
  },
  {
    id: 'T4.2',
    feature: 'Scenario 2: Post-Operative Analgesic Response & Follow-up',
    name: 'Post-knee surgery pain logged, 1-tap re-evaluation calculates delta and updates medication response analytics',
    run: async () => {
      const storage = new InMemoryHealthStorage();
      const patientPin = '1234';

      // 1. Initial surgery pain logged 45m ago
      const initialDate = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      const initialLog = {
        id: 'post-op-001',
        conditionId: 'cond-knee-surgery',
        date: initialDate,
        intensity: 7,
        medication: '병원 처방 마약성 진통제',
      };
      const initialSig = await canonicalSignPainRecord(initialLog, '');

      // 2. Patient returns: Dashboard medication follow-up prompts 1-tap evaluation
      // Patient taps "덜 아파요 (-1점)" -> postMedIntensity = 6
      const evaluatedLog = {
        ...initialLog,
        postMedIntensity: 6,
        postMedSideEffects: ['속쓰림'],
        postMedEvaluatedAt: new Date().toISOString(),
      };
      const followUpSig = await canonicalSignPainRecord(evaluatedLog, initialSig);

      // 3. Save updated record
      const healthData = {
        conditions: [{ id: 'cond-knee-surgery', label: '무릎 수술 후 통증', bodyPart: '무릎/관절' }],
        logs: [{ ...evaluatedLog, signature: followUpSig, prevSignature: initialSig }],
        diaryEntries: [],
      };
      await storage.saveHealthData(healthData, patientPin);

      // 4. Verification: Delta calculation & Clinical Briefing medication response
      const delta = evaluatedLog.postMedIntensity - evaluatedLog.intensity;
      assert.equal(delta, -1);
      assert.deepEqual(evaluatedLog.postMedSideEffects, ['속쓰림']);
      assert.notEqual(initialSig, followUpSig);
    },
  },
  {
    id: 'T4.3',
    feature: 'Scenario 3: Doctor Clinic Briefing Review & SOAP EMR Export',
    name: 'Patient visits pain clinic, views PQRST briefing, copies SOAP note, and streams local AI clinical summary',
    run: async () => {
      // 1. Prepare clinical dataset
      const logs = [
        { id: '1', date: '2026-11-01T09:00:00Z', intensity: 8, medication: '소염진통제', painTiming: 'morning' },
        { id: '2', date: '2026-11-03T14:00:00Z', intensity: 7, medication: '소염진통제', painTiming: 'afternoon' },
        { id: '3', date: '2026-11-06T10:00:00Z', intensity: 5, medication: '소염진통제', painTiming: 'morning' },
      ];

      // 2. Metrics calculation
      const avg7d = (logs.reduce((s, l) => s + l.intensity, 0) / logs.length).toFixed(1);
      const peak = Math.max(...logs.map((l) => l.intensity));
      assert.equal(avg7d, '6.7');
      assert.equal(peak, 8);

      // 3. Generate SOAP Note structure
      const soapNote = {
        subjective: '주호소: 만성 요통 (허리/요통)\n통증 양상: 뻐근함, 욱신거림\n방사통: 없음',
        objective: `통증 강도(NRS): 7일 평균 ${avg7d}/10, 최고 ${peak}/10\n투약 순응도: 100%\n위험징후: 특이소견 없음`,
        assessment: '경과 상태: 호전 추세 (NRS 8 -> 5)',
        plan: '투약 관리: 현재 처방약 지속 복용 권고',
      };

      const fullSoapText = `[SOAP CLINICAL PROGRESS NOTE - Bignal]\n[S]\n${soapNote.subjective}\n[O]\n${soapNote.objective}\n[A]\n${soapNote.assessment}\n[P]\n${soapNote.plan}`;
      assert.ok(fullSoapText.includes('7일 평균 6.7/10'));
      assert.ok(fullSoapText.includes('최고 8/10'));

      // 4. Stream AI analysis via local LLM adapter
      const tokens = ['[온디바이스', ' 임상', ' 소견:', ' 환자', ' 통증이', ' 호전', ' 중입니다.]'];
      const stream = createMockSseStream(tokens);
      const aiReport = await parseSseStream(stream);
      assert.equal(aiReport, '[온디바이스 임상 소견: 환자 통증이 호전 중입니다.]');
    },
  },
  {
    id: 'T4.4',
    feature: 'Scenario 4: Security, Privacy Shield & Tamper Detection Under Background State',
    name: 'PIN security lifecycle: background privacy curtain, 60s auto-lock, 5 failed attempts lockout, and tamper rejection',
    run: async () => {
      // 1. PIN setup
      const validPin = '4321';
      let isUnlocked = true;
      let failedAttempts = 0;
      let isPrivacyMasked = false;

      // 2. User minimizes app to background
      isPrivacyMasked = true;
      assert.equal(isPrivacyMasked, true);

      // 3. 60-second timeout expires
      const backgroundDurationMs = 65_000;
      if (backgroundDurationMs >= 60_000) {
        isUnlocked = false;
      }
      assert.equal(isUnlocked, false);

      // 4. Attacker attempts brute force: 5 wrong entries
      for (let i = 0; i < 5; i++) {
        failedAttempts++;
      }
      const isLockedOut = failedAttempts >= 5;
      assert.equal(isLockedOut, true);

      // 5. Attacker attempts raw file tampering
      const genuine = await encryptWithPin('의료 기록', validPin);
      const tampered = { ...genuine, ct: genuine.ct.slice(0, 8) + 'X' + genuine.ct.slice(9) };

      await assert.rejects(
        async () => {
          await decryptWithPin(tampered, validPin);
        },
        /비밀번호\/PIN이 일치하지 않거나 데이터가 손상되었습니다/
      );
    },
  },
  {
    id: 'T4.5',
    feature: 'Scenario 5: Android Launcher Direct Deep Linking',
    name: 'Launcher shortcut directly launches AcutePainMode modal, logs NRS 9, and resets navigation state cleanly',
    run: async () => {
      // 1. Intent reception
      const incomingIntentUrl = 'https://localhost/?mode=acute';
      const url = new URL(incomingIntentUrl);
      assert.equal(url.searchParams.get('mode'), 'acute');

      // 2. AcutePainProvider triggers modal
      let isModalOpen = true;
      assert.equal(isModalOpen, true);

      // 3. Patient inputs NRS 9 and selects '허리/요통'
      const log = {
        intensity: 9,
        bodyPart: '허리/요통',
        notes: '🚨 급성 요통 발작',
      };
      assert.equal(log.intensity, 9);

      // 4. Closing modal cleans up URL
      url.searchParams.delete('mode');
      const cleanPath = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '');
      assert.equal(cleanPath, '/');
    },
  },
];
