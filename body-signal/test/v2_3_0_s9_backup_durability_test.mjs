import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bignal-s9-test-'));

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
  globalThis.window = globalThis.window || {};
  globalThis.localStorage = globalThis.localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };

  const healthTypes = await loadTsBundle('src/types/health.ts', 'health.mjs');
  const cryptoMod = await loadTsBundle('src/utils/crypto.ts', 'crypto.mjs');
  const storageMod = await loadTsBundle('src/utils/storage.ts', 'storage.mjs');
  const mediaMod = await loadTsBundle('src/utils/mediaStorage.ts', 'mediaStorage.mjs');

  const tests = [
    {
      name: '1. DiagnosticRecord.recordType defaults to "diagnosis" and supports exam/visit + consultNotes + FilterPresetSchema',
      fn: () => {
        const legacyDiag = healthTypes.DiagnosticRecordSchema.parse({
          id: 'diag-legacy',
          diagnosisDate: '2026-11-20',
          diagnosisName: '급성 요추 염좌',
          createdAt: '2026-11-20T09:00:00.000Z',
          updatedAt: '2026-11-20T09:00:00.000Z',
        });
        assert.equal(legacyDiag.recordType, 'diagnosis');

        const examDiag = healthTypes.DiagnosticRecordSchema.parse({
          id: 'diag-exam',
          recordType: 'exam',
          diagnosisDate: '2026-11-21',
          diagnosisName: '요추 MRI 촬영',
          consultNotes: 'L4-L5 경미한 팽윤 소견 확인',
          createdAt: '2026-11-21T10:00:00.000Z',
          updatedAt: '2026-11-21T10:00:00.000Z',
        });
        assert.equal(examDiag.recordType, 'exam');
        assert.equal(examDiag.consultNotes, 'L4-L5 경미한 팽윤 소견 확인');

        const cond = healthTypes.ConditionSchema.parse({
          id: 'cond-1',
          label: '요통',
          bodyPart: '허리/요통',
          onsetDate: '2026-11-01',
          consultNotes: '차후 외래 시 MRI 결과지 지참',
        });
        assert.equal(cond.consultNotes, '차후 외래 시 MRI 결과지 지참');

        const preset = healthTypes.FilterPresetSchema.parse({
          id: 'fp-1',
          name: '고통증 미청구 건',
          entryTypes: ['diagnostic', 'pain'],
          recordTypes: ['diagnosis', 'exam'],
          claimStatuses: ['pending'],
          minIntensity: 7,
          hasPhotos: true,
          sortBy: 'deadline_asc',
        });
        assert.equal(preset.sortBy, 'deadline_asc');
        const settingsParsed = healthTypes.UserSettingsSchema.parse({ filterPresets: [preset] });
        assert.equal(settingsParsed.filterPresets.length, 1);
      },
    },
    {
      name: '2. ensurePersistentStorage requests durable storage & detects low space safely',
      fn: async () => {
        const origNavigator = globalThis.navigator;
        try {
          Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
              storage: {
                persisted: async () => false,
                persist: async () => true,
                estimate: async () => ({ usage: 90 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
              },
            },
          });
          const lowReport = await storageMod.ensurePersistentStorage();
          assert.equal(lowReport.supported, true);
          assert.equal(lowReport.persisted, true);
          assert.equal(lowReport.isLowSpace, true);

          Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
              storage: {
                persisted: async () => true,
                estimate: async () => ({ usage: 5 * 1024 * 1024, quota: 1024 * 1024 * 1024 }),
              },
            },
          });
          const okReport = await storageMod.ensurePersistentStorage();
          assert.equal(okReport.persisted, true);
          assert.equal(okReport.isLowSpace, false);
        } finally {
          if (origNavigator !== undefined) {
            Object.defineProperty(globalThis, 'navigator', { configurable: true, value: origNavigator });
          }
        }
      },
    },
    {
      name: '3. findOrphanMediaIds collects only unreferenced diag_photo_* entries safely',
      fn: () => {
        const orphans = mediaMod.findOrphanMediaIds(
          ['diag_photo_keep', 'diag_photo_deleted', 'diag_photo_stale', 'unrelated_key'],
          [
            {
              id: 'd-active',
              diagnosisDate: '2026-11-20',
              diagnosisName: 'X-Ray',
              photoIds: ['diag_photo_keep'],
              createdAt: '2026-11-20T00:00:00.000Z',
              updatedAt: '2026-11-20T00:00:00.000Z',
            },
            {
              id: 'd-deleted',
              diagnosisDate: '2026-11-19',
              diagnosisName: 'Old',
              photoIds: ['diag_photo_deleted'],
              deletedAt: '2026-11-21T00:00:00.000Z',
              createdAt: '2026-11-19T00:00:00.000Z',
              updatedAt: '2026-11-21T00:00:00.000Z',
            },
          ]
        );
        assert.deepEqual(orphans, ['diag_photo_deleted', 'diag_photo_stale']);
      },
    },
    {
      name: '4. bignal-encrypted-backup-v2 encrypts settings + chunked media & preserves v1 compatibility',
      fn: async () => {
        const coreJson = JSON.stringify({
          schemaVersion: 2,
          conditions: [{ id: 'c1', label: '두통', bodyPart: '머리/안면', onsetDate: '2026-11-01', isArchived: false }],
          logs: [],
          diaryEntries: [],
          diagnosticRecords: [],
        });
        const mediaMap = {
          diag_photo_1: 'data:image/jpeg;base64,' + 'A'.repeat(60),
          diag_photo_2: 'data:image/jpeg;base64,' + 'B'.repeat(60),
        };
        const settingsSample = { ...healthTypes.DEFAULT_USER_SETTINGS, themeAccent: 'teal' };

        const v2Raw = await cryptoMod.encryptBackupWithPassphrase(coreJson, 'BackupPass123!', {
          format: 'v2',
          schemaVersion: 2,
          settings: settingsSample,
          media: mediaMap,
          chunkMaxBytes: 90,
        });
        const parsedV2 = JSON.parse(v2Raw);
        assert.equal(parsedV2.format, 'bignal-encrypted-backup-v2');
        assert.equal(parsedV2.schemaVersion, 2);
        assert.equal(parsedV2.mediaChunks.length, 2, 'Media exceeding chunkMaxBytes must split across chunks');

        const info = cryptoMod.inspectBackupEnvelope(v2Raw);
        assert.equal(info.format, 'bignal-encrypted-backup-v2');
        assert.equal(info.isEncrypted, true);
        assert.equal(info.mediaChunkCount, 2);

        const decryptedV2 = JSON.parse(await cryptoMod.decryptBackupWithPassphrase(v2Raw, 'BackupPass123!'));
        assert.equal(decryptedV2.settings.themeAccent, 'teal');
        assert.deepEqual(decryptedV2.encryptedMedia, mediaMap);

        // Tamper detection on media chunk
        const tampered = JSON.parse(v2Raw);
        tampered.mediaChunks[0].ct = 'AAAA' + tampered.mediaChunks[0].ct.slice(4);
        await assert.rejects(() =>
          cryptoMod.decryptBackupWithPassphrase(JSON.stringify(tampered), 'BackupPass123!')
        );

        // Legacy v1 still round-trips identically
        const v1Raw = await cryptoMod.encryptBackupWithPassphrase(coreJson, 'LegacyPass123!');
        assert.equal(cryptoMod.inspectBackupEnvelope(v1Raw).format, 'bignal-encrypted-backup-v1');
        assert.equal(await cryptoMod.decryptBackupWithPassphrase(v1Raw, 'LegacyPass123!'), coreJson);
      },
    },
    {
      name: '5. HealthContext & Settings wire rollback snapshot, orphan GC, persistence report, and overwrite warning',
      fn: () => {
        const healthSrc = fs.readFileSync(path.join(ROOT, 'src/context/HealthContext.tsx'), 'utf8');
        assert.match(healthSrc, /ensurePersistentStorage\(\)/);
        assert.match(healthSrc, /garbageCollectOrphanMedia\(/);
        assert.match(healthSrc, /rollbackSettings/);
        assert.match(healthSrc, /exportFullBackupBundle/);

        const settingsSrc = fs.readFileSync(path.join(ROOT, 'src/pages/Settings.tsx'), 'utf8');
        assert.match(settingsSrc, /format:\s*'v2'/);
        assert.match(settingsSrc, /reloadSettings\(\)/);
        assert.match(settingsSrc, /overwrites existing local records/);
      },
    },
  ];

  let passed = 0;
  for (const t of tests) {
    await t.fn();
    console.log(`PASS: ${t.name}`);
    passed++;
  }
  console.log(`\nALL ${passed}/${tests.length} v2.3.0 §9 RECORDS, DURABILITY & BACKUP V2 TESTS PASSED`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
