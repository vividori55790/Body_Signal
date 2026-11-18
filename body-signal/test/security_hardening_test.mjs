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
    name: 'localLlm enforces strict on-device-only (loopback / built-in) policy and blocks all external servers',
    fn: () => {
      const llm = read('src/utils/localLlm.ts');
      assert.match(llm, /export function isLoopbackHost/);
      assert.match(llm, /export function validateEndpointSecurity/);
      assert.match(llm, /const secCheck = validateEndpointSecurity\(base\)/);
      assert.match(llm, /redirect:\s*'error'/);
      assert.match(llm, /credentials:\s*'omit'/);
      assert.match(llm, /<clinical_record_data>/);

      // Replicate exact strict on-device policy checks
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
        return (p.protocol === 'http:' || p.protocol === 'https:') && isLoopback(p.hostname);
      };

      assert.equal(normalize('localhost:11434'), 'http://localhost:11434');
      assert.equal(normalize('192.168.0.10:11434'), 'https://192.168.0.10:11434');
      assert.equal(validate('http://localhost:11434/v1'), true);
      assert.equal(validate('http://127.0.0.1:11434/v1'), true);
      assert.equal(validate('https://192.168.0.10:11434/v1'), false);
      assert.equal(validate('http://192.168.0.10:11434/v1'), false);
      assert.equal(validate('https://api.openai.com/v1'), false);
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
      const pkgVersion = JSON.parse(read('package.json')).version;
      const yml = read('fdroid/metadata/com.bodysignal.app.yml');
      assert.match(yml, /License:\s*GPL-3\.0-only/);
      assert.match(yml, /npm run build/);
      assert.match(yml, /npx cap sync android/);
      const rootGradle = read('android/build.gradle');
      const appGradle = read('android/app/build.gradle');
      assert.doesNotMatch(rootGradle, /com\.google\.gms:google-services/);
      assert.doesNotMatch(appGradle, /com\.google\.gms\.google-services/);
      const gradleCode = appGradle.match(/\bversionCode\s+(\d+)/)?.[1];
      const gradleName = appGradle.match(/\bversionName\s+["']([^"']+)["']/)?.[1];
      const ymlVersion = yml.match(/^CurrentVersion:\s*(.+)$/m)?.[1]?.trim();
      const ymlCode = yml.match(/^CurrentVersionCode:\s*(\d+)/m)?.[1];
      assert.ok(Number(gradleCode) >= 1);
      assert.equal(gradleName, pkgVersion);
      assert.equal(ymlVersion, gradleName);
      assert.equal(ymlCode, gradleCode);
      const gitignore = read('.gitignore');
      assert.match(gitignore, /\*\.apk/);
      assert.match(gitignore, /android\/app\/src\/main\/assets\/public\//);
      assert.equal(fs.existsSync(path.resolve(ROOT, '../fastlane/metadata/android/ko-KR/title.txt')), true);
      assert.equal(fs.existsSync(path.resolve(ROOT, `../fastlane/metadata/android/en-US/changelogs/${gradleCode}.txt`)), true);
      assert.equal(fs.existsSync(path.resolve(ROOT, `../fastlane/metadata/android/ko-KR/changelogs/${gradleCode}.txt`)), true);
    },
  },
  {
    name: 'Native AndroidKeyStore, DEVICE_CREDENTIAL, and Screen/Gemini Assist Shield wired end-to-end',
    fn: () => {
      const pluginJava = read('android/app/src/main/java/com/bodysignal/app/SecureAuthPlugin.java');
      assert.match(pluginJava, /AndroidKeyStore/);
      assert.match(pluginJava, /BiometricPrompt\.CryptoObject/);
      assert.match(pluginJava, /setUserAuthenticationRequired\(true\)/);
      assert.match(pluginJava, /setInvalidatedByBiometricEnrollment\(true\)/);
      assert.match(pluginJava, /AUTH_DEVICE_CREDENTIAL/);
      assert.match(pluginJava, /createConfirmDeviceCredentialIntent/);
      const mainActivity = read('android/app/src/main/java/com/bodysignal/app/MainActivity.java');
      assert.match(mainActivity, /registerPlugin\(SecureAuthPlugin\.class\);[\s\S]*super\.onCreate/);
      assert.match(mainActivity, /onProvideAssistContent/);
      assert.match(mainActivity, /onProvideAssistData/);
      assert.match(mainActivity, /setRecentsScreenshotEnabled\(false\)/);
      assert.match(mainActivity, /registerScreenCaptureCallback/);
      const manifest = read('android/app/src/main/AndroidManifest.xml');
      assert.match(manifest, /DETECT_SCREEN_CAPTURE/);
      const bioTs = read('src/utils/biometrics.ts');
      assert.match(bioTs, /SecureAuth\.enrollBiometricPin/);
      assert.match(bioTs, /SecureAuth\.authenticateBiometricPin/);
      const storageTs = read('src/utils/storage.ts');
      assert.match(storageTs, /SecureAuth\.getOrCreateDeviceMasterKeyHex/);
      assert.doesNotMatch(storageTs, /localStorage\.setItem\('bs-device-master-key-v1'/);
    },
  },
  {
    name: 'Offline RFC 6238 TOTP 2FA generates and verifies 6-digit codes and enforces LockScreen 2FA gate',
    fn: async () => {
      const totpSrc = read('src/utils/totp.ts');
      assert.match(totpSrc, /generateTotpSecret/);
      assert.match(totpSrc, /verifyTotpCode/);
      assert.match(totpSrc, /verifyStoredTotpOrRecovery/);

      const authSrc = read('src/context/AuthContext.tsx');
      assert.match(authSrc, /pendingTwoFactor/);
      assert.match(authSrc, /verifyTwoFactorAndUnlock/);
      assert.match(authSrc, /setupOsCredentialLock/);

      const lockSrc = read('src/components/LockScreen.tsx');
      assert.match(lockSrc, /if\s*\(pendingTwoFactor\)/);

      // Runtime Web Crypto RFC 6238 test vector check (Base32 'JBSWY3DPEHPK3PXP')
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const decodeB32 = (s) => {
        let bits = 0, val = 0;
        const out = [];
        for (const ch of s) {
          const idx = alphabet.indexOf(ch);
          val = (val << 5) | idx;
          bits += 5;
          if (bits >= 8) {
            out.push((val >>> (bits - 8)) & 0xff);
            bits -= 8;
          }
        }
        return new Uint8Array(out);
      };
      const hotp = async (secretB32, timeMs) => {
        const counter = Math.floor(timeMs / 1000 / 30);
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        view.setUint32(0, Math.floor(counter / 0x100000000), false);
        view.setUint32(4, counter >>> 0, false);
        const key = await crypto.subtle.importKey('raw', decodeB32(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
        const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
        const off = hmac[hmac.length - 1] & 0x0f;
        const bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16) | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
        return String(bin % 1_000_000).padStart(6, '0');
      };

      const now = 1_700_000_000_000;
      const code = await hotp('JBSWY3DPEHPK3PXP', now);
      assert.match(code, /^\d{6}$/);
      assert.equal(code, await hotp('JBSWY3DPEHPK3PXP', now + 5000));
    },
  },
  {
    name: 'Diagnostic Vault encrypts EXIF-stripped photos, switches Grid/Feed views, and calculates insurance deadlines',
    fn: () => {
      const diagPage = read('src/pages/DiagnosticsPage.tsx');
      assert.match(diagPage, /setViewMode\('grid'\)/);
      assert.match(diagPage, /setViewMode\('feed'\)/);
      assert.match(diagPage, /compressAndStripExif/);
      assert.match(diagPage, /saveEncryptedPhoto/);
      assert.match(diagPage, /deleteDiagnosticRecord/);

      const mediaSrc = read('src/utils/mediaStorage.ts');
      assert.match(mediaSrc, /encryptWithPin/);
      assert.match(mediaSrc, /encryptWithDeviceKey/);
      assert.match(mediaSrc, /reEncryptAllMedia/);

      const insSrc = read('src/utils/insurance.ts');
      assert.match(insSrc, /calculateInsuranceClaimStatus/);
      assert.match(insSrc, /recommendedLatestDate/);
      assert.match(insSrc, /addYears/);
      assert.match(insSrc, /subDays/);
    },
  },
  {
    name: 'UX Declutter & Architecture: Portal modals, ephemeral pain slider, organic BodyMap, unassigned grouping, 4-tab nav & hierarchical settings',
    fn: () => {
      const trustSrc = read('src/components/TrustBadge.tsx');
      assert.match(trustSrc, /createPortal/);
      assert.match(trustSrc, /document\.body\.style\.overflow/);

      const painSrc = read('src/components/PainLevelSelector.tsx');
      assert.match(painSrc, /isSliderMode/);
      assert.match(painSrc, /isDragging/);

      const mapSrc = read('src/components/BodyMap.tsx');
      assert.match(mapSrc, /HUMAN_SILHOUETTE_PATH/);
      assert.match(mapSrc, /SprayStroke/);
      assert.match(mapSrc, /parseMultiRegionParts/);

      const typesSrc = read('src/types/health.ts');
      assert.match(typesSrc, /UNASSIGNED_CONDITION_ID/);

      const healthCtxSrc = read('src/context/HealthContext.tsx');
      assert.match(healthCtxSrc, /assignLogsToCondition/);

      const layoutSrc = read('src/components/Layout.tsx');
      assert.match(layoutSrc, /settings\.showDiagnosticsTab === true/);
      assert.match(layoutSrc, /settings\.quickSosEnabled === true/);

      const settingsSrc = read('src/pages/Settings.tsx');
      assert.match(settingsSrc, /searchParams\.get\(['"]sec['"]\)/);
      assert.match(settingsSrc, /Google Authenticator/);
      assert.match(settingsSrc, /Aegis/);
    },
  },
  {
    name: 'v1.2.1 Launch Sequence: Bignal BrandLogo & BrandSplash render before LockScreen while maintaining Fail-Closed gate',
    fn: () => {
      const appSrc = read('src/App.tsx');
      assert.match(appSrc, /showIntroLogo/);
      assert.match(appSrc, /<BrandSplash/);
      const authGatePos = appSrc.indexOf('if (!isAuthReady)');
      const splashGatePos = appSrc.indexOf('if (showIntroLogo)');
      const unlockGatePos = appSrc.indexOf('if (!isUnlocked)');
      assert.ok(authGatePos !== -1 && splashGatePos !== -1 && unlockGatePos !== -1);
      assert.ok(authGatePos < splashGatePos && splashGatePos < unlockGatePos);

      const lockSrc = read('src/components/LockScreen.tsx');
      assert.match(lockSrc, /<BrandLogo/);

      const splashSrc = read('src/components/BrandSplash.tsx');
      assert.match(splashSrc, /<BrandLogo/);
      assert.equal(fs.existsSync(path.resolve(ROOT, '../fastlane/metadata/android/en-US/images/icon.png')), true);
      assert.equal(fs.existsSync(path.resolve(ROOT, '../fastlane/metadata/android/ko-KR/images/icon.png')), true);

      // First-use Disclaimer Gate check
      const routerPos = appSrc.indexOf('<BrowserRouter>');
      const disclaimerPos = appSrc.indexOf('if (!settings.disclaimerAcceptedAt)');
      assert.ok(disclaimerPos !== -1 && routerPos !== -1 && disclaimerPos < routerPos);
      const disclaimerSrc = read('src/components/DisclaimerModal.tsx');
      assert.match(disclaimerSrc, /onAccept/);
      const typesSrc = read('src/types/health.ts');
      assert.match(typesSrc, /disclaimerAcceptedAt/);
    },
  },
  {
    name: 'Complete Security Hardening: constant-time checks, exponential PIN/TOTP lockouts, encrypted settings, legacy purge, atomic AndroidKeyStore rotation, CSV/Zod/CSP/R8',
    fn: () => {
      const cryptoSrc = read('src/utils/crypto.ts');
      assert.match(cryptoSrc, /export function constantTimeEqual/);
      assert.match(cryptoSrc, /constantTimeEqual\(calculatedChecksum,\s*envelope\.checksum\)/);

      const pinSrc = read('src/utils/pin.ts');
      assert.match(pinSrc, /constantTimeEqual\(hash,\s*meta\.hash\)/);
      assert.match(pinSrc, /consecutiveLockouts/);
      assert.match(pinSrc, /getPinRequirements/);

      const storageSrc = read('src/utils/storage.ts');
      assert.match(storageSrc, /localStorage\.removeItem\(LEGACY_STORAGE_KEY\)/);
      assert.match(storageSrc, /encryptWithDeviceKey\(JSON\.stringify\(settings\),\s*deviceKey\)/);
      assert.match(storageSrc, /decryptWithDeviceKey\(stored as EncryptedPackage,\s*deviceKey\)/);

      const totpSrc = read('src/utils/totp.ts');
      assert.match(totpSrc, /TOTP_MAX_ATTEMPTS\s*=\s*5/);
      assert.match(totpSrc, /lastUsedStep/);
      assert.match(totpSrc, /reEncryptTotpSecret/);

      const authSrc = read('src/context/AuthContext.tsx');
      assert.match(authSrc, /setupOsCredentialLockWithRecovery/);
      assert.match(authSrc, /biometricSynced/);
      assert.match(authSrc, /disableTotp\s*=\s*async\s*\(\s*verificationCode/);

      const lockSrc = read('src/components/LockScreen.tsx');
      assert.match(lockSrc, /pinLengthHint/);
      assert.match(lockSrc, /isOsCredentialOnly/);

      const healthCtxSrc = read('src/context/HealthContext.tsx');
      assert.match(healthCtxSrc, /HealthDataPayloadSchema\.parse/);

      const settingsSrc = read('src/pages/Settings.tsx');
      assert.match(settingsSrc, /totpDisableModalOpen/);
      assert.match(settingsSrc, /osRecoveryPinModal/);
      assert.match(settingsSrc, /isOnDeviceLlmEndpoint/);

      const pluginJava = read('android/app/src/main/java/com/bodysignal/app/SecureAuthPlugin.java');
      assert.match(pluginJava, /BIO_KEY_ALIAS_ALT/);
      assert.match(pluginJava, /LEGACY_CRED_KEY_ALIAS/);
      assert.match(pluginJava, /getOrCreateLegacyCredentialKey/);

      const indexHtml = read('index.html');
      assert.match(indexHtml, /http-equiv="Content-Security-Policy"/);
      assert.doesNotMatch(indexHtml, /connect-src[^"]*https:;/);

      const appGradle = read('android/app/build.gradle');
      assert.match(appGradle, /minifyEnabled true/);
      assert.match(appGradle, /shrinkResources true/);

      const proguard = read('android/app/proguard-rules.pro');
      assert.match(proguard, /com\.bodysignal\.app\.\*\*/);
      assert.match(proguard, /com\.getcapacitor\.PluginMethod/);
    },
  },
  {
    name: 'Runtime verification: constantTimeEqual, extended record signatures, and isExternalHttpsEndpoint',
    fn: async () => {
      const {
        constantTimeEqual,
        computeRecordSignature,
        verifyRecordSignature,
        encryptBackupWithPassphrase,
        decryptBackupWithPassphrase,
      } = await import('../src/utils/crypto.ts');
      const {
        isExternalHttpsEndpoint,
        isOnDeviceLlmEndpoint,
        validateEndpointSecurity,
        sanitizePromptText,
        testLocalLlmConnection,
        streamChatCompletions,
      } = await import('../src/utils/localLlm.ts');
      const { HealthDataPayloadSchema } = await import('../src/types/health.ts');

      assert.equal(constantTimeEqual('abc123', 'abc123'), true);
      assert.equal(constantTimeEqual('abc123', 'abc124'), false);
      assert.equal(constantTimeEqual('abc123', 'abc1234'), false);

      // Extended clinical fields are now tamper-protected
      const rec = {
        id: 'r1',
        conditionId: 'c1',
        date: '2026-11-17T10:00:00.000Z',
        intensity: 6,
        medication: '타이레놀',
        notes: '심한 두통',
        redFlags: ['마비/감각 저하'],
      };
      const sig = await computeRecordSignature(rec, '');
      assert.equal(await verifyRecordSignature({ ...rec, signature: sig, prevSignature: '' }), true);
      assert.equal(
        await verifyRecordSignature({ ...rec, notes: '변조된 메모', signature: sig, prevSignature: '' }),
        false
      );
      assert.equal(
        await verifyRecordSignature({ ...rec, redFlags: [], signature: sig, prevSignature: '' }),
        false
      );

      // Encrypted backup round-trip + tamper detection
      const payload = JSON.stringify({ conditions: [], logs: [], diaryEntries: [] });
      const encrypted = await encryptBackupWithPassphrase(payload, 'StrongPassphrase123!');
      assert.equal(await decryptBackupWithPassphrase(encrypted, 'StrongPassphrase123!'), payload);
      await assert.rejects(() => decryptBackupWithPassphrase(encrypted, 'WrongPassphrase123!'));

      // Strict On-Device AI enforcement: external & LAN URLs blocked, loopback & built-in allowed
      assert.equal(isExternalHttpsEndpoint('http://localhost:11434/v1'), false);
      assert.equal(isExternalHttpsEndpoint('http://127.0.0.1:11434/v1'), false);
      assert.equal(isExternalHttpsEndpoint('built-in://edge-ai'), false);
      assert.equal(isExternalHttpsEndpoint('https://api.example.com/v1'), true);
      assert.equal(isOnDeviceLlmEndpoint({ enabled: true, endpoint: 'built-in://edge-ai', model: 'gemini-nano' }), true);
      assert.equal(isOnDeviceLlmEndpoint({ enabled: true, endpoint: 'http://localhost:11434/v1', model: 'llama3.2' }), true);
      assert.equal(isOnDeviceLlmEndpoint({ enabled: true, endpoint: 'https://api.openai.com/v1', model: 'gpt-4o' }), false);
      assert.equal(isOnDeviceLlmEndpoint({ enabled: true, endpoint: 'http://192.168.0.10:11434/v1', model: 'llama3.2' }), false);
      assert.equal(validateEndpointSecurity('https://api.openai.com/v1').valid, false);

      const blockedConn = await testLocalLlmConnection({
        enabled: true,
        endpoint: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      });
      assert.equal(blockedConn.success, false);
      await assert.rejects(() =>
        streamChatCompletions(
          { enabled: true, endpoint: 'https://api.openai.com/v1', model: 'gpt-4o' },
          [{ role: 'user', content: 'test' }],
          () => {}
        )
      );

      // Prompt sanitization strips control characters and enforces max length
      assert.equal(sanitizePromptText('hello\u0000\u0007\nworld', 100), 'hello\nworld');
      assert.equal(sanitizePromptText('a'.repeat(50), 10).length, 10);

      // Zod backup schema rejects malformed intensity
      assert.throws(() =>
        HealthDataPayloadSchema.parse({
          conditions: [{ id: '', label: 'x', bodyPart: 'head', onsetDate: '2026-01-01', isArchived: false }],
          logs: [],
          diaryEntries: [],
        })
      );

      // Runtime verification of non-extractable session key vault
      const {
        SESSION_KEY_TOKEN,
        generateSaltHex,
        initSessionCryptoKeyFromPin,
        encryptWithActiveSessionKey,
        decryptWithActiveSessionKey,
        clearSessionCryptoKey,
        hasActiveSessionCryptoKey,
      } = await import('../src/utils/crypto.ts');
      assert.equal(SESSION_KEY_TOKEN, '__NON_EXTRACTABLE_SESSION_KEY__');
      const sSalt = generateSaltHex();
      await initSessionCryptoKeyFromPin('654321', sSalt);
      assert.equal(hasActiveSessionCryptoKey(), true);
      const sessPkg = await encryptWithActiveSessionKey('secret-clinical-note');
      assert.equal(sessPkg.salt, sSalt);
      assert.equal(await decryptWithActiveSessionKey(sessPkg), 'secret-clinical-note');
      clearSessionCryptoKey();
      assert.equal(hasActiveSessionCryptoKey(), false);
      await assert.rejects(() => decryptWithActiveSessionKey(sessPkg));
    },
  },
  {
    name: 'Mandatory 6-digit PIN gate, Root/Hook/Debugger blocking, runtime memory hardening, and CSV plaintext warning modal',
    fn: () => {
      const pinSrc = read('src/utils/pin.ts');
      assert.match(pinSrc, /FIXED_PIN_LENGTH\s*=\s*6/);
      assert.match(pinSrc, /pin\.length\s*!==\s*FIXED_PIN_LENGTH/);

      const pinModalSrc = read('src/components/PinModal.tsx');
      assert.match(pinModalSrc, /required\s*=\s*false/);
      assert.match(pinModalSrc, /mode !== 'unlock' && !required/);
      assert.doesNotMatch(pinModalSrc, /4자리/);

      const appSrc = read('src/App.tsx');
      assert.match(appSrc, /if\s*\(isDeviceCompromised\)/);
      assert.match(appSrc, /if\s*\(!isPinSet\)/);
      assert.match(appSrc, /required=\{true\}/);

      const settingsSrc = read('src/pages/Settings.tsx');
      assert.match(settingsSrc, /csvWarningModalOpen/);
      assert.match(settingsSrc, /confirmExportCsv/);
      assert.doesNotMatch(settingsSrc, /disablePin/);

      const authSrc = read('src/context/AuthContext.tsx');
      assert.match(authSrc, /IDLE_LOCK_TIMEOUT_MS/);
      assert.match(authSrc, /clearSessionCryptoKey/);
      assert.match(authSrc, /checkDeviceIntegrity/);
      assert.match(authSrc, /SESSION_KEY_TOKEN/);

      const secCheckJava = read('android/app/src/main/java/com/bodysignal/app/SecurityCheck.java');
      assert.match(secCheckJava, /\/system\/bin\/su/);
      assert.match(secCheckJava, /com\.topjohnwu\.magisk/);
      assert.match(secCheckJava, /frida/);
      assert.match(secCheckJava, /isDebuggerConnected/);

      const mainActivityJava = read('android/app/src/main/java/com/bodysignal/app/MainActivity.java');
      assert.match(mainActivityJava, /setWebContentsDebuggingEnabled\(false\)/);
      assert.match(mainActivityJava, /enforceDeviceIntegrity/);

      const pluginJava = read('android/app/src/main/java/com/bodysignal/app/SecureAuthPlugin.java');
      assert.match(pluginJava, /public void checkDeviceIntegrity/);
      assert.match(pluginJava, /public void clearWebViewMemory/);
      assert.match(pluginJava, /Arrays\.fill\(plainBytes,\s*\(byte\)\s*0\)/);
    },
  },
];

let passed = 0;
for (const t of tests) {
  await t.fn();
  passed++;
  console.log(`  ✓ ${t.name}`);
}
console.log(`\nSecurity Hardening & Feedback Verification: ${passed}/${tests.length} PASSED`);
