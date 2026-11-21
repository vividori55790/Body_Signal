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
    name: '1. Brand emblem selection is deferred under Zero Dead-Control Gate in Welcome & Settings',
    fn: () => {
      const disclaimerSrc = read('src/components/DisclaimerModal.tsx');
      assert.doesNotMatch(disclaimerSrc, /LOGO_VARIANT_OPTIONS/);
      assert.doesNotMatch(disclaimerSrc, /logo-option-/);

      const settingsSrc = read('src/pages/Settings.tsx');
      assert.match(settingsSrc, /Brand Emblem[\s\S]*In Dev \(v4\)/);
      assert.match(settingsSrc, /disabled[\s\S]*aria-disabled="true"/);
    },
  },
  {
    name: '2. Welcome Step 1 hero & framed BrandLogo support light theme instead of forced dark #020808',
    fn: () => {
      const disclaimerSrc = read('src/components/DisclaimerModal.tsx');
      assert.match(disclaimerSrc, /text-slate-900 dark:text-white/);
      assert.match(disclaimerSrc, /dark:bg-\[radial-gradient/);

      const logoSrc = read('src/components/BrandLogo.tsx');
      assert.match(logoSrc, /from-emerald-50 via-teal-50 to-white/);
      assert.match(logoSrc, /dark:bg-\[radial-gradient/);
    },
  },
  {
    name: '3. PinModal separates initial enter title vs confirm title and App.tsx passes confirmTitle',
    fn: () => {
      const pinSrc = read('src/components/PinModal.tsx');
      assert.match(pinSrc, /confirmTitle\?:\s*string/);
      assert.match(pinSrc, /step === 'enter'[\s\S]*\?\s*title[\s\S]*:\s*confirmTitle/);

      const appSrc = read('src/App.tsx');
      assert.match(appSrc, /confirmTitle=\{isEn \?/);
    },
  },
  {
    name: '4. BodyMap localizes emitted part names in English mode and matches bilingual stored parts',
    fn: () => {
      const bodyMapSrc = read('src/components/BodyMap.tsx');
      assert.match(bodyMapSrc, /export function localizeBodyPart/);
      assert.match(bodyMapSrc, /const localizedName = isEn \? EN_PART_NAMES\[matched\.name\] \|\| matched\.name : matched\.name/);
      assert.match(bodyMapSrc, /findMatchingStoredPart/);
    },
  },
  {
    name: '5. Medication presets localize cleanly in English across Settings, EntryForm, QuickPainLogger, and AcutePainMode',
    fn: () => {
      const medSrc = read('src/utils/medication.ts');
      assert.match(medSrc, /export function localizeMedicationName/);
      assert.match(medSrc, /'타이레놀 500mg':\s*'Tylenol 500mg'/);
      assert.match(medSrc, /'이부프로펜 400mg':\s*'Ibuprofen 400mg'/);

      for (const file of [
        'src/pages/Settings.tsx',
        'src/pages/EntryForm.tsx',
        'src/components/QuickPainLogger.tsx',
        'src/components/AcutePainMode.tsx',
        'src/components/AddMedicationInline.tsx',
      ]) {
        const src = read(file);
        assert.match(src, /formatMedicationPreset\([^)]*settings\.language/, `${file} must pass settings.language to formatMedicationPreset`);
      }
    },
  },
  {
    name: '6. Version bumped consistently to v2.2.1 (versionCode 12)',
    fn: () => {
      const pkg = JSON.parse(read('package.json'));
      assert.equal(pkg.version, '2.2.1');
      const gradle = read('android/app/build.gradle');
      assert.match(gradle, /\bversionCode\s+12\b/);
      assert.match(gradle, /\bversionName\s+"2\.2\.1"/);
      const settingsSrc = read('src/pages/Settings.tsx');
      assert.match(settingsSrc, /Body Signal Mobile v2\.2\.1/);
    },
  },
];

let passed = 0;
for (const t of tests) {
  await t.fn();
  passed++;
  console.log(`  ✓ ${t.name}`);
}
console.log(`\nv2.2.1 Features & Regression Verification: ${passed}/${tests.length} PASSED`);
