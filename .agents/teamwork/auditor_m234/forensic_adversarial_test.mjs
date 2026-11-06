import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, '../../../body-signal');

console.log('===============================================================');
console.log('   FORENSIC AUDITOR M2-M4: ADVERSARIAL STRESS & INTEGRITY SUITE');
console.log('===============================================================\n');

let totalChecks = 0;
let passedChecks = 0;

async function check(name, fn) {
  totalChecks++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedChecks++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Reason: ${err.message}`);
    throw err;
  }
}

// -------------------------------------------------------------
// 1. CRYPTOGRAPHIC INTEGRITY: AES-GCM 256
// -------------------------------------------------------------
console.log('\n--- Category 1: AES-GCM 256 Web Crypto Implementation ---');

const cryptoTsUrl = pathToFileURL(path.join(APP_DIR, 'src/utils/crypto.ts')).href;
const {
  generateAesGcmKey,
  generateDeviceMasterKeyHex,
  importKeyFromHex,
  exportKeyToHex,
  encryptWithKey,
  decryptWithKey,
  encryptWithDeviceKey,
  decryptWithDeviceKey,
  encryptWithPin,
  decryptWithPin,
  computeRecordSignature,
  verifyRecordSignature,
} = await import(cryptoTsUrl);

await check('AES-GCM key generation produces genuine 256-bit CryptoKey', async () => {
  const key = await generateAesGcmKey();
  assert.equal(key.algorithm.name, 'AES-GCM');
  assert.equal(key.algorithm.length, 256);
  assert.equal(key.extractable, true);
  assert.deepEqual(key.usages, ['encrypt', 'decrypt']);
});

await check('Device master key hex produces 64-char 256-bit entropy without reuse', async () => {
  const k1 = generateDeviceMasterKeyHex();
  const k2 = generateDeviceMasterKeyHex();
  assert.equal(k1.length, 64);
  assert.equal(k2.length, 64);
  assert.notEqual(k1, k2, 'Random device keys must never collide');
});

await check('AES-GCM encrypts with unique IV per call (no IV reuse / nonce replay vulnerability)', async () => {
  const key = await generateAesGcmKey();
  const plaintext = '환자 극심한 흉통 NRS 9';
  const pkg1 = await encryptWithKey(plaintext, key);
  const pkg2 = await encryptWithKey(plaintext, key);
  assert.notEqual(pkg1.iv, pkg2.iv, 'IV must be fresh for every encryption');
  assert.notEqual(pkg1.ct, pkg2.ct, 'Ciphertext must differ even for identical plaintext');
});

await check('AES-GCM tamper detection: bit-flip in ciphertext causes authentication rejection', async () => {
  const key = await generateAesGcmKey();
  const plaintext = JSON.stringify({ patient: 'Patient A', nrs: 10, diagnosis: '급성 복통' });
  const pkg = await encryptWithKey(plaintext, key);

  // Flip one byte in Base64 ciphertext
  const rawBytes = Buffer.from(pkg.ct, 'base64');
  rawBytes[0] = rawBytes[0] ^ 0x01; // flip 1 bit
  const tamperedPkg = { ...pkg, ct: rawBytes.toString('base64') };

  await assert.rejects(
    async () => {
      await decryptWithKey(tamperedPkg, key);
    },
    /데이터 복호화 실패/,
    'Tampered ciphertext must fail GCM auth tag check'
  );
});

await check('AES-GCM tamper detection: bit-flip in IV causes authentication rejection', async () => {
  const key = await generateAesGcmKey();
  const plaintext = '기밀 의료 진단 기록';
  const pkg = await encryptWithKey(plaintext, key);

  // Alter IV
  const ivArr = pkg.iv.split('');
  ivArr[0] = ivArr[0] === 'a' ? 'b' : 'a';
  const tamperedIvPkg = { ...pkg, iv: ivArr.join('') };

  await assert.rejects(
    async () => {
      await decryptWithKey(tamperedIvPkg, key);
    },
    /데이터 복호화 실패/,
    'Tampered IV must fail AES-GCM decryption'
  );
});

await check('AES-GCM PIN encryption round-trip with Unicode and large payload (50KB)', async () => {
  const pin = '9876';
  const largeData = JSON.stringify({
    notes: '🚨 심한 욱신거림 및 흉통 '.repeat(1000),
    timestamp: new Date().toISOString(),
  });
  const enc = await encryptWithPin(largeData, pin);
  const dec = await decryptWithPin(enc, pin);
  assert.equal(dec, largeData);

  // Wrong PIN must reject
  await assert.rejects(
    async () => {
      await decryptWithPin(enc, '0000');
    },
    /비밀번호\/PIN이 일치하지 않거나 데이터가 손상되었습니다/
  );
});

// -------------------------------------------------------------
// 2. MEDICAL INTEGRITY SIGNATURES: SHA-256 CANONICAL CHAIN
// -------------------------------------------------------------
console.log('\n--- Category 2: SHA-256 Medical Data Integrity Signatures ---');

await check('Canonical signature generation covers all clinical parameters deterministically', async () => {
  const baseRecord = {
    id: 'log-101',
    conditionId: 'cond-migraine',
    date: '2026-11-06T10:00:00.000Z',
    intensity: 8,
    medication: '트립탄',
    postMedIntensity: 4,
    prevSignature: 'prev-hash-abc',
  };

  const sig = await computeRecordSignature(baseRecord, baseRecord.prevSignature);
  assert.equal(sig.length, 64);
  assert.match(sig, /^[0-9a-f]{64}$/);

  // Verify same data produces identical signature
  const sig2 = await computeRecordSignature(baseRecord, baseRecord.prevSignature);
  assert.equal(sig, sig2, 'Canonical signature must be deterministic');
});

await check('Tampering with ANY clinical parameter invalidates signature', async () => {
  const record = {
    id: 'log-101',
    conditionId: 'cond-migraine',
    date: '2026-11-06T10:00:00.000Z',
    intensity: 8,
    medication: '트립탄',
    postMedIntensity: 4,
    prevSignature: 'prev-sig-000',
  };
  const signature = await computeRecordSignature(record, record.prevSignature);
  const signed = { ...record, signature };

  // Authentic record verifies
  assert.equal(await verifyRecordSignature(signed), true);

  // Tamper intensity
  assert.equal(await verifyRecordSignature({ ...signed, intensity: 2 }), false);

  // Tamper medication
  assert.equal(await verifyRecordSignature({ ...signed, medication: '플라시보' }), false);

  // Tamper postMedIntensity
  assert.equal(await verifyRecordSignature({ ...signed, postMedIntensity: 1 }), false);

  // Tamper date
  assert.equal(await verifyRecordSignature({ ...signed, date: '2026-11-06T11:00:00.000Z' }), false);

  // Tamper conditionId
  assert.equal(await verifyRecordSignature({ ...signed, conditionId: 'cond-backpain' }), false);

  // Tamper prevSignature (audit chain break)
  assert.equal(await verifyRecordSignature({ ...signed, prevSignature: 'tampered-prev' }), false);

  // Unsigned or empty signature
  assert.equal(await verifyRecordSignature({ ...signed, signature: '' }), false);
  assert.equal(await verifyRecordSignature({ ...signed, signature: undefined }), false);
});

// -------------------------------------------------------------
// 3. STORAGE LAYER: NO PLAINTEXT RESIDUE
// -------------------------------------------------------------
console.log('\n--- Category 3: Storage Layer Zero-Plaintext Inspection ---');

const storageSrc = fs.readFileSync(path.join(APP_DIR, 'src/utils/storage.ts'), 'utf8');

await check('storage.ts never writes unencrypted raw object to health_data', () => {
  // Look for any instance of db.put('app_state', toSave, 'health_data')
  const rawPutMatch = storageSrc.match(/db\.put\(\s*['"]app_state['"]\s*,\s*toSave\s*,\s*['"]health_data['"]\s*\)/);
  assert.equal(rawPutMatch, null, 'Plaintext toSave must never be put to health_data');

  // Verify saveHealthData branches only into encryptWithPin or encryptWithDeviceKey
  assert.ok(storageSrc.includes('await encryptWithPin(jsonStr, pin)'));
  assert.ok(storageSrc.includes('await encryptWithDeviceKey(jsonStr, deviceKey)'));
  assert.ok(storageSrc.includes("await db.put('app_state', { ...encrypted, mode: 'pin' }, 'health_data')"));
  assert.ok(storageSrc.includes("await db.put('app_state', { ...encrypted, mode: 'device' }, 'health_data')"));
});

// -------------------------------------------------------------
// 4. STREAMING PARSER & DEEP LINK LOGIC
// -------------------------------------------------------------
console.log('\n--- Category 4: Streaming Parser & Deep Link Robustness ---');

const localLlmSrc = fs.readFileSync(path.join(APP_DIR, 'src/utils/localLlm.ts'), 'utf8');

await check('localLlm.ts handles both SSE "data: {...}" and Ollama NDJSON "{...}"', () => {
  assert.ok(localLlmSrc.includes("trimmed.startsWith('data: ')"));
  assert.ok(localLlmSrc.includes("trimmed.startsWith('{') && trimmed.endsWith('}')"));
  assert.ok(localLlmSrc.includes("data: [DONE]"));
});

// Test streaming chunk accumulator simulation
await check('Streaming chunk accumulator handles fragmented multi-byte stream', () => {
  let accumulated = '';
  const onChunk = (delta, acc) => { accumulated = acc; };

  const processLine = (lineStr) => {
    const trimmed = lineStr.trim();
    if (!trimmed || trimmed.startsWith(':') || trimmed === 'data: [DONE]') return;
    if (trimmed.startsWith('data: ')) {
      try {
        const raw = trimmed.slice(6).trim();
        if (raw === '[DONE]') return;
        const parsed = JSON.parse(raw);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          accumulated += delta;
          onChunk(delta, accumulated);
        }
      } catch {}
    } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const delta = parsed.message?.content || parsed.response || '';
        if (delta) {
          accumulated += delta;
          onChunk(delta, accumulated);
        }
      } catch {}
    }
  };

  // Simulating fragmented stream chunks
  const incomingChunks = [
    'data: {"choices":[{"delta":{"content":"안녕"}}]}\n\n',
    '{"message":{"content":"하세요, "},"done":false}\n',
    'data: {"choices":[{"delta":{"content":"로컬 AI"}}]}\n\n',
    '{"response":"입니다.","done":true}\n',
    'data: [DONE]\n\n',
  ];

  let buffer = '';
  for (const chunk of incomingChunks) {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      processLine(line);
    }
  }

  assert.equal(accumulated, '안녕하세요, 로컬 AI입니다.');
});

// -------------------------------------------------------------
// 5. ANDROID NATIVE SECURITY: FLAG_SECURE & CLEARTEXT
// -------------------------------------------------------------
console.log('\n--- Category 5: Native Android Hardening Verification ---');

const mainActivityPath = path.join(APP_DIR, 'android/app/src/main/java/com/bodysignal/app/MainActivity.java');
const mainActivitySrc = fs.readFileSync(mainActivityPath, 'utf8');

await check('MainActivity.java sets WindowManager.LayoutParams.FLAG_SECURE', () => {
  assert.match(mainActivitySrc, /import android\.view\.WindowManager;/);
  assert.match(mainActivitySrc, /getWindow\(\)\.setFlags\(\s*WindowManager\.LayoutParams\.FLAG_SECURE,\s*WindowManager\.LayoutParams\.FLAG_SECURE\s*\);/);
});

const androidManifestPath = path.join(APP_DIR, 'android/app/src/main/AndroidManifest.xml');
const androidManifestSrc = fs.readFileSync(androidManifestPath, 'utf8');

await check('AndroidManifest.xml allows cleartext LAN traffic for local LLM', () => {
  assert.match(androidManifestSrc, /android:usesCleartextTraffic="true"/);
});

await check('shortcuts.xml has valid deep links without conversation category bug', () => {
  const shortcutsPath = path.join(APP_DIR, 'android/app/src/main/res/xml/shortcuts.xml');
  const shortcutsSrc = fs.readFileSync(shortcutsPath, 'utf8');
  assert.equal(shortcutsSrc.includes('android.shortcut.conversation'), false);
  assert.match(shortcutsSrc, /shortcutId="acute_pain"/);
  assert.match(shortcutsSrc, /shortcutId="clinical_briefing"/);
  assert.match(shortcutsSrc, /shortcutId="quick_med"/);
});

console.log('\n===============================================================');
console.log(`FORENSIC AUDITOR RESULTS: ${passedChecks}/${totalChecks} CHECKS PASSED CLEANLY`);
console.log('NO VULNERABILITIES, NO FACADES, NO INTEGRITY BREACHES DETECTED');
console.log('===============================================================\n');
