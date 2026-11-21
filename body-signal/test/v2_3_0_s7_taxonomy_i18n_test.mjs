import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bignal-s7-test-'));

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
  const taxonomy = await loadTsBundle('src/utils/clinicalTaxonomy.ts', 'taxonomy.mjs');
  const departments = await loadTsBundle('src/utils/clinicalDepartments.ts', 'departments.mjs');
  const translationsMod = await loadTsBundle('src/i18n/translations.ts', 'translations.mjs');
  const storageMod = await loadTsBundle('src/utils/storage.ts', 'storage.mjs');

  const tests = [
    {
      name: '1. DEFAULT_SETTINGS SSOT matches DEFAULT_USER_SETTINGS with language="system" & themeAccent="emerald"',
      fn: async () => {
        assert.deepEqual(storageMod.DEFAULT_SETTINGS, healthTypes.DEFAULT_USER_SETTINGS);
        assert.equal(healthTypes.DEFAULT_USER_SETTINGS.language, 'system');
        assert.equal(healthTypes.DEFAULT_USER_SETTINGS.themeAccent, 'emerald');
        const loaded = await storageMod.loadUserSettings();
        assert.equal(loaded.language, 'system');
      },
    },
    {
      name: '2. Canonical BodyMap taxonomy & clinical department mapping are language-independent',
      fn: () => {
        assert.equal(taxonomy.BODY_PART_CATALOG.length, 28);
        assert.deepEqual(taxonomy.resolveBodyPartIds(['허리/요통', 'Lower Back']), ['back-lower-back']);
        assert.deepEqual(taxonomy.resolveBodyPartIds('머리/두통, 목/경추'), ['front-head', 'front-neck']);
        assert.equal(taxonomy.getBodyPartLabel('back-lower-back', 'en'), 'Lower Back');
        assert.equal(taxonomy.getBodyPartLabel('back-lower-back', 'ko'), '허리/요통');
        assert.equal(taxonomy.classifyBodyPartIdToDepartmentId('front-abdomen'), 'gastroenterology');
        assert.equal(taxonomy.classifyBodyPartIdToDepartmentId('front-head'), 'neurology');

        // Categorize using bodyPartIds even if display label is unknown localized text
        const grouped = departments.categorizeByDepartment(
          [
            {
              id: 'cond-neuro',
              label: 'Custom Localized Headache',
              bodyPart: 'Migräne Stirn',
              bodyPartIds: ['front-head'],
              onsetDate: '2026-11-20',
              isArchived: false,
            },
          ],
          []
        );
        const neuroGroup = grouped.find((g) => g.departmentId === 'neurology');
        assert.ok(neuroGroup, 'Condition with bodyPartIds=["front-head"] must route to neurology');
        assert.equal(neuroGroup.conditions[0].id, 'cond-neuro');
      },
    },
    {
      name: '3. PQRST canonical codes roundtrip across ko/en and storage recovery backfills legacy logs',
      fn: () => {
        assert.deepEqual(
          taxonomy.resolvePqrstCodes('quality', ['욱신거림', 'Burning', '찌르는 듯함']),
          ['throbbing', 'burning', 'sharp_stabbing']
        );
        assert.equal(taxonomy.getPqrstLabel('quality', 'throbbing', 'en'), 'Throbbing');
        assert.equal(taxonomy.getPqrstLabel('quality', 'Throbbing', 'ko'), '욱신거림');
        assert.equal(taxonomy.getPqrstLabel('triggers', 'walking', 'en'), 'Walking');
        assert.equal(taxonomy.getPqrstLabel('redFlags', 'high_fever', 'en'), 'High Fever (>=38°C)');

        const recovered = storageMod.recoverAndNormalizeHealthPayload({
          schemaVersion: 1,
          conditions: [
            { id: 'c1', label: '허리 통증', bodyPart: '허리/요통', onsetDate: '2026-11-10', isArchived: false },
          ],
          logs: [
            {
              id: 'l1',
              conditionId: 'c1',
              date: '2026-11-10T09:00:00.000Z',
              intensity: 6,
              painQuality: ['욱신거림'],
              triggers: ['보행 시'],
              reliefFactors: ['누워서 휴식'],
              redFlags: ['마비/감각 저하'],
            },
          ],
          diaryEntries: [],
        });
        assert.deepEqual(recovered.payload.conditions[0].bodyPartIds, ['back-lower-back']);
        assert.deepEqual(recovered.payload.logs[0].painQualityCodes, ['throbbing']);
        assert.deepEqual(recovered.payload.logs[0].triggerCodes, ['walking']);
        assert.deepEqual(recovered.payload.logs[0].reliefFactorCodes, ['lying_rest']);
        assert.deepEqual(recovered.payload.logs[0].redFlagCodes, ['numbness_sensory_loss']);
      },
    },
    {
      name: '4. Non-pain clinical slots & unassigned condition normalization helpers work as specified',
      fn: () => {
        assert.equal(healthTypes.isUnassignedConditionId(healthTypes.UNASSIGNED_CONDITION_ID), true);
        assert.equal(healthTypes.isUnassignedConditionId(''), true);
        assert.equal(healthTypes.normalizePainConditionId(''), healthTypes.UNASSIGNED_CONDITION_ID);
        assert.equal(healthTypes.normalizeDiagnosticConditionId(healthTypes.UNASSIGNED_CONDITION_ID), undefined);

        const cond = healthTypes.ConditionSchema.parse({
          id: 'sleep-cond',
          label: '불면증 추적',
          bodyPart: '머리/안면',
          bodyPartIds: ['front-head'],
          domain: 'mental',
          trackingMode: 'symptom_burden',
          onsetDate: '2026-11-01',
          baselineIntensity: 8,
          targetIntensity: 3,
          goalNote: '주 5회 7시간 이상 수면',
          isArchived: false,
        });
        assert.equal(cond.domain, 'mental');
        assert.equal(cond.trackingMode, 'symptom_burden');

        const painLog = healthTypes.PainLogSchema.parse({
          id: 'sleep-log-1',
          conditionId: 'sleep-cond',
          date: '2026-11-21T08:00:00.000Z',
          intensity: 7,
          symptomCategory: 'sleep',
          severityScore: 7,
          followUpSymptomCodes: ['insomnia', 'daytime_fatigue'],
        });
        assert.equal(painLog.symptomCategory, 'sleep');
        assert.deepEqual(painLog.followUpSymptomCodes, ['insomnia', 'daytime_fatigue']);

        const diary = healthTypes.DiaryEntrySchema.parse({
          date: '2026-11-21',
          text: '수면 기록 메모',
          conditionId: 'sleep-cond',
          conditionIds: ['sleep-cond'],
          updatedAt: '2026-11-21T10:00:00.000Z',
        });
        assert.deepEqual(diary.conditionIds, ['sleep-cond']);
      },
    },
    {
      name: '5. N-Language dynamic locale loader, fallback chain, RTL detection, and Intl formatters work',
      fn: () => {
        assert.equal(translationsMod.resolveSystemLocale(['ko-KR', 'en-US']), 'ko');
        assert.equal(translationsMod.resolveSystemLocale(['en-US']), 'en');
        assert.equal(translationsMod.resolveSystemLocale(['fr-FR']), 'en');

        assert.equal(translationsMod.getLocaleDirection('ar-SA'), 'rtl');
        assert.equal(translationsMod.getLocaleDirection('ko'), 'ltr');

        // Dynamic drop-in locale registration scales beyond 2 languages with English fallback
        translationsMod.registerLocalePack('ja', { save: '保存' });
        assert.equal(translationsMod.translate('ja', 'save'), '保存');
        assert.equal(
          translationsMod.translate('ja', 'cancel'),
          translationsMod.translations.en.cancel,
          'Missing keys in non-core locale must fall back cleanly to English'
        );

        const formattedNum = translationsMod.formatLocalizedNumber(12345, 'en-US');
        assert.equal(formattedNum, '12,345');
        const formattedCurrency = translationsMod.formatLocalizedCurrency(50000, 'ko-KR', 'KRW');
        assert.ok(formattedCurrency.includes('50,000'));
        const formattedDate = translationsMod.formatLocalizedDate('2026-11-21T12:00:00Z', 'en-US');
        assert.match(formattedDate, /2026/);
      },
    },
    {
      name: '6. UI components use resolvedLanguage, Settings has 3-way switcher, /briefing redirects, and native defaults are English',
      fn: () => {
        const walk = (dir) => {
          const out = [];
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) out.push(...walk(full));
            else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
          }
          return out;
        };
        for (const file of walk(path.join(ROOT, 'src'))) {
          const rel = path.relative(ROOT, file).replace(/\\/g, '/');
          const src = fs.readFileSync(file, 'utf8');
          if (rel === 'src/pages/Settings.tsx') {
            // Settings.tsx checks settings.language === 'en' only for its explicit English option pill;
            // UI text localization must use resolvedLanguage === 'en'.
            assert.match(src, /const\s+isEn\s*=\s*resolvedLanguage\s*===\s*'en'/);
            const matches = src.match(/settings\.language\s*===\s*'en'/g) || [];
            assert.equal(matches.length, 1, 'Settings.tsx should only check settings.language === "en" for the language pill button');
            continue;
          }
          assert.doesNotMatch(
            src,
            /settings\.language\s*===\s*'en'/,
            `${rel} must check resolvedLanguage instead of settings.language === 'en'`
          );
        }

        const settingsSrc = fs.readFileSync(path.join(ROOT, 'src/pages/Settings.tsx'), 'utf8');
        assert.match(settingsSrc, /setLanguage\('system'\)/);

        const historySrc = fs.readFileSync(path.join(ROOT, 'src/pages/History.tsx'), 'utf8');
        assert.match(historySrc, /getPqrstLabel\(/);

        const appSrc = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
        assert.match(appSrc, /path="\/briefing"\s+element=\{<Navigate to="\/"\s+replace\s*\/>\}/);

        const defaultStrings = fs.readFileSync(
          path.join(ROOT, 'android/app/src/main/res/values/strings.xml'),
          'utf8'
        );
        const koStrings = fs.readFileSync(
          path.join(ROOT, 'android/app/src/main/res/values-ko/strings.xml'),
          'utf8'
        );
        assert.match(defaultStrings, /1s Pain Log/);
        assert.match(koStrings, /1초 통증 기록/);

        const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
        assert.match(indexCss, /--accent:/);
        assert.match(indexCss, /\[data-accent=['"]teal['"]\]/);
      },
    },
  ];

  let passed = 0;
  for (const t of tests) {
    await t.fn();
    console.log(`PASS: ${t.name}`);
    passed++;
  }
  console.log(`\nALL ${passed}/${tests.length} v2.3.0 §7 TAXONOMY, i18n & TOKEN TESTS PASSED`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
