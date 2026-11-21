import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bignal-s8-test-'));

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
  const healthTypes = await loadTsBundle('src/types/health.ts', 'health.mjs');
  const medMod = await loadTsBundle('src/utils/medication.ts', 'medication.mjs');

  const tests = [
    {
      name: '1. MedicationSchema supports condition scoping, schedule, PRN, and inventory fields with separated name/dosage',
      fn: () => {
        for (const p of healthTypes.DEFAULT_MEDICATION_PRESETS) {
          assert.ok(!/\d+\s*mg$/i.test(p.name), `Default preset "${p.name}" must keep dosage separate from name`);
        }

        assert.deepEqual(medMod.normalizeMedicationNameDosage('타이레놀 500mg'), {
          name: '타이레놀',
          dosage: '500mg',
        });
        assert.deepEqual(medMod.normalizeMedicationNameDosage('Celebrex', '200mg'), {
          name: 'Celebrex',
          dosage: '200mg',
        });

        const legacyParsed = healthTypes.MedicationSchema.parse({ id: 'legacy-1', name: 'Tylenol', dosage: '500mg' });
        assert.equal(legacyParsed.isActive, true);

        const courseParsed = healthTypes.MedicationSchema.parse({
          id: 'course-1',
          name: '세레브렉스',
          dosage: '200mg',
          conditionId: 'cond-knee',
          isActive: true,
          startedAt: '2026-11-01',
          scheduleSlots: ['morning', 'evening'],
          isPrn: false,
          remainingCount: 14,
          totalCount: 30,
          unit: '정',
          lowStockThreshold: 5,
        });
        assert.equal(courseParsed.conditionId, 'cond-knee');
        assert.deepEqual(courseParsed.scheduleSlots, ['morning', 'evening']);
        assert.equal(courseParsed.remainingCount, 14);
      },
    },
    {
      name: '2. Medication stock deduction, refill, and low-stock threshold helpers behave safely',
      fn: () => {
        const med = {
          id: 'm-stock',
          name: '이부프로펜',
          dosage: '400mg',
          remainingCount: 4,
          totalCount: 10,
          unit: '정',
          lowStockThreshold: 3,
        };
        assert.equal(medMod.isMedicationLowStock(med), false);

        const afterOne = medMod.deductMedicationStock(med, 1);
        assert.equal(afterOne.remainingCount, 3);
        assert.equal(medMod.isMedicationLowStock(afterOne), true);

        const floored = medMod.deductMedicationStock(afterOne, 10);
        assert.equal(floored.remainingCount, 0);

        const refilled = medMod.refillMedicationStock(floored, 20);
        assert.equal(refilled.remainingCount, 20);
        assert.equal(refilled.totalCount, 20);
      },
    },
    {
      name: '3. prioritizeConditionMedications ranks active condition-linked meds above global and other-condition meds',
      fn: () => {
        const list = [
          { id: 'global-1', name: '타이레놀', dosage: '500mg', isActive: true },
          { id: 'other-1', name: '수마트립탄', conditionId: 'cond-migraine', isActive: true },
          { id: 'inactive-knee', name: '구약물', conditionId: 'cond-knee', isActive: false },
          { id: 'knee-1', name: '세레브렉스', dosage: '200mg', conditionId: 'cond-knee', isActive: true },
        ];
        const prioritized = medMod.prioritizeConditionMedications(list, 'cond-knee');
        assert.deepEqual(
          prioritized.map((m) => m.id),
          ['knee-1', 'global-1', 'other-1']
        );
      },
    },
    {
      name: '4. Condition archival closes condition-linked active meds while PainLog preserves permanent snapshot + medicationIds',
      fn: () => {
        const presets = [
          { id: 'global', name: '타이레놀', isActive: true },
          { id: 'cond-med', name: '근이완제', conditionId: 'cond-back', isActive: true },
        ];
        const closed = medMod.deactivateConditionMedications(presets, 'cond-back', '2026-11-21');
        assert.equal(closed.find((p) => p.id === 'global').isActive, true);
        assert.equal(closed.find((p) => p.id === 'cond-med').isActive, false);
        assert.equal(closed.find((p) => p.id === 'cond-med').endedAt, '2026-11-21');

        const parsedLog = healthTypes.PainLogSchema.parse({
          id: 'log-med-1',
          conditionId: 'cond-back',
          date: '2026-11-21T09:00:00.000Z',
          intensity: 6,
          medication: '근이완제',
          medicationIds: ['cond-med'],
          medTakenAt: '2026-11-21T08:55:00.000Z',
        });
        assert.equal(parsedLog.medication, '근이완제');
        assert.deepEqual(parsedLog.medicationIds, ['cond-med']);
        assert.equal(parsedLog.medTakenAt, '2026-11-21T08:55:00.000Z');
      },
    },
    {
      name: '5. EntryForm, QuickPainLogger, AddMedicationInline, Dashboard, and HealthContext wire §8 flows end-to-end',
      fn: () => {
        const entrySrc = fs.readFileSync(path.join(ROOT, 'src/pages/EntryForm.tsx'), 'utf8');
        assert.match(entrySrc, /prioritizeConditionMedications\(/);
        assert.match(entrySrc, /adjustMedicationStock\(/);

        const quickSrc = fs.readFileSync(path.join(ROOT, 'src/components/QuickPainLogger.tsx'), 'utf8');
        assert.match(quickSrc, /prioritizeConditionMedications\(/);
        assert.match(quickSrc, /adjustMedicationStock\(/);

        const inlineSrc = fs.readFileSync(path.join(ROOT, 'src/components/AddMedicationInline.tsx'), 'utf8');
        assert.match(inlineSrc, /conditionId/);

        const healthSrc = fs.readFileSync(path.join(ROOT, 'src/context/HealthContext.tsx'), 'utf8');
        assert.match(healthSrc, /medicationIds:\s*log\.medicationIds/);
        assert.match(healthSrc, /resolvedAt/);

        const dashSrc = fs.readFileSync(path.join(ROOT, 'src/pages/Dashboard.tsx'), 'utf8');
        assert.match(dashSrc, /deactivateMedicationsForCondition/);
      },
    },
  ];

  let passed = 0;
  for (const t of tests) {
    await t.fn();
    console.log(`PASS: ${t.name}`);
    passed++;
  }
  console.log(`\nALL ${passed}/${tests.length} v2.3.0 §8 MEDICATION SCHEMA & COURSE TESTS PASSED`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
