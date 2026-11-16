import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');
const ANDROID_DIR = path.resolve(__dirname, '../android');

console.log('--- Starting Milestone 3 On-Device Security & Integrity Tests ---');

// 1. Test MainActivity.java FLAG_SECURE
const mainActivityPath = path.join(ANDROID_DIR, 'app/src/main/java/com/bodysignal/app/MainActivity.java');
const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf8');
assert.ok(
  mainActivityContent.includes('WindowManager.LayoutParams.FLAG_SECURE'),
  'MainActivity.java must set WindowManager.LayoutParams.FLAG_SECURE'
);
assert.ok(
  mainActivityContent.includes('super.onCreate(savedInstanceState)'),
  'MainActivity.java must call super.onCreate'
);
console.log('✓ MainActivity.java sets FLAG_SECURE on window in onCreate()');

// 2. Test AuthContext.tsx privacy curtain & re-encryption
const authContextPath = path.join(SRC_DIR, 'context/AuthContext.tsx');
const authContextContent = fs.readFileSync(authContextPath, 'utf8');
assert.ok(
  authContextContent.includes('isPrivacyMasked && isPinSet && ('),
  'AuthContext.tsx must mask screen when isPrivacyMasked && isPinSet without !isUnlocked barrier'
);
assert.ok(
  !authContextContent.includes('isPrivacyMasked && isPinSet && !isUnlocked'),
  'AuthContext.tsx must not block privacy curtain with !isUnlocked'
);
assert.ok(
  authContextContent.includes('reEncryptHealthData(pin'),
  'setupNewPin must re-encrypt health data with the new PIN'
);
assert.ok(
  authContextContent.includes('reEncryptHealthData(undefined'),
  'disablePin must re-encrypt health data with transparent device key'
);
console.log('✓ AuthContext.tsx immediate background privacy curtain and PIN re-encryption verified');

// 3. Test crypto module device key operations and signatures
const {
  generateDeviceMasterKeyHex,
  importKeyFromHex,
  exportKeyToHex,
  generateAesGcmKey,
  encryptWithKey,
  decryptWithKey,
  encryptWithDeviceKey,
  decryptWithDeviceKey,
  computeRecordSignature,
  verifyRecordSignature,
} = await import('../src/utils/crypto.ts');

// Test 3.1: Device key generation & hex serialization
const hexKey = generateDeviceMasterKeyHex();
assert.equal(hexKey.length, 64, '256-bit key must be 64 hex characters');
assert.match(hexKey, /^[0-9a-f]{64}$/, 'Hex key must be lowercase hex');

const importedKey = await importKeyFromHex(hexKey);
assert.equal(importedKey.algorithm.name, 'AES-GCM');

const exportedHex = await exportKeyToHex(importedKey);
assert.equal(exportedHex, hexKey, 'Exported hex key must match imported hex key');
console.log('✓ Device master key generate / export / import round-trip verified');

// Test 3.2: Direct key encryption & decryption round-trip
const secretData = JSON.stringify({ patient: 'Patient A', nrs: 9, condition: '편두통' });
const encPkg = await encryptWithDeviceKey(secretData, importedKey);
assert.equal(encPkg.v, 1);
assert.equal(encPkg.mode, 'device');
assert.ok(encPkg.salt && encPkg.iv && encPkg.ct);

const decryptedData = await decryptWithDeviceKey(encPkg, importedKey);
assert.equal(decryptedData, secretData, 'Decrypted data must match original secret');

// Test 3.3: Decryption failure with wrong key
const wrongKeyHex = generateDeviceMasterKeyHex();
const wrongKey = await importKeyFromHex(wrongKeyHex);
await assert.rejects(
  async () => {
    await decryptWithDeviceKey(encPkg, wrongKey);
  },
  /데이터 복호화 실패/,
  'Decryption with wrong key must reject with authentication error'
);
console.log('✓ AES-GCM 256 device key encryption and tamper/wrong-key rejection verified');

// Test 3.4: Per-record SHA-256 signature generation and chaining
const log1 = {
  id: 'log-001',
  conditionId: 'cond-lumbar',
  date: '2026-11-06T12:00:00.000Z',
  intensity: 8,
  medication: '소염진통제',
};
const sig1 = await computeRecordSignature(log1, '');
assert.match(sig1, /^[0-9a-f]{64}$/, 'Signature must be 64-char hex SHA-256');

const signedLog1 = { ...log1, signature: sig1, prevSignature: '' };
const isLog1Valid = await verifyRecordSignature(signedLog1);
assert.equal(isLog1Valid, true, 'Genuine log signature must verify successfully');

// Test 3.5: Tamper detection (intensity modified from 8 to 3)
const tamperedLog1 = { ...signedLog1, intensity: 3 };
const isTamperedValid = await verifyRecordSignature(tamperedLog1);
assert.equal(isTamperedValid, false, 'Tampered intensity must fail verification');

// Test 3.6: Tamper detection (medication modified)
const medTamperedLog = { ...signedLog1, medication: '가짜약' };
assert.equal(await verifyRecordSignature(medTamperedLog), false, 'Tampered medication must fail verification');

// Test 3.7: Chained record signature verification
const log2 = {
  id: 'log-002',
  conditionId: 'cond-lumbar',
  date: '2026-11-06T13:00:00.000Z',
  intensity: 4,
  medication: '',
  postMedIntensity: 3,
  prevSignature: sig1,
};
const sig2 = await computeRecordSignature(log2, sig1);
const signedLog2 = { ...log2, signature: sig2 };

assert.equal(await verifyRecordSignature(signedLog2), true, 'Chained log signature must verify successfully');
assert.notEqual(sig1, sig2, 'Chained signature must differ from genesis signature');

// Test 3.8: Tampered previous signature breaks chain
const brokenChainLog = { ...signedLog2, prevSignature: 'tampered-hash-000' };
assert.equal(await verifyRecordSignature(brokenChainLog), false, 'Broken audit chain must fail verification');

// Test 3.9: Missing signature returns false
const unsignedLog = { ...log1 };
assert.equal(await verifyRecordSignature(unsignedLog), false, 'Unsigned log must return false');

console.log('✓ SHA-256 canonical audit signature generation, tamper detection, and chaining verified');

// 4. Test HealthContext.tsx automatic signature generation
const healthContextPath = path.join(SRC_DIR, 'context/HealthContext.tsx');
const healthContextContent = fs.readFileSync(healthContextPath, 'utf8');
assert.ok(
  healthContextContent.includes('computeRecordSignature(newLog'),
  'HealthContext.tsx must compute signature on saveEntry'
);
assert.ok(
  healthContextContent.includes('computeRecordSignature(updatedLog'),
  'HealthContext.tsx must compute signature on updateLog'
);
assert.ok(
  healthContextContent.includes('verifyLogIntegrity: verifyRecordSignature'),
  'HealthContext.tsx must expose verifyLogIntegrity'
);
console.log('✓ HealthContext.tsx integration verified');

// 5. Test storage.ts AES-GCM encryption at rest
const storagePath = path.join(SRC_DIR, 'utils/storage.ts');
const storageContent = fs.readFileSync(storagePath, 'utf8');
assert.ok(
  storageContent.includes('encryptWithDeviceKey'),
  'storage.ts must encrypt with device key when no PIN is supplied'
);
assert.ok(
  storageContent.includes('encryptWithPin'),
  'storage.ts must encrypt with PIN when PIN is supplied'
);
assert.ok(
  !storageContent.includes("await db.put('app_state', toSave, 'health_data')"),
  'storage.ts must NEVER write raw unencrypted plaintext to persistent storage'
);
console.log('✓ storage.ts AES-GCM 256 encryption at rest verified (no plaintext writes)');

console.log('\n--- ALL Milestone 3 Tests Passed Cleanly! ---');
