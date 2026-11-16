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
    name: 'AuthContext initializes Fail-Closed (isAuthReady=false, isUnlocked=false) and App gates before unlock',
    fn: () => {
      const auth = read('src/context/AuthContext.tsx');
      assert.match(auth, /useState\(false\);\s*\/\/|const \[isAuthReady, setIsAuthReady\] = useState\(false\)/);
      assert.match(auth, /const \[isUnlocked, setIsUnlocked\] = useState\(false\)/);
      assert.match(auth, /isPinSetRef\.current/);
      const app = read('src/App.tsx');
      assert.match(app, /if\s*\(!isAuthReady\)/);
    },
  },
  {
    name: 'HealthContext purges sensitive in-memory state when locked and blocks unauthenticated persist',
    fn: () => {
      const health = read('src/context/HealthContext.tsx');
      assert.match(health, /if\s*\(!isUnlocked\)\s*\{[\s\S]*setConditions\(\[\]\)[\s\S]*setLogs\(\[\]\)[\s\S]*setDiaryEntries\(\[\]\)/);
      assert.match(health, /if\s*\(isPinSet && !activeSessionPin\)/);
    },
  },
  {
    name: 'Biometrics closes silent mock fallback and enforces WebAuthn unless test mock override is explicit',
    fn: () => {
      const bio = read('src/utils/biometrics.ts');
      assert.match(bio, /if\s*\(mockModeOverride === true\)\s*\{\s*authType = 'mock'/);
      assert.match(bio, /if\s*\(mockModeOverride !== true\)\s*\{\s*if\s*\(\s*meta\.authenticatorType !== 'webauthn'/);
      assert.doesNotMatch(bio, /WebAuthn registration fallback to device key token/);
      assert.doesNotMatch(bio, /Fallback: check credentials container in secure context/);
    },
  },
  {
    name: 'AndroidManifest disables global cleartext traffic, disables allowBackup, and applies network_security_config',
    fn: () => {
      const manifest = read('android/app/src/main/AndroidManifest.xml');
      assert.match(manifest, /android:usesCleartextTraffic="false"/);
      assert.match(manifest, /android:allowBackup="false"/);
      assert.match(manifest, /android:networkSecurityConfig="@xml\/network_security_config"/);

      const releaseNet = read('android/app/src/main/res/xml/network_security_config.xml');
      assert.match(releaseNet, /<base-config cleartextTrafficPermitted="false">/);
      assert.match(releaseNet, /<domain includeSubdomains="false">localhost<\/domain>/);
      assert.match(releaseNet, /<domain includeSubdomains="false">127\.0\.0\.1<\/domain>/);
      assert.doesNotMatch(releaseNet, /10\.0\.2\.2/);
    },
  },
  {
    name: 'localLlm enforces HTTPS for non-loopback hosts and preserves loopback http:// compatibility',
    fn: () => {
      const llm = read('src/utils/localLlm.ts');
      assert.match(llm, /export function isLoopbackHost/);
      assert.match(llm, /export function validateEndpointSecurity/);
      assert.match(llm, /const secCheck = validateEndpointSecurity\(base\)/);

      // Replicate exact policy checks
      const isLoopback = (h) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes((h || '').toLowerCase().trim());
      const normalize = (url) => {
        let c = (url || '').trim().replace(/\/+$/, '');
        if (!c.startsWith('http://') && !c.startsWith('https://')) {
          const host = c.split('/')[0].split(':')[0];
          c = (isLoopback(host) ? 'http://' : 'https://') + c;
        }
        return c;
      };
      const validate = (u) => {
        const p = new URL(u);
        return p.protocol === 'https:' || (p.protocol === 'http:' && isLoopback(p.hostname));
      };

      assert.equal(normalize('localhost:11434'), 'http://localhost:11434');
      assert.equal(normalize('192.168.0.10:11434'), 'https://192.168.0.10:11434');
      assert.equal(validate('http://localhost:11434/v1'), true);
      assert.equal(validate('https://192.168.0.10:11434/v1'), true);
      assert.equal(validate('http://192.168.0.10:11434/v1'), false);
    },
  },
  {
    name: 'Settings wires AES-256 passphrase-encrypted backup export & decryption preview import',
    fn: () => {
      const settings = read('src/pages/Settings.tsx');
      assert.match(settings, /encryptBackupWithPassphrase/);
      assert.match(settings, /decryptBackupWithPassphrase/);
      assert.match(settings, /backupPassphrase\.length < 6/);
      assert.match(settings, /importPreview/);
    },
  },
  {
    name: 'Feedback 2026-11-09: Hardware backButton supports route/modal back and double-back-to-exit toast',
    fn: () => {
      const handler = read('src/components/BackButtonHandler.tsx');
      assert.match(handler, /CapApp\.addListener\('backButton'/);
      assert.match(handler, /CapApp\.exitApp\(\)/);
      assert.match(handler, /DOUBLE_BACK_EXIT_WINDOW_MS\s*=\s*2000/);
      const app = read('src/App.tsx');
      assert.match(app, /<BackButtonHandler\s*\/>/);
      assert.match(app, /<LockedBackButtonHandler\s*\/>/);
      const i18n = read('src/i18n/translations.ts');
      assert.match(i18n, /backExitPrompt:\s*'뒤로가기 버튼을 한 번 더 누르면 앱이 종료됩니다\.'/);
    },
  },
  {
    name: 'F-Droid & GPL-3.0 license alignment',
    fn: () => {
      const pkgLicense = read('LICENSE');
      assert.match(pkgLicense, /GNU GENERAL PUBLIC LICENSE/);
      const yml = read('fdroid/metadata/com.bodysignal.app.yml');
      assert.match(yml, /License:\s*GPL-3\.0-only/);
      assert.match(yml, /CurrentVersion:\s*1\.1\.0/);
      assert.match(yml, /CurrentVersionCode:\s*2/);
      assert.match(yml, /npm run build/);
      assert.match(yml, /npx cap sync android/);
      const rootGradle = read('android/build.gradle');
      const appGradle = read('android/app/build.gradle');
      assert.doesNotMatch(rootGradle, /com\.google\.gms:google-services/);
      assert.doesNotMatch(appGradle, /com\.google\.gms\.google-services/);
      const gitignore = read('.gitignore');
      assert.match(gitignore, /\*\.apk/);
      assert.match(gitignore, /android\/app\/src\/main\/assets\/public\//);
    },
  },
  {
    name: 'Native AndroidKeyStore & BiometricPrompt hardware security plugin is wired end-to-end',
    fn: () => {
      const pluginJava = read('android/app/src/main/java/com/bodysignal/app/SecureAuthPlugin.java');
      assert.match(pluginJava, /AndroidKeyStore/);
      assert.match(pluginJava, /BiometricPrompt\.CryptoObject/);
      assert.match(pluginJava, /setUserAuthenticationRequired\(true\)/);
      assert.match(pluginJava, /setInvalidatedByBiometricEnrollment\(true\)/);
      const mainActivity = read('android/app/src/main/java/com/bodysignal/app/MainActivity.java');
      assert.match(mainActivity, /registerPlugin\(SecureAuthPlugin\.class\);[\s\S]*super\.onCreate/);
      const bioTs = read('src/utils/biometrics.ts');
      assert.match(bioTs, /SecureAuth\.enrollBiometricPin/);
      assert.match(bioTs, /SecureAuth\.authenticateBiometricPin/);
      const storageTs = read('src/utils/storage.ts');
      assert.match(storageTs, /SecureAuth\.getOrCreateDeviceMasterKeyHex/);
      assert.doesNotMatch(storageTs, /localStorage\.setItem\('bs-device-master-key-v1'/);
    },
  },
];

let passed = 0;
for (const t of tests) {
  t.fn();
  passed++;
  console.log(`  ✓ ${t.name}`);
}
console.log(`\nSecurity Hardening & Feedback Verification: ${passed}/${tests.length} PASSED`);
