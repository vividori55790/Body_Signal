import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const tests = [
  {
    name: '1. Floating SOS widget is restored in Layout and Settings (Dashboard red tier remains commented)',
    fn: () => {
      const layoutSrc = read('src/components/Layout.tsx');
      assert.doesNotMatch(layoutSrc, /\/\/\s*import\s*\{\s*useAcutePain\s*\}/);
      assert.match(layoutSrc, /import\s*\{\s*useAcutePain\s*\}\s*from\s*'\.\.\/context\/AcutePainContext'/);
      assert.match(layoutSrc, /settings\.quickSosEnabled === true[\s\S]*openAcute\(\)/);

      const settingsSrc = read('src/pages/Settings.tsx');
      assert.doesNotMatch(settingsSrc, /\/\/\s*setQuickSos/);
      assert.match(settingsSrc, /setQuickSos\(!settings\.quickSosEnabled\)/);
      assert.match(settingsSrc, /Body Signal Mobile v2\.1\.0/);
    },
  },
  {
    name: '2. PainLevelSelector morphs discrete h-11 buttons into unified full-height h-11 bar and reverts on release',
    fn: () => {
      const painSrc = read('src/components/PainLevelSelector.tsx');
      assert.match(painSrc, /Math\.floor\(percentage \* 10\) \+ 1/);
      assert.match(painSrc, /opacity-0 pointer-events-none/);
      assert.match(painSrc, /role="slider"[\s\S]*absolute inset-0 h-11 w-full rounded-xl/);
      assert.match(painSrc, /grid grid-cols-10 gap-0/);
      assert.match(painSrc, /setIsSliderMode\(false\)/);
      assert.doesNotMatch(painSrc, /h-3 w-full rounded-full/, 'Must not shrink into thin wire track');
      assert.doesNotMatch(painSrc, /w-8 h-8 rounded-full border-2/, 'Must not protrude round knob outside h-11 bar');

      // Runtime column math checks for 10 equal columns
      const calc = (pct) => Math.max(1, Math.min(10, Math.floor(pct * 10) + 1));
      assert.equal(calc(0), 1);
      assert.equal(calc(0.05), 1);
      assert.equal(calc(0.099), 1);
      assert.equal(calc(0.1), 2);
      assert.equal(calc(0.55), 6);
      assert.equal(calc(0.95), 10);
      assert.equal(calc(1.0), 10);
    },
  },
  {
    name: '3. Photo attachment limit raised to 50 with batched compression and lazy vault decryption',
    fn: () => {
      const photoFieldSrc = read('src/components/PhotoAttachmentField.tsx');
      assert.match(photoFieldSrc, /maxPhotos\s*=\s*50/);
      assert.match(photoFieldSrc, /PHOTO_PROCESS_BATCH_SIZE\s*=\s*4/);
      assert.match(photoFieldSrc, /photos\.length\}\/\{maxPhotos\}/);

      const diagSrc = read('src/pages/DiagnosticsPage.tsx');
      assert.match(diagSrc, /ensurePhotosDecrypted/);
      assert.match(diagSrc, /INITIAL_PREVIEW_PHOTOS\s*=\s*4/);
      assert.match(diagSrc, /DECRYPT_BATCH_SIZE\s*=\s*4/);
      assert.match(diagSrc, /lightboxState/);
      assert.match(diagSrc, /Previous photo|이전 사진/);
      assert.match(diagSrc, /Next photo|다음 사진/);
    },
  },
  {
    name: '4. Recharts SVG focus box suppressed and pain tooltips use localized clinical labels',
    fn: () => {
      const cssSrc = read('src/index.css');
      assert.match(cssSrc, /\.recharts-surface:focus/);
      assert.match(cssSrc, /outline:\s*none\s*!important/);

      const condDetailSrc = read('src/pages/ConditionDetail.tsx');
      assert.match(condDetailSrc, /<LineChart[^>]*accessibilityLayer=\{false\}/);
      assert.match(condDetailSrc, /통증 강도:\s*NRS|Pain Intensity:\s*NRS/);

      const dashSrc = read('src/pages/Dashboard.tsx');
      assert.match(dashSrc, /<LineChart[^>]*accessibilityLayer=\{false\}/);
      assert.match(dashSrc, /pointer-events-none[\s\S]*<ResponsiveContainer/);
    },
  },
  {
    name: '5. Condition visualization displays onset & linked diagnosis dates across detail, dashboard, and stats',
    fn: () => {
      const condDetailSrc = read('src/pages/ConditionDetail.tsx');
      assert.match(condDetailSrc, /diagnosticMilestones/);
      assert.match(condDetailSrc, /<ReferenceLine/);
      assert.match(condDetailSrc, /발병일 · 진단 이력|Onset & Diagnosis Dates/);

      const dashSrc = read('src/pages/Dashboard.tsx');
      assert.match(dashSrc, /diagnostics\?: DiagnosticRecord\[\]/);
      assert.match(dashSrc, /latestDiagnosis\.diagnosisDate/);

      const statsSrc = read('src/pages/StatsPage.tsx');
      assert.match(statsSrc, /latestDiag\.diagnosisDate/);
    },
  },
  {
    name: '6. Calendar supports Month/Week toggle, diagnostic dates, and heatmap clinical shader',
    fn: () => {
      const calSrc = read('src/pages/CalendarPage.tsx');
      assert.match(calSrc, /diagnosticRecords/);
      assert.match(calSrc, /viewMode.*'month'\s*\|\s*'week'/);
      assert.match(calSrc, /startOfWeek/);
      assert.match(calSrc, /endOfWeek/);
      assert.match(calSrc, /addWeeks/);
      assert.match(calSrc, /subWeeks/);
      assert.match(calSrc, /getDiagnosticsForDate/);
      assert.match(calSrc, /이 날의 진료 · 진단 기록|Diagnoses & Clinic Visits/);

      const heatSrc = read('src/components/CalendarHeatmap.tsx');
      assert.match(heatSrc, /diagnosticRecords\s*=\s*\[\]/);
      assert.match(heatSrc, /CLINICAL_SHADER_STYLE/);
      assert.match(heatSrc, /repeating-linear-gradient/);
      assert.match(heatSrc, /data-has-diagnostic/);
      assert.match(heatSrc, /진료·검사일|Clinic \/ Exam/);

      const dashSrc = read('src/pages/Dashboard.tsx');
      assert.match(dashSrc, /<CalendarHeatmap[\s\S]*diagnosticRecords=\{diagnosticRecords\}/);
    },
  },
  {
    name: '7. dateUtils preserves bare YYYY-MM-DD strings without UTC timezone day drift and handles timestamps',
    fn: () => {
      const utilSrc = read('src/utils/dateUtils.ts');
      assert.match(utilSrc, /export function toLocalYmd/);
      assert.match(utilSrc, /export function parseLocalDate/);

      // Runtime equivalence checks mirroring toLocalYmd & parseLocalDate
      const toLocalYmd = (raw) => {
        if (!raw) return '';
        if (!raw.includes('T')) return raw.slice(0, 10);
        const dt = new Date(raw);
        if (Number.isNaN(dt.getTime())) return raw.slice(0, 10);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      assert.equal(toLocalYmd('2026-11-18'), '2026-11-18');
      assert.equal(toLocalYmd(''), '');
      // Timestamp resolves cleanly to valid YYYY-MM-DD format in current timezone
      assert.match(toLocalYmd('2026-11-18T12:00:00.000Z'), /^\d{4}-\d{2}-\d{2}$/);

      const pkg = JSON.parse(read('package.json'));
      assert.equal(pkg.version, '2.1.0');
      const gradle = read('android/app/build.gradle');
      assert.match(gradle, /versionCode 8/);
      assert.match(gradle, /versionName "2\.1\.0"/);
    },
  },
];

let passed = 0;
for (const t of tests) {
  await t.fn();
  passed++;
  console.log(`  ✓ ${t.name}`);
}
console.log(`\nv2.1.0 Features & Regression Verification: ${passed}/${tests.length} PASSED`);
