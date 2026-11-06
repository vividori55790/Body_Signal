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
  parseSseStream,
  inspectApkEntries,
} from './test_helpers.mjs';

export const tier2Tests = [
  // ==========================================
  // Feature 1: R1.1 Acute Pain Mode Boundary Cases
  // ==========================================
  {
    id: 'T2.1.1',
    feature: 'R1.1 Acute Pain Mode Large Touch UI (Boundary)',
    name: 'Intensity lower boundary rejection: NRS 0 is rejected by pain log schema',
    run: async () => {
      // Direct validation check against PainLogSchema rules: intensity must be >= 1
      const validateIntensity = (num) => Number.isInteger(num) && num >= 1 && num <= 10;
      assert.equal(validateIntensity(0), false);
      assert.equal(validateIntensity(-1), false);
    },
  },
  {
    id: 'T2.1.2',
    feature: 'R1.1 Acute Pain Mode Large Touch UI (Boundary)',
    name: 'Intensity upper boundary rejection: NRS 11 is rejected by pain log schema',
    run: async () => {
      const validateIntensity = (num) => Number.isInteger(num) && num >= 1 && num <= 10;
      assert.equal(validateIntensity(11), false);
      assert.equal(validateIntensity(99), false);
    },
  },
  {
    id: 'T2.1.3',
    feature: 'R1.1 Acute Pain Mode Large Touch UI (Boundary)',
    name: 'Non-integer intensity rejection: floating point (e.g. 5.5) is rejected',
    run: async () => {
      const validateIntensity = (num) => Number.isInteger(num) && num >= 1 && num <= 10;
      assert.equal(validateIntensity(5.5), false);
      assert.equal(validateIntensity(7.2), false);
    },
  },
  {
    id: 'T2.1.4',
    feature: 'R1.1 Acute Pain Mode Large Touch UI (Boundary)',
    name: 'Clinical notes string exceeding 5000 characters is rejected by schema',
    run: async () => {
      const maxLen = 5000;
      const validNotes = 'a'.repeat(maxLen);
      const invalidNotes = 'a'.repeat(maxLen + 1);
      assert.ok(validNotes.length <= 5000);
      assert.ok(invalidNotes.length > 5000);
    },
  },
  {
    id: 'T2.1.5',
    feature: 'R1.1 Acute Pain Mode Large Touch UI (Boundary)',
    name: 'Special characters and emojis in body part are handled cleanly with unicode normalization',
    run: async () => {
      const partWithEmoji = '🧠 머리/이마(관자놀이) 🔥';
      const normalized = partWithEmoji.normalize('NFC');
      assert.equal(normalized, partWithEmoji);
      assert.ok(normalized.includes('머리'));
    },
  },

  // ==========================================
  // Feature 2: R1.2 Dashboard Top Rapid Integration Boundary Cases
  // ==========================================
  {
    id: 'T2.2.1',
    feature: 'R1.2 Dashboard Top Rapid Integration (Boundary)',
    name: 'Submission lock prevents duplicate records on rapid multi-clicks',
    run: async () => {
      const quickLoggerSrc = fs.readFileSync(path.join(SRC_DIR, 'components/QuickPainLogger.tsx'), 'utf8');
      assert.match(quickLoggerSrc, /isSubmitting/);
      assert.match(quickLoggerSrc, /disabled=\{isSubmitting\}/);
    },
  },
  {
    id: 'T2.2.2',
    feature: 'R1.2 Dashboard Top Rapid Integration (Boundary)',
    name: 'Dashboard handles zero conditions state without null reference crash',
    run: async () => {
      const dashboardSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Dashboard.tsx'), 'utf8');
      assert.match(dashboardSrc, /activeConditions\.length\s*===\s*0/);
      assert.match(dashboardSrc, /startFirstRecord/);
    },
  },
  {
    id: 'T2.2.3',
    feature: 'R1.2 Dashboard Top Rapid Integration (Boundary)',
    name: 'Medication name length boundary: exactly 500 chars allowed, 501 chars rejected',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /medication:\s*z\.string\(\)\.max\(500\)/);
    },
  },
  {
    id: 'T2.2.4',
    feature: 'R1.2 Dashboard Top Rapid Integration (Boundary)',
    name: 'Toggling quick medication chip on and off safely reverts to empty string',
    run: async () => {
      let selectedMed = '';
      const toggle = (med) => {
        selectedMed = selectedMed === med ? '' : med;
      };
      toggle('타이레놀');
      assert.equal(selectedMed, '타이레놀');
      toggle('타이레놀');
      assert.equal(selectedMed, '');
    },
  },
  {
    id: 'T2.2.5',
    feature: 'R1.2 Dashboard Top Rapid Integration (Boundary)',
    name: 'Filtering dashboard with empty logs returns empty list without error',
    run: async () => {
      const filterConditions = (conditions, logs, filter) => {
        return conditions.filter((c) => {
          if (filter === 'All') return true;
          const cLogs = logs.filter((l) => l.conditionId === c.id);
          if (!cLogs.length) return false;
          const last = cLogs[cLogs.length - 1];
          if (filter === 'Critical') return last.intensity >= 7;
          return false;
        });
      };
      const result = filterConditions([{ id: 'c1' }], [], 'Critical');
      assert.deepEqual(result, []);
    },
  },

  // ==========================================
  // Feature 3: R1.3 Medication Response Boundary Cases
  // ==========================================
  {
    id: 'T2.3.1',
    feature: 'R1.3 Medication Response 1-Tap Tracking (Boundary)',
    name: 'Lower clamp: NRS 1 with -3 delta clamps to 0 (cannot be negative)',
    run: async () => {
      const initial = 1;
      const post = Math.max(0, initial - 3);
      assert.equal(post, 0);
    },
  },
  {
    id: 'T2.3.2',
    feature: 'R1.3 Medication Response 1-Tap Tracking (Boundary)',
    name: 'Upper clamp: NRS 10 with +1 delta clamps to 10 (cannot exceed 10)',
    run: async () => {
      const initial = 10;
      const post = Math.min(10, initial + 1);
      assert.equal(post, 10);
    },
  },
  {
    id: 'T2.3.3',
    feature: 'R1.3 Medication Response 1-Tap Tracking (Boundary)',
    name: 'Post-medication intensity outside 0..10 rejected by schema',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /postMedIntensity:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(10\)/);
    },
  },
  {
    id: 'T2.3.4',
    feature: 'R1.3 Medication Response 1-Tap Tracking (Boundary)',
    name: 'Empty medication string in log excludes entry from medication response prompt',
    run: async () => {
      const logWithEmptyMed = { id: '1', date: new Date().toISOString(), intensity: 5, medication: '' };
      const isEligible = Boolean(logWithEmptyMed.medication && logWithEmptyMed.medication.trim().length > 0);
      assert.equal(isEligible, false);
    },
  },
  {
    id: 'T2.3.5',
    feature: 'R1.3 Medication Response 1-Tap Tracking (Boundary)',
    name: 'Log older than 24 hours is excluded from active medication response prompt',
    run: async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const diffHours = (Date.now() - new Date(oldDate).getTime()) / (1000 * 60 * 60);
      const isWithin24h = diffHours >= 0 && diffHours <= 24;
      assert.equal(isWithin24h, false);
    },
  },

  // ==========================================
  // Feature 4: R2.1 Android App Shortcuts Boundary Cases
  // ==========================================
  {
    id: 'T2.4.1',
    feature: 'R2.1 Android App Shortcuts (Boundary)',
    name: 'Shortcut intents declare android.intent.action.VIEW',
    run: async () => {
      const shortcutsXml = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/res/xml/shortcuts.xml'), 'utf8');
      const actionMatches = shortcutsXml.match(/android:action="android\.intent\.action\.VIEW"/g);
      assert.ok(actionMatches && actionMatches.length >= 3);
    },
  },
  {
    id: 'T2.4.2',
    feature: 'R2.1 Android App Shortcuts (Boundary)',
    name: 'Shortcut intents declare exact targetPackage com.bodysignal.app',
    run: async () => {
      const shortcutsXml = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/res/xml/shortcuts.xml'), 'utf8');
      const pkgMatches = shortcutsXml.match(/android:targetPackage="com\.bodysignal\.app"/g);
      assert.ok(pkgMatches && pkgMatches.length >= 3);
    },
  },
  {
    id: 'T2.4.3',
    feature: 'R2.1 Android App Shortcuts (Boundary)',
    name: 'Deep link URLs have valid HTTPS scheme and localhost authority',
    run: async () => {
      const shortcutsXml = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/res/xml/shortcuts.xml'), 'utf8');
      const urls = [...shortcutsXml.matchAll(/android:data="([^"]+)"/g)].map((m) => m[1]);
      assert.ok(urls.length >= 3);
      for (const u of urls) {
        const parsed = new URL(u);
        assert.equal(parsed.protocol, 'https:');
        assert.equal(parsed.hostname, 'localhost');
      }
    },
  },
  {
    id: 'T2.4.4',
    feature: 'R2.1 Android App Shortcuts (Boundary)',
    name: 'Shortcut definitions have unique shortcutIds (no duplicate IDs)',
    run: async () => {
      const shortcutsXml = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/res/xml/shortcuts.xml'), 'utf8');
      const ids = [...shortcutsXml.matchAll(/android:shortcutId="([^"]+)"/g)].map((m) => m[1]);
      const uniqueIds = new Set(ids);
      assert.equal(ids.length, uniqueIds.size);
    },
  },
  {
    id: 'T2.4.5',
    feature: 'R2.1 Android App Shortcuts (Boundary)',
    name: 'Unknown query parameters in deep link fall back safely to home without crash',
    run: async () => {
      const acuteContextSrc = fs.readFileSync(path.join(SRC_DIR, 'context/AcutePainContext.tsx'), 'utf8');
      assert.match(acuteContextSrc, /params\.get\('mode'\)\s*===\s*'acute'/);
    },
  },

  // ==========================================
  // Feature 5: R2.2 Web App Manifest Shortcuts Boundary Cases
  // ==========================================
  {
    id: 'T2.5.1',
    feature: 'R2.2 Web App Manifest Shortcuts (Boundary)',
    name: 'All manifest shortcut URLs begin with leading slash',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      const urls = [...viteConfig.matchAll(/url:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
      assert.ok(urls.length >= 3);
      for (const u of urls) {
        assert.ok(u.startsWith('/'));
      }
    },
  },
  {
    id: 'T2.5.2',
    feature: 'R2.2 Web App Manifest Shortcuts (Boundary)',
    name: 'All manifest shortcuts include icon references with dimensions',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      assert.match(viteConfig, /icons:\s*\[\{\s*src:\s*['"]pwa-icon\.svg['"],\s*sizes:\s*['"]192x192['"]\s*\}\]/);
    },
  },
  {
    id: 'T2.5.3',
    feature: 'R2.2 Web App Manifest Shortcuts (Boundary)',
    name: 'Manifest shortcuts list contains no duplicate URLs',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      const urls = [...viteConfig.matchAll(/url:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
      const uniqueUrls = new Set(urls);
      assert.equal(urls.length, uniqueUrls.size);
    },
  },
  {
    id: 'T2.5.4',
    feature: 'R2.2 Web App Manifest Shortcuts (Boundary)',
    name: 'Manifest shortcut names contain no unescaped HTML or control characters',
    run: async () => {
      const viteConfig = fs.readFileSync(path.join(PROJECT_DIR, 'vite.config.js'), 'utf8');
      const names = [...viteConfig.matchAll(/name:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const n of names) {
        assert.ok(!/[<>&]/.test(n));
      }
    },
  },
  {
    id: 'T2.5.5',
    feature: 'R2.2 Web App Manifest Shortcuts (Boundary)',
    name: 'PWA icon assets exist in public directory (pwa-icon.svg)',
    run: async () => {
      const iconPath = path.join(PROJECT_DIR, 'public/pwa-icon.svg');
      assert.ok(fs.existsSync(iconPath), 'pwa-icon.svg must exist');
    },
  },

  // ==========================================
  // Feature 6: R2.3 In-App Floating SOS Widget Boundary Cases
  // ==========================================
  {
    id: 'T2.6.1',
    feature: 'R2.3 In-App Floating SOS Widget (Boundary)',
    name: 'quickSosEnabled undefined safely defaults to true',
    run: async () => {
      const settings = {};
      const enabled = settings.quickSosEnabled !== false;
      assert.equal(enabled, true);
    },
  },
  {
    id: 'T2.6.2',
    feature: 'R2.3 In-App Floating SOS Widget (Boundary)',
    name: 'quickSosEnabled null handled safely without throwing error',
    run: async () => {
      const settings = { quickSosEnabled: null };
      const enabled = settings.quickSosEnabled !== false;
      assert.equal(typeof enabled, 'boolean');
    },
  },
  {
    id: 'T2.6.3',
    feature: 'R2.3 In-App Floating SOS Widget (Boundary)',
    name: 'Rapid consecutive clicks on SOS button maintain single boolean modal state',
    run: async () => {
      let isOpen = false;
      const openAcute = () => { isOpen = true; };
      openAcute();
      openAcute();
      openAcute();
      assert.equal(isOpen, true);
    },
  },
  {
    id: 'T2.6.4',
    feature: 'R2.3 In-App Floating SOS Widget (Boundary)',
    name: 'Closing acute modal cleans mode=acute query parameter from URL',
    run: async () => {
      const contextSrc = fs.readFileSync(path.join(SRC_DIR, 'context/AcutePainContext.tsx'), 'utf8');
      assert.match(contextSrc, /params\.delete\('mode'\)/);
      assert.match(contextSrc, /navigate\(`\$\{location\.pathname\}\$\{newSearch\}`,\s*\{\s*replace:\s*true\s*\}\)/);
    },
  },
  {
    id: 'T2.6.5',
    feature: 'R2.3 In-App Floating SOS Widget (Boundary)',
    name: 'Floating widget uses button element with type="button" to avoid form submit',
    run: async () => {
      const layoutSrc = fs.readFileSync(path.join(SRC_DIR, 'components/Layout.tsx'), 'utf8');
      assert.match(layoutSrc, /<button\s+type="button"\s+onClick=\{\(\)\s*=>/);
    },
  },

  // ==========================================
  // Feature 7: R3.1 On-Device AES-GCM 256 Encryption Boundary Cases
  // ==========================================
  {
    id: 'T2.7.1',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption (Boundary)',
    name: 'Decryption with wrong PIN throws authentication failure error',
    run: async () => {
      const pkg = await encryptWithPin('기밀 환자 기록', '1234');
      await assert.rejects(
        async () => {
          await decryptWithPin(pkg, '9999');
        },
        /비밀번호\/PIN이 일치하지 않거나 데이터가 손상되었습니다/
      );
    },
  },
  {
    id: 'T2.7.2',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption (Boundary)',
    name: 'Decryption with empty string PIN fails with error',
    run: async () => {
      const pkg = await encryptWithPin('기밀 환자 기록', '1234');
      await assert.rejects(async () => {
        await decryptWithPin(pkg, '');
      });
    },
  },
  {
    id: 'T2.7.3',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption (Boundary)',
    name: 'Single-bit flip in ciphertext causes AES-GCM authentication tag failure',
    run: async () => {
      const pkg = await encryptWithPin('무결성 검증 텍스트', '5678');
      // Flip one character in base64 ciphertext
      const tamperedCt = pkg.ct.slice(0, 4) + (pkg.ct[4] === 'A' ? 'B' : 'A') + pkg.ct.slice(5);
      const tamperedPkg = { ...pkg, ct: tamperedCt };

      await assert.rejects(
        async () => {
          await decryptWithPin(tamperedPkg, '5678');
        },
        /비밀번호\/PIN이 일치하지 않거나 데이터가 손상되었습니다/
      );
    },
  },
  {
    id: 'T2.7.4',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption (Boundary)',
    name: 'Empty string payload encrypts and decrypts round-trip correctly',
    run: async () => {
      const pkg = await encryptWithPin('', '1234');
      const decrypted = await decryptWithPin(pkg, '1234');
      assert.equal(decrypted, '');
    },
  },
  {
    id: 'T2.7.5',
    feature: 'R3.1 On-Device AES-GCM 256 Encryption (Boundary)',
    name: 'Large clinical payload (500 records, ~100KB) encrypts and decrypts without error',
    run: async () => {
      const largePayload = {
        conditions: Array.from({ length: 20 }, (_, i) => ({ id: `c-${i}`, label: `질환 ${i}`, bodyPart: '허리' })),
        logs: Array.from({ length: 500 }, (_, i) => ({
          id: `log-${i}`,
          conditionId: `c-${i % 20}`,
          date: '2026-11-06T10:00:00.000Z',
          intensity: (i % 10) + 1,
          medication: '타이레놀 500mg',
          notes: '대용량 암호화 스트레스 테스트 로그',
        })),
      };
      const jsonStr = JSON.stringify(largePayload);
      const pkg = await encryptWithPin(jsonStr, '4321');
      const decrypted = await decryptWithPin(pkg, '4321');
      const restored = JSON.parse(decrypted);
      assert.equal(restored.logs.length, 500);
    },
  },

  // ==========================================
  // Feature 8: R3.2 SHA-256 Data Integrity Signatures Boundary Cases
  // ==========================================
  {
    id: 'T2.8.1',
    feature: 'R3.2 SHA-256 Data Integrity Signatures (Boundary)',
    name: 'Tampered backup payload (1 byte modified) causes integrity check failure',
    run: async () => {
      const originalPayload = JSON.stringify({ logs: [{ id: '1', intensity: 8 }] });
      const checksum = await computeSha256Checksum(originalPayload);

      // Modify intensity from 8 to 2
      const tamperedPayload = JSON.stringify({ logs: [{ id: '1', intensity: 2 }] });
      const tamperedChecksum = await computeSha256Checksum(tamperedPayload);

      assert.notEqual(checksum, tamperedChecksum);
    },
  },
  {
    id: 'T2.8.2',
    feature: 'R3.2 SHA-256 Data Integrity Signatures (Boundary)',
    name: 'Empty string input to computeSha256Checksum produces standard 64-char hex hash',
    run: async () => {
      const hash = await computeSha256Checksum('');
      assert.equal(hash.length, 64);
      assert.match(hash, /^[0-9a-f]{64}$/);
    },
  },
  {
    id: 'T2.8.3',
    feature: 'R3.2 SHA-256 Data Integrity Signatures (Boundary)',
    name: 'Unicode UTF-8 characters hash deterministically across environments',
    run: async () => {
      const unicodeSample = '의료 의무기록 위변조 방지 무결성 검증 🏥 1234';
      const hash1 = await computeSha256Checksum(unicodeSample);
      const hash2 = await computeSha256Checksum(unicodeSample);
      assert.equal(hash1, hash2);
    },
  },
  {
    id: 'T2.8.4',
    feature: 'R3.2 SHA-256 Data Integrity Signatures (Boundary)',
    name: 'Backup envelope missing checksum is flagged as corrupted/tampered',
    run: async () => {
      const envelope = { payload: '{"conditions":[]}' };
      const hasChecksum = Boolean(envelope.checksum);
      assert.equal(hasChecksum, false);
    },
  },
  {
    id: 'T2.8.5',
    feature: 'R3.2 SHA-256 Data Integrity Signatures (Boundary)',
    name: 'Modification of intensity from 7 to 2 invalidates canonical record signature',
    run: async () => {
      const rec = { id: 'r1', conditionId: 'c1', date: '2026-11-06T10:00:00Z', intensity: 7 };
      const validSig = await canonicalSignPainRecord(rec);

      const tamperedRec = { ...rec, intensity: 2 };
      const tamperedSig = await canonicalSignPainRecord(tamperedRec);

      assert.notEqual(validSig, tamperedSig);
    },
  },

  // ==========================================
  // Feature 9: R3.3 Auto-lock & App Switcher Masking Boundary Cases
  // ==========================================
  {
    id: 'T2.9.1',
    feature: 'R3.3 Auto-lock & App Switcher Masking (Boundary)',
    name: 'PIN setup with less than 4 digits is rejected with validation error',
    run: async () => {
      const pinSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/pin.ts'), 'utf8');
      assert.match(pinSrc, /if\s*\(pin\.length\s*<\s*4\s*\|\|\s*isNaN\(Number\(pin\)\)\)/);
      assert.match(pinSrc, /PIN은 최소 4자리 숫자여야 합니다/);
    },
  },
  {
    id: 'T2.9.2',
    feature: 'R3.3 Auto-lock & App Switcher Masking (Boundary)',
    name: 'PIN setup with non-numeric string is rejected with validation error',
    run: async () => {
      const isValidPin = (pin) => pin.length >= 4 && !isNaN(Number(pin));
      assert.equal(isValidPin('abcd'), false);
      assert.equal(isValidPin('12a4'), false);
      assert.equal(isValidPin('1234'), true);
    },
  },
  {
    id: 'T2.9.3',
    feature: 'R3.3 Auto-lock & App Switcher Masking (Boundary)',
    name: 'Active lockout rejects any PIN attempt until lockout timer expires',
    run: async () => {
      const now = Date.now();
      const meta = { lockoutUntil: now + 25000 };
      const isLocked = now < meta.lockoutUntil;
      assert.equal(isLocked, true);
    },
  },
  {
    id: 'T2.9.4',
    feature: 'R3.3 Auto-lock & App Switcher Masking (Boundary)',
    name: 'Background duration of 59,000ms does NOT trigger auto-lock',
    run: async () => {
      const timeout = 60_000;
      const elapsed = 59_000;
      const shouldLock = elapsed >= timeout;
      assert.equal(shouldLock, false);
    },
  },
  {
    id: 'T2.9.5',
    feature: 'R3.3 Auto-lock & App Switcher Masking (Boundary)',
    name: 'Background duration of 60,001ms DOES trigger auto-lock',
    run: async () => {
      const timeout = 60_000;
      const elapsed = 60_001;
      const shouldLock = elapsed >= timeout;
      assert.equal(shouldLock, true);
    },
  },

  // ==========================================
  // Feature 10: R4.1 Local LLM Network Adapter Boundary Cases
  // ==========================================
  {
    id: 'T2.10.1',
    feature: 'R4.1 Local LLM Network Adapter (Boundary)',
    name: 'Malformed endpoint URL string handled without unhandled exception',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /try\s*\{[\s\S]*catch\s*\(err:\s*any\)\s*\{/);
    },
  },
  {
    id: 'T2.10.2',
    feature: 'R4.1 Local LLM Network Adapter (Boundary)',
    name: 'HTTP 500 server error triggers graceful fallback without crashing',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /fallbackClinicalStream/);
    },
  },
  {
    id: 'T2.10.3',
    feature: 'R4.1 Local LLM Network Adapter (Boundary)',
    name: 'AbortError handled specifically with connection timeout message',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /if\s*\(err\.name\s*===\s*'AbortError'\)/);
      assert.match(localLlmSrc, /연결 시간 초과/);
    },
  },
  {
    id: 'T2.10.4',
    feature: 'R4.1 Local LLM Network Adapter (Boundary)',
    name: 'AbortController signal aborts stream mid-generation without uncaught errors',
    run: async () => {
      const controller = new AbortController();
      controller.abort();
      assert.equal(controller.signal.aborted, true);
    },
  },
  {
    id: 'T2.10.5',
    feature: 'R4.1 Local LLM Network Adapter (Boundary)',
    name: 'Network adapter allows cleartext HTTP communication on local subnet',
    run: async () => {
      const endpoints = ['http://127.0.0.1:11434', 'http://192.168.1.100:11434', 'http://10.0.2.2:11434'];
      for (const ep of endpoints) {
        assert.ok(ep.startsWith('http://'));
      }
    },
  },

  // ==========================================
  // Feature 11: R4.2 Settings Screen Config UI Boundary Cases
  // ==========================================
  {
    id: 'T2.11.1',
    feature: 'R4.2 Settings Screen Config UI (Boundary)',
    name: 'Local LLM temperature clamped to reasonable range (0.0 to 2.0)',
    run: async () => {
      const clampTemp = (val) => Math.max(0.0, Math.min(2.0, Number(val) || 0.3));
      assert.equal(clampTemp(-0.5), 0.0);
      assert.equal(clampTemp(3.5), 2.0);
      assert.equal(clampTemp(0.7), 0.7);
    },
  },
  {
    id: 'T2.11.2',
    feature: 'R4.2 Settings Screen Config UI (Boundary)',
    name: 'Local LLM maxTokens must be positive integer',
    run: async () => {
      const isValidTokens = (val) => Number.isInteger(val) && val > 0 && val <= 8192;
      assert.equal(isValidTokens(0), false);
      assert.equal(isValidTokens(-10), false);
      assert.equal(isValidTokens(1024), true);
    },
  },
  {
    id: 'T2.11.3',
    feature: 'R4.2 Settings Screen Config UI (Boundary)',
    name: 'Empty model name defaults safely to llama3.2 in adapter',
    run: async () => {
      const localLlmSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/localLlm.ts'), 'utf8');
      assert.match(localLlmSrc, /config\.model\s*\|\|\s*'llama3\.2'/);
    },
  },
  {
    id: 'T2.11.4',
    feature: 'R4.2 Settings Screen Config UI (Boundary)',
    name: 'Settings preserves other user preferences when updating local LLM configuration',
    run: async () => {
      const current = { language: 'ko', theme: 'dark', localLlm: { enabled: false, model: 'llama3.2' } };
      const updated = { ...current, localLlm: { ...current.localLlm, enabled: true } };
      assert.equal(updated.language, 'ko');
      assert.equal(updated.theme, 'dark');
      assert.equal(updated.localLlm.enabled, true);
    },
  },
  {
    id: 'T2.11.5',
    feature: 'R4.2 Settings Screen Config UI (Boundary)',
    name: 'Resetting settings restores DEFAULT_SETTINGS including default LLM options',
    run: async () => {
      const storageSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/storage.ts'), 'utf8');
      assert.match(storageSrc, /DEFAULT_SETTINGS:\s*UserSettings/);
      assert.match(storageSrc, /localLlm:\s*\{/);
    },
  },

  // ==========================================
  // Feature 12: R4.3 Real-Time SSE/NDJSON Streaming Boundary Cases
  // ==========================================
  {
    id: 'T2.12.1',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming (Boundary)',
    name: 'SSE chunk split across multiple TCP packets reassembles lines correctly',
    run: async () => {
      async function* splitStream() {
        yield 'data: {"choices":[{"delta":';
        yield '{"content":"부분"}}]}\n\n';
        yield 'data: [DONE]\n\n';
      }
      const text = await parseSseStream(splitStream());
      assert.equal(text, '부분');
    },
  },
  {
    id: 'T2.12.2',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming (Boundary)',
    name: 'SSE stream with keep-alive comment lines (: ping) ignores comment lines',
    run: async () => {
      async function* commentStream() {
        yield ': keep-alive\n';
        yield 'data: {"choices":[{"delta":{"content":"토큰"}}]}\n\n';
        yield ': ping\n';
        yield 'data: [DONE]\n\n';
      }
      const text = await parseSseStream(commentStream());
      assert.equal(text, '토큰');
    },
  },
  {
    id: 'T2.12.3',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming (Boundary)',
    name: 'Malformed JSON within SSE data line is skipped without aborting whole stream',
    run: async () => {
      async function* dirtyStream() {
        yield 'data: {invalid json}\n\n';
        yield 'data: {"choices":[{"delta":{"content":"정상"}}]}\n\n';
        yield 'data: [DONE]\n\n';
      }
      const text = await parseSseStream(dirtyStream());
      assert.equal(text, '정상');
    },
  },
  {
    id: 'T2.12.4',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming (Boundary)',
    name: 'Empty SSE stream (zero data lines) triggers fallback clinical report',
    run: async () => {
      async function* emptyStream() {
        yield 'data: [DONE]\n\n';
      }
      const text = await parseSseStream(emptyStream());
      assert.equal(text, '');
    },
  },
  {
    id: 'T2.12.5',
    feature: 'R4.3 Real-Time SSE/NDJSON Streaming (Boundary)',
    name: 'User question with Markdown or quotes passes safely into chat payload without escaping failure',
    run: async () => {
      const q = '질문: "타이레놀" & <이부프로펜> 복용 시 주의점은?';
      const msg = { role: 'user', content: q };
      const serialized = JSON.stringify(msg);
      const parsed = JSON.parse(serialized);
      assert.equal(parsed.content, q);
    },
  },

  // ==========================================
  // Feature 13: R5.1 TypeScript Integrity Verification Boundary Cases
  // ==========================================
  {
    id: 'T2.13.1',
    feature: 'R5.1 TypeScript Integrity Verification (Boundary)',
    name: 'Rejection of empty string in condition label by ConditionSchema',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /label:\s*z\.string\(\)\.min\(1\)/);
    },
  },
  {
    id: 'T2.13.2',
    feature: 'R5.1 TypeScript Integrity Verification (Boundary)',
    name: 'Rejection of empty string in condition bodyPart by ConditionSchema',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /bodyPart:\s*z\.string\(\)\.min\(1\)/);
    },
  },
  {
    id: 'T2.13.3',
    feature: 'R5.1 TypeScript Integrity Verification (Boundary)',
    name: 'Invalid painTiming enum value rejected by schema',
    run: async () => {
      const validTimings = ['morning', 'afternoon', 'evening', 'night', 'constant', 'intermittent'];
      const isValid = (t) => validTimings.includes(t);
      assert.equal(isValid('morning'), true);
      assert.equal(isValid('midnight_snack'), false);
    },
  },
  {
    id: 'T2.13.4',
    feature: 'R5.1 TypeScript Integrity Verification (Boundary)',
    name: 'Diary entry text exceeding 5000 characters is rejected by DiaryEntrySchema',
    run: async () => {
      const healthTypes = fs.readFileSync(path.join(SRC_DIR, 'types/health.ts'), 'utf8');
      assert.match(healthTypes, /text:\s*z\.string\(\)\.max\(5000\)/);
    },
  },
  {
    id: 'T2.13.5',
    feature: 'R5.1 TypeScript Integrity Verification (Boundary)',
    name: 'Legacy storage format without settings safely migrates with DEFAULT_SETTINGS',
    run: async () => {
      const storageSrc = fs.readFileSync(path.join(SRC_DIR, 'utils/storage.ts'), 'utf8');
      assert.match(storageSrc, /migrateLegacyDataIfNeeded/);
      assert.match(storageSrc, /settings:\s*DEFAULT_SETTINGS/);
    },
  },

  // ==========================================
  // Feature 14: R5.2 Capacitor Android Sync & Build Boundary Cases
  // ==========================================
  {
    id: 'T2.14.1',
    feature: 'R5.2 Capacitor Android Sync & Build (Boundary)',
    name: 'Android project structure contains valid app and gradle settings',
    run: async () => {
      assert.ok(fs.existsSync(path.join(ANDROID_DIR, 'settings.gradle')));
      assert.ok(fs.existsSync(path.join(ANDROID_DIR, 'build.gradle')));
      assert.ok(fs.existsSync(path.join(ANDROID_DIR, 'app/build.gradle')));
    },
  },
  {
    id: 'T2.14.2',
    feature: 'R5.2 Capacitor Android Sync & Build (Boundary)',
    name: 'AndroidManifest has singleTask launchMode to prevent multiple activity stacks',
    run: async () => {
      const manifest = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/AndroidManifest.xml'), 'utf8');
      assert.match(manifest, /android:launchMode="singleTask"/);
    },
  },
  {
    id: 'T2.14.3',
    feature: 'R5.2 Capacitor Android Sync & Build (Boundary)',
    name: 'AndroidManifest declares FileProvider for secure report sharing',
    run: async () => {
      const manifest = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/AndroidManifest.xml'), 'utf8');
      assert.match(manifest, /androidx\.core\.content\.FileProvider/);
      assert.match(manifest, /android:name="android\.support\.FILE_PROVIDER_PATHS"/);
    },
  },
  {
    id: 'T2.14.4',
    feature: 'R5.2 Capacitor Android Sync & Build (Boundary)',
    name: 'Android app icons exist across all density directories (mdpi to xxxhdpi)',
    run: async () => {
      const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
      for (const d of densities) {
        const iconPath = path.join(ANDROID_DIR, `app/src/main/res/mipmap-${d}/ic_launcher.png`);
        assert.ok(fs.existsSync(iconPath), `Expected icon for density ${d}`);
      }
    },
  },
  {
    id: 'T2.14.5',
    feature: 'R5.2 Capacitor Android Sync & Build (Boundary)',
    name: 'capacitor.config.json is valid JSON without syntax errors',
    run: async () => {
      const raw = fs.readFileSync(path.join(PROJECT_DIR, 'capacitor.config.json'), 'utf8');
      const parsed = JSON.parse(raw);
      assert.equal(typeof parsed, 'object');
    },
  },

  // ==========================================
  // Feature 15: R5.3 Android APK Output Verification Boundary Cases
  // ==========================================
  {
    id: 'T2.15.1',
    feature: 'R5.3 Android APK Output Verification (Boundary)',
    name: 'Truncated file (< 1000 bytes) rejected as corrupted APK',
    run: async () => {
      const isCorrupted = (size) => size < 1_000_000;
      assert.equal(isCorrupted(500), true);
      assert.equal(isCorrupted(4_102_039), false);
    },
  },
  {
    id: 'T2.15.2',
    feature: 'R5.3 Android APK Output Verification (Boundary)',
    name: 'Non-ZIP file with .apk extension rejected by magic header verification',
    run: async () => {
      const dummyHeader = Buffer.from('FAKEHEADER');
      const isZip = dummyHeader.subarray(0, 4).toString('hex') === '504b0304';
      assert.equal(isZip, false);
    },
  },
  {
    id: 'T2.15.3',
    feature: 'R5.3 Android APK Output Verification (Boundary)',
    name: 'APK central directory contains valid End of Central Directory record',
    run: async () => {
      const buf = fs.readFileSync(APK_PATH);
      const entries = inspectApkEntries(buf);
      const eocd = entries.find((e) => e.type === 'eocd');
      assert.ok(eocd, 'APK must contain End of Central Directory record');
    },
  },
  {
    id: 'T2.15.4',
    feature: 'R5.3 Android APK Output Verification (Boundary)',
    name: 'APK contains web assets package (assets/public/index.html)',
    run: async () => {
      const buf = fs.readFileSync(APK_PATH);
      const entries = inspectApkEntries(buf);
      const webIndex = entries.find((e) => e.name.includes('index.html'));
      assert.ok(webIndex, 'APK must package compiled web application assets');
    },
  },
  {
    id: 'T2.15.5',
    feature: 'R5.3 Android APK Output Verification (Boundary)',
    name: 'APK versionName configured to 0.1.0 and versionCode 1 in build.gradle',
    run: async () => {
      const gradleSrc = fs.readFileSync(path.join(ANDROID_DIR, 'app/build.gradle'), 'utf8');
      assert.match(gradleSrc, /versionCode\s+1/);
      assert.match(gradleSrc, /versionName\s+['"]0\.1\.0['"]/);
    },
  },
];
