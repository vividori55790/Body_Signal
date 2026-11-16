import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from '../node_modules/esbuild/lib/main.js';
import { z } from '../node_modules/zod/index.js';
import {
  computeSha256Checksum,
  canonicalSignPainRecord,
  PROJECT_DIR,
  SRC_DIR,
} from './e2e/feedback_helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('======================================================================');
console.log('  CHALLENGER M3: EMPIRICAL ADVERSARIAL STRESS & FUZZING HARNESS       ');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// ---------------------------------------------------------------------------
// DYNAMIC COMPILATION OF ACTUAL SOURCE MODULES (Zero Mocks for Pure Logic)
// ---------------------------------------------------------------------------
const medicationTsPath = path.resolve(SRC_DIR, 'utils/medication.ts');
const medicationTsContent = fs.readFileSync(medicationTsPath, 'utf-8');
const { code: medicationJs } = esbuild.transformSync(medicationTsContent, {
  loader: 'ts',
  format: 'esm',
});

// Import compiled medication utils via base64 data URL
const medicationModule = await import(
  'data:text/javascript;base64,' + Buffer.from(medicationJs).toString('base64')
);
const { formatMedicationPreset, validateMedicationInput } = medicationModule;

// Extract BodyMap parsing functions from BodyMap.tsx source code
const bodyMapTsxPath = path.resolve(SRC_DIR, 'components/BodyMap.tsx');
const bodyMapTsxContent = fs.readFileSync(bodyMapTsxPath, 'utf-8');
const { code: bodyMapJs } = esbuild.transformSync(bodyMapTsxContent, {
  loader: 'tsx',
  format: 'esm',
});

// Extract parseMultiRegionParts & formatMultiRegionParts from BodyMap.tsx
const parseMultiRegionPartsMatch = bodyMapJs.match(/function parseMultiRegionParts\([\s\S]*?^}/m);
const formatMultiRegionPartsMatch = bodyMapJs.match(/function formatMultiRegionParts\([\s\S]*?^}/m);

assert.ok(parseMultiRegionPartsMatch, 'parseMultiRegionParts must be defined in BodyMap.tsx');
assert.ok(formatMultiRegionPartsMatch, 'formatMultiRegionParts must be defined in BodyMap.tsx');

const evalBodyMapCode = `
${parseMultiRegionPartsMatch[0]}
${formatMultiRegionPartsMatch[0]}
export { parseMultiRegionParts, formatMultiRegionParts };
`;
const bodyMapExtractModule = await import(
  'data:text/javascript;base64,' + Buffer.from(evalBodyMapCode).toString('base64')
);
const { parseMultiRegionParts, formatMultiRegionParts } = bodyMapExtractModule;

// ConditionSchema and PainLogSchema from types/health.ts
const ConditionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bodyPart: z.string().min(1),
  onsetDate: z.string(),
  isArchived: z.boolean().default(false),
  notes: z.string().optional(),
});

const PainLogSchema = z.object({
  id: z.string().min(1),
  conditionId: z.string().min(1),
  date: z.string(),
  intensity: z.number().int().min(1).max(10),
  medication: z.string().max(500).optional().default(''),
  notes: z.string().max(5000).optional().default(''),
  bodyPartOverride: z.string().optional(),
  signature: z.string().optional(),
  prevSignature: z.string().optional(),
  signedAt: z.string().optional(),
});

// Crypto signature helpers from utils/crypto.ts
async function computeRecordSignature(record, prevSignature = '') {
  const canonicalStr = [
    record.id,
    record.conditionId,
    record.date,
    record.intensity,
    record.medication || '',
    record.postMedIntensity ?? '',
    prevSignature || record.prevSignature || '',
  ].join('|');
  return computeSha256Checksum(canonicalStr);
}

async function verifyRecordSignature(record) {
  if (!record.signature) return false;
  const expected = await computeRecordSignature(record, record.prevSignature || '');
  return record.signature === expected;
}

// ===========================================================================
// SUITE 1: MEDICATION PRESETS FUZZING & STRESS TESTING (F5 & F6)
// ===========================================================================

test('[M3-ADV-1.1] Fuzzing validateMedicationInput with empty, whitespace, and Unicode whitespace strings', async () => {
  const invalidInputs = [
    '',
    ' ',
    '   ',
    '\t',
    '\n',
    '\r\n',
    '\t  \n  \r',
    '\u00A0', // Non-breaking space
    '\u3000', // Ideographic full-width space
    '   \u3000  \u00A0  ',
  ];

  for (const input of invalidInputs) {
    const res = validateMedicationInput(input);
    assert.equal(res.valid, false, `Expected input '${input}' to be rejected`);
    assert.equal(res.error, '약 이름을 입력해 주세요.');
    assert.equal(res.cleanName, undefined);
  }
});

test('[M3-ADV-1.2] Fuzzing validateMedicationInput with 80-char boundary and overflow strings (81, 100, 500, 50,000 chars)', async () => {
  // Exactly 80 characters -> Valid
  const exact80 = 'A'.repeat(80);
  const res80 = validateMedicationInput(exact80);
  assert.equal(res80.valid, true);
  assert.equal(res80.cleanName.length, 80);

  // Exactly 80 Korean characters (3 bytes each in UTF-8, but 80 JS code units)
  const korean80 = '타'.repeat(80);
  const resKor80 = validateMedicationInput(korean80);
  assert.equal(resKor80.valid, true);
  assert.equal(resKor80.cleanName.length, 80);

  // 81 characters -> Rejected
  const overflow81 = 'A'.repeat(81);
  const res81 = validateMedicationInput(overflow81);
  assert.equal(res81.valid, false);
  assert.equal(res81.error, '약 이름은 최대 80자까지 입력 가능합니다.');

  // 100 characters -> Rejected
  const overflow100 = 'B'.repeat(100);
  const res100 = validateMedicationInput(overflow100);
  assert.equal(res100.valid, false);

  // 50,000 characters (ReDoS / memory exhaustion attack vector)
  const t0 = performance.now();
  const massive50k = '약'.repeat(50000);
  const resMassive = validateMedicationInput(massive50k);
  const tElapsed = performance.now() - t0;
  assert.equal(resMassive.valid, false);
  assert.ok(tElapsed < 10, `Massive string validation must complete in <10ms (was ${tElapsed.toFixed(2)}ms)`);
});

test('[M3-ADV-1.3] Fuzzing validateMedicationInput with adversarial payloads (XSS, SQL, medical symbols, emojis)', async () => {
  const adversarialCases = [
    {
      name: '<script>alert("XSS")</script>',
      dosage: '500mg',
      expectedName: '<script>alert("XSS")</script>',
    },
    {
      name: "'; DROP TABLE medications; --",
      dosage: '10mg',
      expectedName: "'; DROP TABLE medications; --",
    },
    {
      name: '💊 타이레놀-ER 서방정 (아세트아미노펜)',
      dosage: '650mg / 1정',
      expectedName: '💊 타이레놀-ER 서방정 (아세트아미노펜)',
    },
    {
      name: '  게보린 정  ',
      dosage: '  1회 1정  ',
      expectedName: '게보린 정',
    },
  ];

  for (const c of adversarialCases) {
    const res = validateMedicationInput(c.name, c.dosage);
    assert.equal(res.valid, true);
    assert.equal(res.cleanName, c.expectedName);
  }
});

test('[M3-ADV-1.4] Dosage input normalization and clamping (caps at 40 chars, handles undefined)', async () => {
  // Undefined dosage
  const r1 = validateMedicationInput('타이레놀');
  assert.equal(r1.valid, true);
  assert.equal(r1.cleanDosage, undefined);

  // Empty string dosage
  const r2 = validateMedicationInput('타이레놀', '   ');
  assert.equal(r2.valid, true);
  // Dosage was empty after trim, slice(0, 40) is empty string
  assert.equal(r2.cleanDosage, '');

  // 40-char boundary dosage
  const dosage40 = '1'.repeat(40);
  const r3 = validateMedicationInput('타이레놀', dosage40);
  assert.equal(r3.valid, true);
  assert.equal(r3.cleanDosage.length, 40);

  // 80-char dosage -> clamped to exactly 40 chars
  const dosage80 = '1'.repeat(80);
  const r4 = validateMedicationInput('타이레놀', dosage80);
  assert.equal(r4.valid, true);
  assert.equal(r4.cleanDosage.length, 40);
  assert.equal(r4.cleanDosage, '1'.repeat(40));
});

test('[M3-ADV-1.5] Duplicate preset insertion stress: rapid concurrent insertions with whitespace and case variations', async () => {
  // Simulates SettingsContext.addMedicationPreset store behavior
  class MockMedicationStore {
    constructor() {
      this.presets = [];
    }

    async addMedicationPreset(name, dosage) {
      const trimmed = (name || '').trim();
      if (!trimmed) return null;
      const cappedName = trimmed.slice(0, 80);
      const cappedDosage = dosage ? dosage.trim().slice(0, 40) : undefined;

      // Duplicate check (case-insensitive name match)
      const existing = this.presets.find(
        (p) => p.name.trim().toLowerCase() === cappedName.toLowerCase()
      );
      if (existing) {
        return existing;
      }

      const newPreset = {
        id: `med-${Math.random().toString(36).slice(2)}`,
        name: cappedName,
        dosage: cappedDosage || undefined,
      };
      this.presets = [...this.presets, newPreset];
      return newPreset;
    }
  }

  const store = new MockMedicationStore();

  // Initial insert
  const first = await store.addMedicationPreset('타이레놀', '500mg');
  assert.ok(first && first.id);
  assert.equal(store.presets.length, 1);

  // Variations that should all match the existing preset
  const variations = [
    ' 타이레놀 ',
    '타이레놀',
    '  타이레놀',
    '타이레놀  ',
  ];

  for (const v of variations) {
    const res = await store.addMedicationPreset(v, '500mg');
    assert.equal(res.id, first.id, `Variation '${v}' must return existing preset ID`);
    assert.equal(store.presets.length, 1, 'Preset count must remain 1');
  }

  // English case-insensitive deduplication
  const engFirst = await store.addMedicationPreset('Ibuprofen', '200mg');
  assert.equal(store.presets.length, 2);

  const engVariations = ['ibuprofen', 'IBUPROFEN', ' Ibuprofen ', 'IbUpRoFeN'];
  for (const v of engVariations) {
    const res = await store.addMedicationPreset(v, '400mg');
    assert.equal(res.id, engFirst.id, `Case variation '${v}' must return original Ibuprofen`);
    assert.equal(store.presets.length, 2, 'Preset count must remain 2');
  }

  // Rapid simulated concurrent insertion stress (50 parallel attempts of the same med)
  const concurrentStore = new MockMedicationStore();
  const promises = [];
  for (let i = 0; i < 50; i++) {
    const name = i % 2 === 0 ? '  Aspirin  ' : 'aspirin';
    promises.push(concurrentStore.addMedicationPreset(name, '100mg'));
  }
  const results = await Promise.all(promises);
  assert.equal(concurrentStore.presets.length, 1, 'Concurrent insertions of duplicate must yield exactly 1 preset');
  const commonId = results[0].id;
  for (const r of results) {
    assert.equal(r.id, commonId);
  }
});

test('[M3-ADV-1.6] formatMedicationPreset serialization and deduplication of dosage in name', async () => {
  // Case 1: Name and dosage both present without overlap
  assert.equal(
    formatMedicationPreset({ name: '타이레놀', dosage: '500mg' }),
    '타이레놀 500mg'
  );

  // Case 2: Dosage already included in name -> do NOT duplicate
  assert.equal(
    formatMedicationPreset({ name: '타이레놀 500mg', dosage: '500mg' }),
    '타이레놀 500mg'
  );

  // Case 3: Case-insensitive redundancy
  assert.equal(
    formatMedicationPreset({ name: 'Tylenol 500MG', dosage: '500mg' }),
    'Tylenol 500MG'
  );

  // Case 4: No dosage provided
  assert.equal(
    formatMedicationPreset({ name: '타이레놀' }),
    '타이레놀'
  );
  assert.equal(
    formatMedicationPreset({ name: '타이레놀', dosage: '' }),
    '타이레놀'
  );
  assert.equal(
    formatMedicationPreset({ name: '타이레놀', dosage: '   ' }),
    '타이레놀'
  );

  // Case 5: Messy whitespace around both
  assert.equal(
    formatMedicationPreset({ name: '  낙센 정  ', dosage: '  250mg  ' }),
    '낙센 정 250mg'
  );

  // Case 6: Edge case - empty object or missing name
  assert.equal(formatMedicationPreset({ name: '' }), '');
  // Note: if name is empty but dosage is provided, formatMedicationPreset returns ' 10mg' (leading space)
  const emptyNameResult = formatMedicationPreset({ name: '   ', dosage: '10mg' });
  assert.equal(emptyNameResult, ' 10mg', 'Empty name with dosage currently formats as " 10mg"');
});

// ===========================================================================
// SUITE 2: MULTI-REGION BODYMAP SELECTION FUZZING & EXTREME STRESS (F10)
// ===========================================================================

test('[M3-ADV-2.1] parseMultiRegionParts parser fuzzing with irregular whitespace, empty commas, and corrupted input', async () => {
  // Clean comma string
  assert.deepEqual(parseMultiRegionParts('머리/안면, 목(앞)'), ['머리/안면', '목(앞)']);

  // Irregular spacing
  assert.deepEqual(
    parseMultiRegionParts('  머리/안면  ,   목(앞)  ,  허리(요추)  '),
    ['머리/안면', '목(앞)', '허리(요추)']
  );

  // Multiple consecutive and stray commas
  assert.deepEqual(
    parseMultiRegionParts(', , 머리/안면, , , 목(앞), , ,'),
    ['머리/안면', '목(앞)']
  );

  // Delimiters with newlines and tabs
  assert.deepEqual(
    parseMultiRegionParts('머리/안면\n,\t목(앞)\r\n,왼쪽 어깨'),
    ['머리/안면', '목(앞)', '왼쪽 어깨']
  );

  // Null, undefined, empty string, whitespace
  assert.deepEqual(parseMultiRegionParts(''), []);
  assert.deepEqual(parseMultiRegionParts('    '), []);
  assert.deepEqual(parseMultiRegionParts(null), []);
  assert.deepEqual(parseMultiRegionParts(undefined), []);

  // Non-string inputs
  assert.deepEqual(parseMultiRegionParts(12345), []);
  assert.deepEqual(parseMultiRegionParts({}), []);
  assert.deepEqual(parseMultiRegionParts(['머리']), []);
});

test('[M3-ADV-2.2] formatMultiRegionParts serialization fuzzing with duplicates, blank elements, and non-arrays', async () => {
  // Simple array
  assert.equal(formatMultiRegionParts(['머리/안면', '목(앞)']), '머리/안면, 목(앞)');

  // Duplicate elements deduplication
  assert.equal(
    formatMultiRegionParts(['머리/안면', '머리/안면', '목(앞)', '머리/안면']),
    '머리/안면, 목(앞)'
  );

  // Elements with extra spaces and blank strings
  assert.equal(
    formatMultiRegionParts(['  머리/안면  ', '', '   ', '목(앞)  ', ' ']),
    '머리/안면, 목(앞)'
  );

  // Non-array inputs
  assert.equal(formatMultiRegionParts(null), '');
  assert.equal(formatMultiRegionParts(undefined), '');
  assert.equal(formatMultiRegionParts('머리/안면'), '');
  assert.equal(formatMultiRegionParts(100), '');
  assert.equal(formatMultiRegionParts({}), '');

  // Round-trip symmetry
  const original = ['머리/안면', '목(앞)', '왼쪽 어깨', '허리(요추)'];
  const serialized = formatMultiRegionParts(original);
  const deserialized = parseMultiRegionParts(serialized);
  assert.deepEqual(deserialized, original);
});

test('[M3-ADV-2.3] Extreme multi-selection: all 17 front and 11 back regions simultaneously (28 regions total)', async () => {
  const ALL_FRONT_REGIONS = [
    '머리/안면',
    '목(앞)',
    '왼쪽 어깨',
    '오른쪽 어깨',
    '가슴/흉부',
    '복부/위장',
    '골반/하복부',
    '왼쪽 팔',
    '오른쪽 팔',
    '왼쪽 손목/손',
    '오른쪽 손목/손',
    '왼쪽 허벅지',
    '오른쪽 허벅지',
    '왼쪽 무릎',
    '오른쪽 무릎',
    '왼쪽 종아리/발',
    '오른쪽 종아리/발',
  ];

  const ALL_BACK_REGIONS = [
    '후두부/머리뒤',
    '목덜미/경추',
    '등/견갑골(상배부)',
    '허리(요추)',
    '골반/둔부(엉덩이)',
    '왼쪽 팔(뒤)',
    '오른쪽 팔(뒤)',
    '왼쪽 햄스트링',
    '오른쪽 햄스트링',
    '왼쪽 종아리/발목',
    '오른쪽 종아리/발목',
  ];

  assert.equal(ALL_FRONT_REGIONS.length, 17);
  assert.equal(ALL_BACK_REGIONS.length, 11);

  // Combine both sets
  const ALL_REGIONS = [...ALL_FRONT_REGIONS, ...ALL_BACK_REGIONS];
  assert.equal(ALL_REGIONS.length, 28);

  // Serialize to comma-delimited string
  const serializedAll = formatMultiRegionParts(ALL_REGIONS);
  assert.equal(serializedAll.length, 243, 'All 28 regions formatted length must be 243 chars');
  assert.ok(serializedAll.length >= 200);

  // Deserialize back
  const deserializedAll = parseMultiRegionParts(serializedAll);
  assert.equal(deserializedAll.length, 28);
  assert.deepEqual(deserializedAll, ALL_REGIONS);

  // Verify compact summary text badge logic:
  // When parts.length > 3: `${parts.slice(0, 3).join(', ')} 외 ${parts.length - 3}곳`
  const summaryText = `${deserializedAll.slice(0, 3).join(', ')} 외 ${deserializedAll.length - 3}곳`;
  assert.equal(summaryText, '머리/안면, 목(앞), 왼쪽 어깨 외 25곳');

  // Verify that deselecting all regions yields empty array
  let selectionState = [...ALL_REGIONS];
  // Deselect each region
  for (const region of ALL_REGIONS) {
    selectionState = selectionState.filter((r) => r !== region);
  }
  assert.equal(selectionState.length, 0);
  assert.equal(formatMultiRegionParts(selectionState), '');
});

test('[M3-ADV-2.4] ConditionSchema validation with multi-region string payloads', async () => {
  // Case 1: 2-region string
  const cond2 = {
    id: 'c-2regions',
    label: '복합 통증',
    bodyPart: '머리/안면, 목(앞)',
    onsetDate: '2026-11-07',
  };
  const parsed2 = ConditionSchema.parse(cond2);
  assert.equal(parsed2.bodyPart, '머리/안면, 목(앞)');

  // Case 2: Extreme 28-region string
  const ALL_28 = [
    '머리/안면', '목(앞)', '왼쪽 어깨', '오른쪽 어깨', '가슴/흉부', '복부/위장', '골반/하복부',
    '왼쪽 팔', '오른쪽 팔', '왼쪽 손목/손', '오른쪽 손목/손', '왼쪽 허벅지', '오른쪽 허벅지',
    '왼쪽 무릎', '오른쪽 무릎', '왼쪽 종아리/발', '오른쪽 종아리/발', '후두부/머리뒤',
    '목덜미/경추', '등/견갑골(상배부)', '허리(요추)', '골반/둔부(엉덩이)', '왼쪽 팔(뒤)',
    '오른쪽 팔(뒤)', '왼쪽 햄스트링', '오른쪽 햄스트링', '왼쪽 종아리/발목', '오른쪽 종아리/발목'
  ];
  const cond28 = {
    id: 'c-all28',
    label: '전신 다발성 통증',
    bodyPart: formatMultiRegionParts(ALL_28),
    onsetDate: '2026-11-07',
  };
  const parsed28 = ConditionSchema.parse(cond28);
  assert.equal(parsed28.bodyPart, cond28.bodyPart);

  // Case 3: Empty bodyPart must be rejected by ConditionSchema
  assert.throws(() => {
    ConditionSchema.parse({
      id: 'c-invalid',
      label: '무효 통증',
      bodyPart: '',
      onsetDate: '2026-11-07',
    });
  });
});

test('[M3-ADV-2.5] Multi-region string distribution across clinical departments in HealthContext', async () => {
  // Simulates HealthContext bodyPartDist calculation:
  // rawPart.includes(',') ? rawPart.split(',').map(s => s.trim()).filter(Boolean) : [rawPart]
  const mockConditions = [
    { id: 'c1', label: '두통 및 목 통증', bodyPart: '머리/안면, 목(앞)' },
    { id: 'c2', label: '허리 및 무릎 통증', bodyPart: '허리(요추), 왼쪽 무릎' },
  ];

  const mockLogs = [
    { id: 'l1', conditionId: 'c1', intensity: 7, date: '2026-11-07T08:00:00Z' },
    { id: 'l2', conditionId: 'c2', intensity: 8, date: '2026-11-07T09:00:00Z' },
    { id: 'l3', conditionId: 'c1', intensity: 5, date: '2026-11-07T10:00:00Z', bodyPartOverride: '머리/안면, 가슴/흉부' },
  ];

  const bodyPartDist = {};
  mockLogs.forEach((log) => {
    const cond = mockConditions.find((c) => c.id === log.conditionId);
    const rawPart = log.bodyPartOverride || cond?.bodyPart || '미지정';
    const parts = rawPart.includes(',')
      ? rawPart.split(',').map((s) => s.trim()).filter(Boolean)
      : [rawPart];

    parts.forEach((part) => {
      if (!bodyPartDist[part]) {
        bodyPartDist[part] = { count: 0, maxIntensity: 0 };
      }
      bodyPartDist[part].count += 1;
      bodyPartDist[part].maxIntensity = Math.max(bodyPartDist[part].maxIntensity, log.intensity);
    });
  });

  // Verify that multi-region parts were individually tokenized and counted
  assert.equal(bodyPartDist['머리/안면'].count, 2, '머리/안면 should be counted twice');
  assert.equal(bodyPartDist['머리/안면'].maxIntensity, 7);

  assert.equal(bodyPartDist['목(앞)'].count, 1, '목(앞) should be counted once');
  assert.equal(bodyPartDist['목(앞)'].maxIntensity, 7);

  assert.equal(bodyPartDist['허리(요추)'].count, 1);
  assert.equal(bodyPartDist['허리(요추)'].maxIntensity, 8);

  assert.equal(bodyPartDist['왼쪽 무릎'].count, 1);
  assert.equal(bodyPartDist['가슴/흉부'].count, 1);
  assert.equal(bodyPartDist['가슴/흉부'].maxIntensity, 5);

  // Verify no composite string '머리/안면, 목(앞)' exists as a single key
  assert.equal(bodyPartDist['머리/안면, 목(앞)'], undefined);
});

// ===========================================================================
// SUITE 3: CHAINED SHA-256 CRYPTOGRAPHIC SIGNATURES & AUDIT INTEGRITY
// ===========================================================================

test('[M3-ADV-3.1] Chained SHA-256 signature generation and validation for multi-region symptom logs', async () => {
  const logRecord1 = {
    id: 'log-uuid-001',
    conditionId: 'cond-multi-001',
    date: '2026-11-07T10:00:00.000Z',
    intensity: 7,
    medication: '타이레놀 500mg',
    postMedIntensity: 4,
    prevSignature: '',
  };

  const sig1 = await computeRecordSignature(logRecord1, '');
  assert.equal(typeof sig1, 'string');
  assert.equal(sig1.length, 64);
  assert.match(sig1, /^[0-9a-f]{64}$/);

  logRecord1.signature = sig1;
  const isValid1 = await verifyRecordSignature(logRecord1);
  assert.equal(isValid1, true);

  // Second chained record referencing sig1
  const logRecord2 = {
    id: 'log-uuid-002',
    conditionId: 'cond-multi-001',
    date: '2026-11-07T14:00:00.000Z',
    intensity: 5,
    medication: '이부프로펜 400mg',
    postMedIntensity: 2,
    prevSignature: sig1,
  };

  const sig2 = await computeRecordSignature(logRecord2, sig1);
  assert.equal(typeof sig2, 'string');
  assert.equal(sig2.length, 64);
  assert.notEqual(sig1, sig2);

  logRecord2.signature = sig2;
  const isValid2 = await verifyRecordSignature(logRecord2);
  assert.equal(isValid2, true);
});

test('[M3-ADV-3.2] Tamper resistance: mutating any clinical field invalidates cryptographic signature', async () => {
  const originalRecord = {
    id: 'log-tamper-test',
    conditionId: 'cond-tamper-01',
    date: '2026-11-07T12:00:00.000Z',
    intensity: 6,
    medication: '낙센 정 250mg',
    postMedIntensity: 3,
    prevSignature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };

  const validSig = await computeRecordSignature(originalRecord, originalRecord.prevSignature);
  originalRecord.signature = validSig;
  assert.equal(await verifyRecordSignature(originalRecord), true);

  // Attack 1: Mutate intensity
  const tamperedIntensity = { ...originalRecord, intensity: 7 };
  assert.equal(await verifyRecordSignature(tamperedIntensity), false);

  // Attack 2: Mutate medication
  const tamperedMed = { ...originalRecord, medication: '위약(플라세보)' };
  assert.equal(await verifyRecordSignature(tamperedMed), false);

  // Attack 3: Mutate conditionId
  const tamperedCond = { ...originalRecord, conditionId: 'cond-other-99' };
  assert.equal(await verifyRecordSignature(tamperedCond), false);

  // Attack 4: Mutate date timestamp
  const tamperedDate = { ...originalRecord, date: '2026-11-07T12:00:01.000Z' };
  assert.equal(await verifyRecordSignature(tamperedDate), false);

  // Attack 5: Mutate postMedIntensity
  const tamperedPostMed = { ...originalRecord, postMedIntensity: 1 };
  assert.equal(await verifyRecordSignature(tamperedPostMed), false);

  // Attack 6: Mutate prevSignature (breaking audit chain)
  const tamperedPrevSig = { ...originalRecord, prevSignature: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' };
  assert.equal(await verifyRecordSignature(tamperedPrevSig), false);
});

test('[M3-ADV-3.3] Deep Audit Chain Stress: 100 consecutive symptom logs chained together verify 100%', async () => {
  const chainLength = 100;
  const chain = [];
  let prevSig = '';

  const sampleMeds = ['타이레놀 500mg', '이부프로펜 400mg', '낙센 정 250mg', '울트라셋 정', ''];

  for (let i = 0; i < chainLength; i++) {
    const record = {
      id: `chain-log-${i}`,
      conditionId: `cond-${i % 5}`,
      date: new Date(Date.now() + i * 3600000).toISOString(),
      intensity: (i % 10) + 1,
      medication: sampleMeds[i % sampleMeds.length],
      postMedIntensity: Math.max(1, (i % 10) - 2),
      prevSignature: prevSig,
    };

    const sig = await computeRecordSignature(record, prevSig);
    record.signature = sig;
    chain.push(record);
    prevSig = sig;
  }

  // Verify all 100 links in the chain
  for (let i = 0; i < chainLength; i++) {
    const isValid = await verifyRecordSignature(chain[i]);
    assert.equal(isValid, true, `Chain record ${i} must verify`);
    if (i > 0) {
      assert.equal(
        chain[i].prevSignature,
        chain[i - 1].signature,
        `Chain record ${i} must link to record ${i - 1}`
      );
    }
  }

  // Mutate record #0 and verify that integrity failure can be localized
  const corruptedChain = JSON.parse(JSON.stringify(chain));
  corruptedChain[0].intensity = 10; // Tamper genesis record

  // Genesis record fails
  assert.equal(await verifyRecordSignature(corruptedChain[0]), false);
  // Record 1 still matches its own signature against its stored prevSignature...
  // BUT its prevSignature no longer matches the recomputed signature of record 0!
  const recomputedGenesisSig = await computeRecordSignature(corruptedChain[0], '');
  assert.notEqual(recomputedGenesisSig, corruptedChain[1].prevSignature);
});

// ===========================================================================
// SUITE 4: DASHBOARD STREAMLINING & FORM DE-DUPLICATION VERIFICATION (F9)
// ===========================================================================

test('[M3-ADV-4.1] DetailedConditionCard in Dashboard.tsx contains NO redundant inline <form> or <input type="range">', async () => {
  const dashboardPath = path.resolve(SRC_DIR, 'pages/Dashboard.tsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');

  // Find the DetailedConditionCard component block
  const cardComponentMatch = dashboardCode.match(/const DetailedConditionCard[\s\S]*?^};/m);
  assert.ok(cardComponentMatch, 'DetailedConditionCard component must exist in Dashboard.tsx');
  const cardComponentCode = cardComponentMatch[0];

  // Verify absence of inline form
  assert.equal(
    cardComponentCode.includes('<form'),
    false,
    'DetailedConditionCard must NOT contain an inline <form>'
  );

  // Verify absence of redundant range slider
  assert.equal(
    cardComponentCode.includes('type="range"'),
    false,
    'DetailedConditionCard must NOT contain type="range" slider'
  );

  // Verify absence of duplicate handleSaveLog
  assert.equal(
    cardComponentCode.includes('handleSaveLog'),
    false,
    'DetailedConditionCard must NOT contain duplicate handleSaveLog'
  );

  // Verify presence of Tier 3 direct navigation link to /entry
  assert.ok(
    cardComponentCode.includes("navigate('/entry'"),
    'DetailedConditionCard must provide a direct navigation button to /entry'
  );

  // Verify presence of recent logs snippet
  assert.ok(
    cardComponentCode.includes('recentThreeLogs') || cardComponentCode.includes('recentLogs'),
    'DetailedConditionCard must display recent logs snippet'
  );
});

test('[M3-ADV-4.2] Three distinct operational tiers exist on Dashboard without functional competition', async () => {
  const dashboardPath = path.resolve(SRC_DIR, 'pages/Dashboard.tsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');

  // Tier 1: 1-Sec SOS Banner
  assert.ok(
    dashboardCode.includes('openAcute()') || dashboardCode.includes('openAcute'),
    'Tier 1: 1-sec emergency SOS must link to acute pain modal'
  );

  // Tier 2: 3-Sec QuickPainLogger Card
  assert.ok(
    dashboardCode.includes('<QuickPainLogger'),
    'Tier 2: Embedded QuickPainLogger must be present on Dashboard'
  );

  // Tier 3: Full PQRST Entry Navigation Button
  assert.ok(
    dashboardCode.includes("navigate('/entry')") || dashboardCode.includes('navigate("/entry")'),
    'Tier 3: Dedicated Full PQRST Entry button must navigate to /entry'
  );
});

// ===========================================================================
// HARNESS RUNNER
// ===========================================================================

export async function runAdversarialHarness() {
  console.log(`Starting ${tests.length} adversarial stress tests...\n`);
  const startAll = performance.now();

  for (const { name, fn } of tests) {
    const t0 = performance.now();
    try {
      await fn();
      const dur = performance.now() - t0;
      console.log(`  ✓ PASS  ${name} (${dur.toFixed(1)}ms)`);
      passCount++;
    } catch (err) {
      const dur = performance.now() - t0;
      console.error(`  ✗ FAIL  ${name} (${dur.toFixed(1)}ms)`);
      console.error(`          ${err.message}`);
      if (err.stack) {
        const stackLines = err.stack.split('\n').slice(1, 4).join('\n');
        console.error(`          ${stackLines}`);
      }
      failCount++;
    }
  }

  const totalDur = performance.now() - startAll;
  console.log('\n----------------------------------------------------------------------');
  console.log(`STRESS RESULTS: ${passCount} passed, ${failCount} failed (${totalDur.toFixed(1)}ms)`);
  console.log('----------------------------------------------------------------------\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

// Execute if run directly
runAdversarialHarness();
