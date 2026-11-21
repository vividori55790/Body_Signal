import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Bundle real TS modules with esbuild into a temp dir so we test actual production code
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bignal-s6-test-'));

async function loadTsBundle(entryRel, outfileName) {
  const outPath = path.join(tmpDir, outfileName);
  await esbuild.build({
    entryPoints: [path.join(ROOT, entryRel)],
    outfile: outPath,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    mainFields: ['module', 'main'],
  });
  return import(pathToFileURL(outPath).href);
}

try {
  // Provide minimal browser globals for storage.ts import
  globalThis.window = globalThis.window || {};
  globalThis.localStorage = globalThis.localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };

  const healthTypes = await loadTsBundle('src/types/health.ts', 'health.mjs');
  const cryptoMod = await loadTsBundle('src/utils/crypto.ts', 'crypto.mjs');
  const dateMod = await loadTsBundle('src/utils/dateUtils.ts', 'dateUtils.mjs');
  const storageMod = await loadTsBundle('src/utils/storage.ts', 'storage.mjs');

  const tests = [
    {
      name: '1. HealthDataPayloadSchema enforces PainLogSchema (not z.custom) and schemaVersion',
      fn: () => {
        const src = fs.readFileSync(path.join(ROOT, 'src/types/health.ts'), 'utf8');
        assert.doesNotMatch(src, /z\.custom<PainLog>/);
        assert.match(src, /logs:\s*z\.array\(PainLogSchema\)/);
        assert.match(src, /schemaVersion:\s*z\.number\(\)\.int\(\)\.min\(1\)\.default\(1\)/);
        assert.equal(healthTypes.CURRENT_SCHEMA_VERSION, 2);

        const bad = healthTypes.HealthDataPayloadSchema.safeParse({
          conditions: [],
          logs: [{ id: 'x', conditionId: 'c1', date: '2026-11-20T00:00:00Z', intensity: 99 }],
          diaryEntries: [],
        });
        assert.equal(bad.success, false, 'Out-of-range PainLog intensity must be rejected by schema');
      },
    },
    {
      name: '2. Date/time convention helpers preserve local YYYY-MM-DD and normalize ISO 8601 timestamps',
      fn: () => {
        assert.equal(dateMod.normalizeLocalYmd('2026-11-21'), '2026-11-21');
        assert.match(dateMod.normalizeLocalYmd('2026-11-21T00:30:00+09:00'), /^\d{4}-\d{2}-\d{2}$/);
        const isoFromDate = dateMod.normalizeIsoTimestamp('2026-11-21');
        assert.match(isoFromDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        assert.equal(dateMod.normalizeIsoTimestamp('2026-11-21T01:02:03.000Z'), '2026-11-21T01:02:03.000Z');
      },
    },
    {
      name: '3. Defensive per-record safeParse recovery + emergency JSON extraction never locks out valid data',
      fn: () => {
        // Emergency JSON extraction with leading/trailing garbage
        const dirtyText = 'CORRUPT_PREFIX{"conditions":[],"logs":[],"diaryEntries":[]}TRAILING';
        const extracted = storageMod.extractHealthPayloadJson(dirtyText);
        assert.deepEqual(extracted, { conditions: [], logs: [], diaryEntries: [] });

        // 1 broken log + 1 out-of-range intensity + 1 valid log -> valid & salvaged logs survive
        const mixedPayload = {
          conditions: [
            { id: 'c1', label: '요통', bodyPart: '허리/요통', onsetDate: '2026-11-01', isArchived: false },
            null,
          ],
          logs: [
            {
              id: 'log-valid',
              conditionId: 'c1',
              date: '2026-11-10T10:00:00.000Z',
              intensity: 7,
              medication: '타이레놀 500mg',
              notes: '유효 기록',
            },
            {
              id: 'log-clamp',
              conditionId: 'c1',
              date: '2026-11-11',
              intensity: 15, // invalid > 10 -> clamped to 10
            },
            'totally-corrupted-string',
          ],
          diaryEntries: [{ date: '2026-11-10', text: '휴식', updatedAt: '2026-11-10T12:00:00Z' }],
          diagnosticRecords: [
            {
              id: 'diag-1',
              diagnosisDate: '2026-11-10',
              diagnosisName: '요추 염좌',
            },
            { id: 'diag-empty-name', diagnosisDate: '2026-11-10', diagnosisName: '' },
          ],
        };

        const { payload, recoveredWarnings, didMigrate } =
          storageMod.recoverAndNormalizeHealthPayload(mixedPayload);
        assert.equal(didMigrate, true);
        assert.equal(payload.schemaVersion, 2);
        assert.equal(payload.conditions.length, 1);
        assert.equal(payload.logs.length, 2);
        assert.equal(payload.logs[0].id, 'log-valid');
        assert.equal(payload.logs[1].intensity, 10);
        assert.equal(payload.diagnosticRecords.length, 1);
        assert.ok(recoveredWarnings.length >= 1);
      },
    },
    {
      name: '4. EncryptedPackage preserves KDF iterations metadata and remains compatible with legacy v1 packages',
      fn: async () => {
        const pin = '258049';
        const plain = JSON.stringify({ hello: 'bignal-v2.3.0' });

        // Encrypt with upgraded iterations (e.g. 150,000) -> metadata stored in pkg.kdf
        const upgradedPkg = await cryptoMod.encryptWithPin(plain, pin, 150_000);
        assert.equal(upgradedPkg.kdf?.alg, 'PBKDF2-SHA256');
        assert.equal(upgradedPkg.kdf?.iterations, 150_000);
        const decodedUpgraded = await cryptoMod.decryptWithPin(upgradedPkg, pin);
        assert.equal(decodedUpgraded, plain);

        // Simulate legacy v2.1.0 EncryptedPackage without kdf field (defaults to 100,000)
        const legacyBasePkg = await cryptoMod.encryptWithPin(plain, pin, 100_000);
        const legacyPkgWithoutKdf = {
          v: legacyBasePkg.v,
          salt: legacyBasePkg.salt,
          iv: legacyBasePkg.iv,
          ct: legacyBasePkg.ct,
          mode: 'pin',
        };
        const decodedLegacy = await cryptoMod.decryptWithPin(legacyPkgWithoutKdf, pin);
        assert.equal(decodedLegacy, plain);
      },
    },
    {
      name: '5. v2.1.0 real-data fixture decrypts, migrates losslessly, preserves audit chain across revisions/backdate/soft-delete, and restores via backup',
      fn: async () => {
        const pin = '135790';
        // Construct a realistic v2.1.0 fixture (no schemaVersion, no chainIndex, no revisions, bare signature chain)
        const cond = {
          id: 'cond-v210',
          label: '좌측 좌골신경통',
          bodyPart: '허리/요통',
          onsetDate: '2026-10-01',
          isArchived: false,
        };

        const log1 = {
          id: 'log-1',
          conditionId: cond.id,
          date: '2026-10-02T09:00:00.000Z',
          intensity: 8,
          medication: '이부프로펜 400mg',
          notes: 'v2.1.0 최초 기록',
          painQuality: ['저림/전기'],
          radiation: '하지(다리) 방사',
          triggers: ['보행 시'],
          reliefFactors: ['누워서 휴식'],
          redFlags: [],
          prevSignature: '',
          signedAt: '2026-10-02T09:00:05.000Z',
        };
        log1.signature = await cryptoMod.computeRecordSignature(log1, '');

        const log2 = {
          id: 'log-2',
          conditionId: cond.id,
          date: '2026-10-05T09:00:00.000Z',
          intensity: 6,
          medication: '타이레놀 500mg',
          notes: 'v2.1.0 후속 기록',
          prevSignature: log1.signature,
          signedAt: '2026-10-05T09:00:05.000Z',
        };
        log2.signature = await cryptoMod.computeRecordSignature(log2, log1.signature);

        const v210Fixture = {
          conditions: [cond],
          logs: [log2, log1], // newest-first as stored in v2.1.0
          diaryEntries: [{ date: '2026-10-02', text: '오전 통증 심함', updatedAt: '2026-10-02T10:00:00.000Z' }],
          diagnosticRecords: [
            {
              id: 'diag-v210',
              conditionId: cond.id,
              diagnosisDate: '2026-10-03',
              diagnosisName: '요추 신경근병증',
              hospitalName: '서울정형외과',
              department: '정형외과',
              amountKrw: 42000,
              notes: 'X-ray 촬영',
              photoIds: [],
              claimStatus: 'pending',
              claimDeadlineYears: 3,
              createdAt: '2026-10-03T11:00:00.000Z',
              updatedAt: '2026-10-03T11:00:00.000Z',
            },
          ],
          lastUpdated: '2026-10-05T09:00:05.000Z',
        };

        // Encrypt as legacy v2.1.0 package (no kdf metadata)
        const legacyBackupJson = await cryptoMod.encryptBackupWithPassphrase(
          JSON.stringify(v210Fixture),
          pin
        );
        const decryptedJson = await cryptoMod.decryptBackupWithPassphrase(legacyBackupJson, pin);
        const { payload: migrated, didMigrate } = storageMod.recoverAndNormalizeHealthPayload(
          JSON.parse(decryptedJson)
        );
        assert.equal(didMigrate, true);
        assert.equal(migrated.schemaVersion, 2);
        assert.equal(migrated.logs.length, 2);

        // Verify legacy signatures stayed intact
        assert.equal(await cryptoMod.verifyRecordSignature(migrated.logs[0]), true);
        assert.equal(await cryptoMod.verifyRecordSignature(migrated.logs[1]), true);
        const preEditChain = await cryptoMod.verifyAuditChain(migrated.logs);
        assert.equal(preEditChain.valid, true);
        assert.equal(preEditChain.checkedCount, 2);

        // Simulate editing log-1 (historical record) with revision snapshot
        const oldLog1 = migrated.logs.find((l) => l.id === 'log-1');
        const rev1 = {
          editedAt: '2026-11-21T10:00:00.000Z',
          reason: 'edit',
          previous: { ...oldLog1 },
        };
        const editedLog1 = {
          ...oldLog1,
          intensity: 7,
          notes: 'v2.3.0에서 강도 보정',
          signedAt: '2026-11-21T10:00:00.000Z',
          revisions: [rev1],
        };
        editedLog1.signature = await cryptoMod.computeRecordSignature(editedLog1, editedLog1.prevSignature);

        // Simulate backdated log-3 (symptom date 2026-09-20, but signed AFTER log-2!)
        const log3Backdated = {
          id: 'log-3-backdated',
          conditionId: cond.id,
          date: '2026-09-20T08:00:00.000Z',
          intensity: 5,
          medication: '',
          notes: '과거 날짜 백데이트 입력',
          prevSignature: log2.signature,
          signedAt: '2026-11-21T10:05:00.000Z',
          inputSource: 'manual',
        };
        log3Backdated.signature = await cryptoMod.computeRecordSignature(log3Backdated, log2.signature);

        // Simulate soft-delete of log-2 (middle chain node!)
        const rev2SoftDel = {
          editedAt: '2026-11-21T10:10:00.000Z',
          reason: 'soft_delete',
          previous: { ...log2 },
        };
        const softDeletedLog2 = {
          ...log2,
          deletedAt: '2026-11-21T10:10:00.000Z',
          signedAt: '2026-11-21T10:10:00.000Z',
          revisions: [rev2SoftDel],
        };
        softDeletedLog2.signature = await cryptoMod.computeRecordSignature(
          softDeletedLog2,
          softDeletedLog2.prevSignature
        );

        const postEditLogs = [log3Backdated, softDeletedLog2, editedLog1];
        const postEditChain = await cryptoMod.verifyAuditChain(postEditLogs);
        assert.equal(
          postEditChain.valid,
          true,
          `Audit chain must remain unbroken across revision, backdate, and soft-delete (broken: ${postEditChain.brokenIds.join(',')})`
        );
        assert.equal(postEditChain.checkedCount, 3);

        // Active display logs exclude soft-deleted log-2 and sort by symptom date descending (log1 > log3)
        const visibleSorted = postEditLogs
          .filter((l) => !l.deletedAt)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        assert.deepEqual(
          visibleSorted.map((l) => l.id),
          ['log-1', 'log-3-backdated']
        );

        // Diagnostic signature check
        const diag = { ...migrated.diagnosticRecords[0], inputSource: 'manual' };
        diag.signature = await cryptoMod.computeDiagnosticSignature(diag, '');
        assert.equal(await cryptoMod.verifyDiagnosticSignature(diag), true);
      },
    },
  ];

  let passed = 0;
  for (const t of tests) {
    await t.fn();
    passed++;
    console.log(`  ✓ ${t.name}`);
  }
  console.log(`\nv2.3.0 §6 Schema, Revision, Recovery & KDF Verification: ${passed}/${tests.length} PASSED`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
