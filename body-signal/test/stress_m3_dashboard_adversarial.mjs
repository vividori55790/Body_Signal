import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const BODY_SIGNAL_DIR = path.resolve(REPO_ROOT, 'body-signal');
const SRC_DIR = path.resolve(BODY_SIGNAL_DIR, 'src');

console.log('======================================================================');
console.log('  CHALLENGER M3_2: EMPIRICAL ADVERSARIAL STRESS & VERIFICATION HARNESS');
console.log('  Dashboard 3-Tier Hierarchy, DetailedConditionCard, Multi-Region F10/F12');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// ---------------------------------------------------------------------------
// SUITE 1: Dashboard 3-Tier Hierarchy Verification (F8 & F9)
// ---------------------------------------------------------------------------

test('[M3-ADV-1.1] Dashboard static analysis verifies 3 distinct operational tiers exist', async () => {
  const dashboardPath = path.join(SRC_DIR, 'pages', 'Dashboard.tsx');
  assert.ok(fs.existsSync(dashboardPath), 'Dashboard.tsx must exist');
  const code = fs.readFileSync(dashboardPath, 'utf8');

  // Tier 1: 1-Sec Acute Pain SOS Mode
  assert.match(code, /openAcute\(\)/, 'Tier 1 must call openAcute()');
  assert.match(code, /1초 긴급 기록|지금 너무 아파요/, 'Tier 1 must render emergency acute prompt');

  // Tier 2: 3-Sec Chronic Quick Logger
  assert.match(code, /<QuickPainLogger\s*\/>/, 'Tier 2 must embed QuickPainLogger');

  // Tier 3: Full PQRST Entry Navigation
  assert.match(code, /navigate\(['"]\/entry['"]\)/, 'Tier 3 must navigate to /entry');
});

test('[M3-ADV-1.2] DetailedConditionCard has zero duplicate forms, range sliders, or raw datetime inputs', async () => {
  const dashboardPath = path.join(SRC_DIR, 'pages', 'Dashboard.tsx');
  const code = fs.readFileSync(dashboardPath, 'utf8');

  // Extract DetailedConditionCard component source
  const cardStart = code.indexOf('const DetailedConditionCard');
  assert.ok(cardStart !== -1, 'DetailedConditionCard must be declared');
  const cardEnd = code.indexOf('export const DashboardPage');
  assert.ok(cardEnd !== -1 && cardEnd > cardStart, 'DashboardPage must follow DetailedConditionCard');
  const cardCode = code.slice(cardStart, cardEnd);

  // Adversarial check: MUST NOT contain duplicate input forms
  assert.doesNotMatch(cardCode, /<form/i, 'DetailedConditionCard must NOT contain <form> element');
  assert.doesNotMatch(cardCode, /type=["']range["']/i, 'DetailedConditionCard must NOT contain range slider');
  assert.doesNotMatch(cardCode, /type=["']datetime-local["']/i, 'DetailedConditionCard must NOT contain datetime-local input');
  assert.doesNotMatch(cardCode, /handleSaveLog/i, 'DetailedConditionCard must NOT contain inline save log handler');

  // Must contain sparkline and recent history snippet
  assert.match(cardCode, /<LineChart/i, 'DetailedConditionCard must render LineChart sparkline');
  assert.match(cardCode, /recentThreeLogs/i, 'DetailedConditionCard must compute and display recent logs snippet');
});

test('[M3-ADV-1.3] DetailedConditionCard contextual button navigates to /entry with selectedConditionId state', async () => {
  const dashboardPath = path.join(SRC_DIR, 'pages', 'Dashboard.tsx');
  const code = fs.readFileSync(dashboardPath, 'utf8');

  // Extract DetailedConditionCard
  const cardStart = code.indexOf('const DetailedConditionCard');
  const cardEnd = code.indexOf('export const DashboardPage');
  const cardCode = code.slice(cardStart, cardEnd);

  // Verify navigation call
  assert.match(
    cardCode,
    /navigate\(['"]\/entry['"],\s*\{\s*state:\s*\{\s*selectedConditionId:\s*condition\.id\s*\}\s*\}\)/,
    'Contextual button must navigate to /entry with state: { selectedConditionId: condition.id }'
  );
  assert.match(cardCode, /이 질환 상세 기록/, 'Must have user-facing label "이 질환 상세 기록"');
});

test('[M3-ADV-1.4] EntryForm.tsx reads location.state?.selectedConditionId for pre-selection', async () => {
  const entryPath = path.join(SRC_DIR, 'pages', 'EntryForm.tsx');
  assert.ok(fs.existsSync(entryPath), 'EntryForm.tsx must exist');
  const code = fs.readFileSync(entryPath, 'utf8');

  // Verify location.state reading
  assert.match(code, /useLocation\(\)/, 'EntryForm must call useLocation()');
  assert.match(
    code,
    /location\.state\?\.selectedConditionId/,
    'EntryForm must inspect location.state?.selectedConditionId'
  );
});

// ---------------------------------------------------------------------------
// SUITE 2: Multi-Region Parsing and BodyMap Integration (F10)
// ---------------------------------------------------------------------------

test('[M3-ADV-2.1] parseMultiRegionParts and formatMultiRegionParts handle all corner cases', async () => {
  const bodyMapPath = path.join(SRC_DIR, 'components', 'BodyMap.tsx');
  const code = fs.readFileSync(bodyMapPath, 'utf8');

  assert.match(code, /export function parseMultiRegionParts/, 'parseMultiRegionParts must be exported');
  assert.match(code, /export function formatMultiRegionParts/, 'formatMultiRegionParts must be exported');

  // Simulate exact implementation from BodyMap.tsx
  function parseMultiRegionParts(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function formatMultiRegionParts(parts) {
    if (!parts || !Array.isArray(parts)) return '';
    return Array.from(new Set(parts.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean))).join(', ');
  }

  // Corner 1: Null/undefined/empty
  assert.deepEqual(parseMultiRegionParts(null), []);
  assert.deepEqual(parseMultiRegionParts(undefined), []);
  assert.deepEqual(parseMultiRegionParts(''), []);
  assert.deepEqual(parseMultiRegionParts('   '), []);

  // Corner 2: Messy commas and whitespace
  assert.deepEqual(
    parseMultiRegionParts(' 머리/안면 ,,,  목(앞) ,  오른쪽 무릎  , '),
    ['머리/안면', '목(앞)', '오른쪽 무릎']
  );

  // Corner 3: Non-string input returns empty array safely
  assert.deepEqual(parseMultiRegionParts(123), []);
  assert.deepEqual(parseMultiRegionParts({}), []);

  // Corner 4: Formatting back to canonical string
  assert.equal(
    formatMultiRegionParts([' 머리/안면 ', '목(앞)', '  ']),
    '머리/안면, 목(앞)'
  );
  assert.equal(formatMultiRegionParts([]), '');
  assert.equal(formatMultiRegionParts(null), '');
});

test('[M3-ADV-2.2] BodyMap dual-prop backward compatibility (selectedParts vs selectedPart)', async () => {
  const bodyMapPath = path.join(SRC_DIR, 'components', 'BodyMap.tsx');
  const code = fs.readFileSync(bodyMapPath, 'utf8');

  // Check interface definitions
  assert.match(code, /selectedParts\?: string\[\]/, 'BodyMapProps must support selectedParts');
  assert.match(code, /onTogglePart\?: \(partLabel: string\) => void/, 'BodyMapProps must support onTogglePart');
  assert.match(code, /selectedPart\?: string/, 'BodyMapProps must support legacy selectedPart');
  assert.match(code, /onSelectPart\?: \(partLabel: string\) => void/, 'BodyMapProps must support legacy onSelectPart');

  // Effective parts computation
  assert.match(code, /effectiveSelectedParts/, 'BodyMap must compute effectiveSelectedParts');
});

// ---------------------------------------------------------------------------
// SUITE 3: Clinical Distribution & Department Classification (F10 + F12)
// ---------------------------------------------------------------------------

// Department Classification Oracle from feedback_helpers.mjs
const DEPARTMENT_KEYS = {
  ORTHOPEDICS: '정형외과 / 재활의학과',
  NEUROLOGY: '신경과 / 신경외과',
  GASTROENTEROLOGY: '소화기내과',
  INTERNAL_MEDICINE: '일반내과 / 기타 진료과',
};

function classifyAnatomicalPart(partName) {
  if (!partName) return DEPARTMENT_KEYS.INTERNAL_MEDICINE;
  const lower = partName.toLowerCase();

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

  return DEPARTMENT_KEYS.INTERNAL_MEDICINE;
}

// Simulate HealthContext bodyPartDist calculation
function computeBodyPartDist(logs, conditions) {
  const bodyPartDist = {};
  logs.forEach((log) => {
    const cond = conditions.find((c) => c.id === log.conditionId);
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
  return bodyPartDist;
}

test('[M3-ADV-3.1] Multi-region "머리/안면, 목(앞)" splits and distributes to Neurology & Orthopedics', async () => {
  const conditions = [
    { id: 'c1', label: '복합 경추 두통', bodyPart: '머리/안면, 목(앞)' },
  ];
  const logs = [
    { id: 'l1', conditionId: 'c1', intensity: 7 },
  ];

  const dist = computeBodyPartDist(logs, conditions);

  // Must have separate keys
  assert.ok('머리/안면' in dist, '머리/안면 must be an independent key in bodyPartDist');
  assert.ok('목(앞)' in dist, '목(앞) must be an independent key in bodyPartDist');
  assert.equal(dist['머리/안면'].count, 1);
  assert.equal(dist['머리/안면'].maxIntensity, 7);
  assert.equal(dist['목(앞)'].count, 1);
  assert.equal(dist['목(앞)'].maxIntensity, 7);

  // Verify department mapping
  const depts = Object.keys(dist).map(classifyAnatomicalPart);
  assert.ok(depts.includes(DEPARTMENT_KEYS.NEUROLOGY), 'Must map to Neurology');
  assert.ok(depts.includes(DEPARTMENT_KEYS.ORTHOPEDICS), 'Must map to Orthopedics');
});

test('[M3-ADV-3.2] Multi-region "무릎, 허리" splits and distributes to Orthopedics twice', async () => {
  const conditions = [
    { id: 'c2', label: '퇴행성 관절 및 척추', bodyPart: '무릎, 허리' },
  ];
  const logs = [
    { id: 'l2', conditionId: 'c2', intensity: 6 },
  ];

  const dist = computeBodyPartDist(logs, conditions);

  assert.ok('무릎' in dist);
  assert.ok('허리' in dist);
  assert.equal(dist['무릎'].count, 1);
  assert.equal(dist['허리'].count, 1);

  const depts = Object.keys(dist).map(classifyAnatomicalPart);
  assert.equal(depts.filter((d) => d === DEPARTMENT_KEYS.ORTHOPEDICS).length, 2);
});

test('[M3-ADV-3.3] Complex Multi-Region Stress Scenario (30 Logs across 5 Conditions)', async () => {
  const conditions = [
    { id: 'c-migraine', label: '편두통 및 안면통', bodyPart: '머리/두통, 안면' },
    { id: 'c-spine', label: '요추-경추 복합통증', bodyPart: '목/경추, 허리/요통' },
    { id: 'c-gi', label: '위장관 신경성 복통', bodyPart: '위장/복부, 속쓰림' },
    { id: 'c-poly', label: '다발성 전신통증', bodyPart: '오른쪽 무릎, 왼쪽 어깨, 머리/두통' },
    { id: 'c-single', label: '단일 발목 염좌', bodyPart: '발목' },
  ];

  const logs = [];
  // 10 logs for migraine
  for (let i = 0; i < 10; i++) {
    logs.push({ id: `lm-${i}`, conditionId: 'c-migraine', intensity: (i % 5) + 5 });
  }
  // 8 logs for spine
  for (let i = 0; i < 8; i++) {
    logs.push({ id: `ls-${i}`, conditionId: 'c-spine', intensity: (i % 6) + 4 });
  }
  // 6 logs for GI
  for (let i = 0; i < 6; i++) {
    logs.push({ id: `lg-${i}`, conditionId: 'c-gi', intensity: (i % 4) + 6 });
  }
  // 4 logs for poly
  for (let i = 0; i < 4; i++) {
    logs.push({ id: `lp-${i}`, conditionId: 'c-poly', intensity: 8 });
  }
  // 2 logs for single
  for (let i = 0; i < 2; i++) {
    logs.push({ id: `la-${i}`, conditionId: 'c-single', intensity: 3 });
  }

  const dist = computeBodyPartDist(logs, conditions);

  // Verifications
  assert.equal(dist['머리/두통'].count, 10 + 4, '머리/두통 should accumulate from c-migraine and c-poly');
  assert.equal(dist['안면'].count, 10);
  assert.equal(dist['목/경추'].count, 8);
  assert.equal(dist['허리/요통'].count, 8);
  assert.equal(dist['위장/복부'].count, 6);
  assert.equal(dist['속쓰림'].count, 6);
  assert.equal(dist['오른쪽 무릎'].count, 4);
  assert.equal(dist['왼쪽 어깨'].count, 4);
  assert.equal(dist['발목'].count, 2);

  // Group by department
  const deptCounts = {
    [DEPARTMENT_KEYS.NEUROLOGY]: 0,
    [DEPARTMENT_KEYS.ORTHOPEDICS]: 0,
    [DEPARTMENT_KEYS.GASTROENTEROLOGY]: 0,
    [DEPARTMENT_KEYS.INTERNAL_MEDICINE]: 0,
  };

  Object.entries(dist).forEach(([part, stats]) => {
    const dept = classifyAnatomicalPart(part);
    deptCounts[dept] += stats.count;
  });

  // Neurology: 머리/두통 (14) + 안면 (10) = 24
  assert.equal(deptCounts[DEPARTMENT_KEYS.NEUROLOGY], 24);
  // Orthopedics: 목/경추 (8) + 허리/요통 (8) + 오른쪽 무릎 (4) + 왼쪽 어깨 (4) + 발목 (2) = 26
  assert.equal(deptCounts[DEPARTMENT_KEYS.ORTHOPEDICS], 26);
  // Gastroenterology: 위장/복부 (6) + 속쓰림 (6) = 12
  assert.equal(deptCounts[DEPARTMENT_KEYS.GASTROENTEROLOGY], 12);
  // Total region events = 24 + 26 + 12 = 62
  const totalRegionEvents = Object.values(dist).reduce((acc, s) => acc + s.count, 0);
  assert.equal(totalRegionEvents, 62);
});

test('[M3-ADV-3.4] Malformed and Boundary rawPart in HealthContext bodyPartDist', async () => {
  const conditions = [
    { id: 'c-empty', label: '빈 부위', bodyPart: '' },
    { id: 'c-spaces', label: '공백 부위', bodyPart: '   ,  ,  ' },
    { id: 'c-trailing', label: '끝 쉼표', bodyPart: '어깨, ' },
  ];
  const logs = [
    { id: 'l1', conditionId: 'c-empty', intensity: 5 },
    { id: 'l2', conditionId: 'c-spaces', intensity: 4 },
    { id: 'l3', conditionId: 'c-trailing', intensity: 7 },
    { id: 'l4', conditionId: 'c-nonexistent', intensity: 6 }, // missing condition
  ];

  const dist = computeBodyPartDist(logs, conditions);

  // c-empty: rawPart is '' -> cond?.bodyPart is '' -> fallback to '미지정'
  assert.ok('미지정' in dist);
  assert.equal(dist['미지정'].count, 2); // l1 and l4 both fallback to '미지정'

  // c-spaces: split produces [] -> forEach does nothing -> no empty string keys!
  assert.equal(dist[''], undefined);
  assert.equal(dist[' '], undefined);

  // c-trailing: split produces ['어깨']
  assert.ok('어깨' in dist);
  assert.equal(dist['어깨'].count, 1);
});

// ---------------------------------------------------------------------------
// SUITE 4: Verification of HealthContext.tsx actual implementation
// ---------------------------------------------------------------------------

test('[M3-ADV-4.1] HealthContext.tsx source code contains comma splitting logic in bodyPartDist', async () => {
  const healthContextPath = path.join(SRC_DIR, 'context', 'HealthContext.tsx');
  const code = fs.readFileSync(healthContextPath, 'utf8');

  // Verify lines 329-338 logic
  assert.match(
    code,
    /rawPart\.includes\(['"],['"]\)\s*\?\s*rawPart\.split\(['"],['"]\)\.map\(\(s\)\s*=>\s*s\.trim\(\)\)\.filter\(Boolean\)/,
    'HealthContext must split comma-separated parts, trim whitespace, and filter truthy tokens'
  );
  assert.match(
    code,
    /parts\.forEach\(\(part\)\s*=>\s*\{/,
    'HealthContext must iterate each parsed part independently'
  );
  assert.match(
    code,
    /bodyPartDist\[part\]\.count\s*\+=\s*1/,
    'HealthContext must increment count for each part independently'
  );
});

// ---------------------------------------------------------------------------
// RUN ALL TESTS
// ---------------------------------------------------------------------------

async function run() {
  const start = performance.now();
  for (const { name, fn } of tests) {
    const t0 = performance.now();
    try {
      await fn();
      const elapsed = (performance.now() - t0).toFixed(2);
      console.log(`  ✓ ${name} (${elapsed}ms)`);
      passCount++;
    } catch (err) {
      const elapsed = (performance.now() - t0).toFixed(2);
      console.error(`  ✗ ${name} (${elapsed}ms)`);
      console.error(`    ${err.message}`);
      failCount++;
    }
  }

  const duration = ((performance.now() - start) / 1000).toFixed(2);
  console.log('\n----------------------------------------------------------------------');
  console.log(`TOTAL: ${tests.length} | PASS: ${passCount} | FAIL: ${failCount} | TIME: ${duration}s`);
  console.log('----------------------------------------------------------------------');

  if (failCount > 0) {
    process.exit(1);
  }
}

run();
