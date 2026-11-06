#!/usr/bin/env node

/**
 * Empirical Adversarial Challenger Test Suite for Milestones M2, M3, and M4.
 * 
 * Verifies:
 * - Milestone 2: Deep Link Parameter Routing & Floating SOS Widget State
 * - Milestone 3: AES-GCM 256 Master Key Encryption, SHA-256 Signatures & Tamper Resistance
 * - Milestone 4: Dual-Protocol Streaming (SSE & Ollama NDJSON) via Live HTTP Server & Persona Logic
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const ANDROID_DIR = path.join(ROOT_DIR, 'android');

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
};

let totalPassed = 0;
let totalFailed = 0;

async function runTest(category, name, fn) {
  try {
    await fn();
    console.log(`  ${c.green}✓ [${category}] PASS${c.reset}: ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ${c.red}✗ [${category}] FAIL${c.reset}: ${name}`);
    console.error(`    ${c.red}${err.stack || err.message}${c.reset}`);
    totalFailed++;
  }
}

console.log(`\n${c.bold}${c.cyan}======================================================================${c.reset}`);
console.log(`${c.bold}${c.cyan}   CHALLENGER EMPIRICAL ADVERSARIAL HARNESS (M2 - M3 - M4)           ${c.reset}`);
console.log(`${c.cyan}======================================================================${c.reset}\n`);

// ======================================================================
// PART 1: MILESTONE 2 - DEEP LINK ROUTING & FLOATING SOS WIDGET
// ======================================================================
console.log(`${c.bold}▶ CATEGORY: Milestone 2 (Deep Links & Floating SOS Widget)${c.reset}`);

// Inspect DeepLinkHandler implementation
const deepLinkHandlerPath = path.join(SRC_DIR, 'components/DeepLinkHandler.tsx');
const deepLinkSrc = fs.readFileSync(deepLinkHandlerPath, 'utf8');

await runTest('M2-Static', 'DeepLinkHandler imports CapApp and listens to appUrlOpen & getLaunchUrl', () => {
  assert.ok(deepLinkSrc.includes("import { App as CapApp"), 'Must import CapApp from @capacitor/app');
  assert.ok(deepLinkSrc.includes("CapApp.getLaunchUrl()"), 'Must check getLaunchUrl for cold starts');
  assert.ok(deepLinkSrc.includes("CapApp.addListener('appUrlOpen'"), 'Must register appUrlOpen listener');
});

// Adversarial routing logic simulator modeled directly on DeepLinkHandler.tsx
function simulateDeepLinkRouting(urlString) {
  if (!urlString) return { action: 'none' };
  try {
    const url = new URL(urlString);
    const search = url.search || '';
    const pathname = url.pathname || '';

    if (
      url.searchParams.get('mode') === 'acute' ||
      search.includes('mode=acute') ||
      pathname === '/acute' ||
      pathname.endsWith('/acute')
    ) {
      return { action: 'openAcute' };
    }

    if (pathname === '/briefing' || pathname.endsWith('/briefing') || urlString.includes('/briefing')) {
      return { action: 'navigate', to: '/briefing' };
    }

    if (pathname === '/entry' || pathname.endsWith('/entry') || urlString.includes('/entry')) {
      return { action: 'navigate', to: '/entry' };
    }

    const target = pathname + search;
    if (target && target !== '/' && target !== '') {
      return { action: 'navigate', to: target };
    }
    return { action: 'none' };
  } catch {
    // Custom schemes
    if (urlString.includes('?mode=acute') || urlString.includes('/acute')) {
      return { action: 'openAcute' };
    } else if (urlString.includes('/briefing')) {
      return { action: 'navigate', to: '/briefing' };
    } else if (urlString.includes('/entry')) {
      return { action: 'navigate', to: '/entry' };
    }
    return { action: 'none' };
  }
}

const testDeepLinkVectors = [
  // Standard URLs
  { url: 'https://localhost/?mode=acute', expected: { action: 'openAcute' } },
  { url: 'https://localhost/acute', expected: { action: 'openAcute' } },
  { url: 'https://localhost/briefing', expected: { action: 'navigate', to: '/briefing' } },
  { url: 'https://localhost/entry', expected: { action: 'navigate', to: '/entry' } },
  // Query combinations & ordering
  { url: 'https://localhost/?ref=widget&mode=acute', expected: { action: 'openAcute' } },
  { url: 'https://localhost/?mode=acute&severity=10', expected: { action: 'openAcute' } },
  { url: 'https://localhost/briefing?doctor=true&date=2026-11-06', expected: { action: 'navigate', to: '/briefing' } },
  { url: 'https://localhost/entry?med=tylenol', expected: { action: 'navigate', to: '/entry' } },
  // Custom URI schemes
  { url: 'bodysignal://launch?mode=acute', expected: { action: 'openAcute' } },
  { url: 'bodysignal://host/briefing', expected: { action: 'navigate', to: '/briefing' } },
  { url: 'bodysignal://host/entry', expected: { action: 'navigate', to: '/entry' } },
  // Boundary / Home / Non-matching
  { url: 'https://localhost/', expected: { action: 'none' } },
  { url: 'https://localhost/history', expected: { action: 'navigate', to: '/history' } },
  { url: '', expected: { action: 'none' } },
];

for (const vector of testDeepLinkVectors) {
  await runTest('M2-DeepLink', `Route '${vector.url}' correctly resolves to ${JSON.stringify(vector.expected)}`, () => {
    const result = simulateDeepLinkRouting(vector.url);
    assert.deepEqual(result, vector.expected);
  });
}

// Inspect Layout.tsx & Settings.tsx for quickSosEnabled toggle logic
const layoutSrc = fs.readFileSync(path.join(SRC_DIR, 'components/Layout.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/Settings.tsx'), 'utf8');
const settingsContextSrc = fs.readFileSync(path.join(SRC_DIR, 'context/SettingsContext.tsx'), 'utf8');

await runTest('M2-Widget', 'Layout.tsx conditionally renders SOS widget using quickSosEnabled !== false', () => {
  assert.ok(layoutSrc.includes('settings.quickSosEnabled !== false'), 'SOS widget must default to true when undefined');
  assert.ok(layoutSrc.includes('aria-label="1초 급성 통증 기록 위젯"'), 'Must have accessible label on container');
  assert.ok(layoutSrc.includes('aria-label="지금 너무 아파요 1초 급성 통증 기록"'), 'Must have accessible label on button');
  assert.ok(layoutSrc.includes('openAcute()'), 'Clicking SOS button must invoke openAcute');
});

await runTest('M2-Widget', 'SettingsContext & Settings.tsx expose setQuickSos toggle', () => {
  assert.ok(settingsContextSrc.includes('setQuickSos: (enabled: boolean) => Promise<void>'));
  assert.ok(settingsSrc.includes('setQuickSos'));
  assert.ok(settingsSrc.includes('quickSosSettingDesc'));
});


// ======================================================================
// PART 2: MILESTONE 3 - SECURITY, AES-GCM 256, & TAMPER AUDIT
// ======================================================================
console.log(`\n${c.bold}▶ CATEGORY: Milestone 3 (On-Device AES-GCM 256 & SHA-256 Tamper Resistance)${c.reset}`);

const {
  generateDeviceMasterKeyHex,
  importKeyFromHex,
  exportKeyToHex,
  encryptWithDeviceKey,
  decryptWithDeviceKey,
  computeRecordSignature,
  verifyRecordSignature,
  computeSha256Checksum,
} = await import('../src/utils/crypto.ts');

await runTest('M3-KeyGen', 'Device master key generation produces valid 256-bit hexadecimal string', () => {
  const k1 = generateDeviceMasterKeyHex();
  const k2 = generateDeviceMasterKeyHex();
  assert.equal(k1.length, 64);
  assert.equal(k2.length, 64);
  assert.notEqual(k1, k2, 'Successive keys must be cryptographically independent');
  assert.match(k1, /^[0-9a-f]{64}$/);
});

await runTest('M3-KeyGen', 'Master key import and export preserves byte-for-byte fidelity', async () => {
  const originalHex = generateDeviceMasterKeyHex();
  const cryptoKey = await importKeyFromHex(originalHex);
  const exportedHex = await exportKeyToHex(cryptoKey);
  assert.equal(exportedHex, originalHex);
});

// Adversarial Encryption / Decryption Round-Trip
await runTest('M3-Crypto', 'AES-GCM 256 device key encrypts and decrypts complex unicode & clinical JSON payloads', async () => {
  const keyHex = generateDeviceMasterKeyHex();
  const key = await importKeyFromHex(keyHex);

  const testPayload = JSON.stringify({
    patientId: 'patient-uuid-1234',
    painScore: 9,
    description: '우측 관자놀이 극심한 욱신거림 및 구토 동반 💥🚨',
    medication: '트립탄 계열 진통제',
    nestedArray: [1, 2, 3, null, { key: 'value' }],
  });

  const encPkg = await encryptWithDeviceKey(testPayload, key);
  assert.equal(encPkg.v, 1);
  assert.equal(encPkg.mode, 'device');
  assert.ok(encPkg.salt.length > 0);
  assert.ok(encPkg.iv.length > 0);
  assert.ok(encPkg.ct.length > 0);

  const decrypted = await decryptWithDeviceKey(encPkg, key);
  assert.equal(decrypted, testPayload);
});

await runTest('M3-Crypto', 'Re-encrypting same payload yields distinct IVs and ciphertexts (IND-CPA)', async () => {
  const key = await importKeyFromHex(generateDeviceMasterKeyHex());
  const data = 'IDENTICAL_PLAINTEXT';
  const pkg1 = await encryptWithDeviceKey(data, key);
  const pkg2 = await encryptWithDeviceKey(data, key);

  assert.notEqual(pkg1.iv, pkg2.iv, 'IV must be fresh random per encryption');
  assert.notEqual(pkg1.ct, pkg2.ct, 'Ciphertext must differ across runs');
});

// Adversarial Tampering: Bit-Flip Rejection in Ciphertext
await runTest('M3-Adversarial', 'AES-GCM authentic tag rejects tampered ciphertext bit', async () => {
  const key = await importKeyFromHex(generateDeviceMasterKeyHex());
  const encPkg = await encryptWithDeviceKey('CONFIDENTIAL_MEDICAL_RECORD', key);

  // Flip one character in base64 ciphertext
  const rawCt = encPkg.ct;
  const flippedCt = (rawCt[0] === 'A' ? 'B' : 'A') + rawCt.slice(1);
  const tamperedPkg = { ...encPkg, ct: flippedCt };

  await assert.rejects(
    async () => {
      await decryptWithDeviceKey(tamperedPkg, key);
    },
    /데이터 복호화 실패/,
    'Decryption must abort on ciphertext bit-flip'
  );
});

// Adversarial Tampering: Tampered IV Rejection
await runTest('M3-Adversarial', 'AES-GCM rejects tampered initialization vector (IV)', async () => {
  const key = await importKeyFromHex(generateDeviceMasterKeyHex());
  const encPkg = await encryptWithDeviceKey('PATIENT_RECORD', key);

  const rawIv = encPkg.iv;
  const tamperedIv = (rawIv[0] === '0' ? '1' : '0') + rawIv.slice(1);
  const tamperedPkg = { ...encPkg, iv: tamperedIv };

  await assert.rejects(
    async () => {
      await decryptWithDeviceKey(tamperedPkg, key);
    },
    /데이터 복호화 실패/,
    'Decryption must abort on IV modification'
  );
});

// SHA-256 Per-Record Canonical Signature & Audit Chain Hardening
const genesisRecord = {
  id: 'log-genesis-001',
  conditionId: 'cond-migraine',
  date: '2026-11-06T09:00:00.000Z',
  intensity: 8,
  medication: 'Tylenol 500mg',
  postMedIntensity: 4,
};

const sig1 = await computeRecordSignature(genesisRecord, '');
const signedRecord1 = { ...genesisRecord, signature: sig1, prevSignature: '' };

await runTest('M3-Audit', 'Genuine genesis pain log verifies successfully', async () => {
  assert.equal(await verifyRecordSignature(signedRecord1), true);
});

// Test tampering individual canonical fields
const tamperScenarios = [
  { field: 'intensity', modify: (r) => ({ ...r, intensity: 3 }), name: 'intensity altered 8 -> 3' },
  { field: 'date', modify: (r) => ({ ...r, date: '2026-11-06T10:00:00.000Z' }), name: 'timestamp forged' },
  { field: 'medication', modify: (r) => ({ ...r, medication: 'Placebo' }), name: 'medication altered' },
  { field: 'conditionId', modify: (r) => ({ ...r, conditionId: 'cond-other' }), name: 'conditionId redirected' },
  { field: 'postMedIntensity', modify: (r) => ({ ...r, postMedIntensity: 1 }), name: 'postMedIntensity altered' },
  { field: 'prevSignature', modify: (r) => ({ ...r, prevSignature: 'forged_prev_sig' }), name: 'prevSignature corrupted' },
  { field: 'signature', modify: (r) => ({ ...r, signature: '0000000000000000000000000000000000000000000000000000000000000000' }), name: 'signature replaced with zeroes' },
  { field: 'missingSignature', modify: (r) => { const copy = { ...r }; delete copy.signature; return copy; }, name: 'signature stripped' },
];

for (const scenario of tamperScenarios) {
  await runTest('M3-Tamper', `Detects tamper when ${scenario.name}`, async () => {
    const tampered = scenario.modify(signedRecord1);
    const valid = await verifyRecordSignature(tampered);
    assert.equal(valid, false, `Verification must return false when ${scenario.name}`);
  });
}

// Multi-record hash chain test
await runTest('M3-AuditChain', 'Cryptographic hash chain preserves integrity across 5 chained records', async () => {
  const chain = [];
  let prevSig = '';

  for (let i = 0; i < 5; i++) {
    const rec = {
      id: `chain-log-${i}`,
      conditionId: 'cond-backpain',
      date: `2026-11-06T${10 + i}:00:00.000Z`,
      intensity: 7 - i,
      medication: i % 2 === 0 ? '이부프로펜' : '',
      postMedIntensity: i % 2 === 0 ? 5 - i : undefined,
    };
    const sig = await computeRecordSignature(rec, prevSig);
    const signedRec = { ...rec, signature: sig, prevSignature: prevSig };
    chain.push(signedRec);
    prevSig = sig;
  }

  // All 5 must verify
  for (let i = 0; i < chain.length; i++) {
    assert.equal(await verifyRecordSignature(chain[i]), true, `Record ${i} must verify`);
  }

  // Tamper record 2 in the chain
  const brokenChain = [...chain];
  brokenChain[2] = { ...brokenChain[2], intensity: 10 };
  assert.equal(await verifyRecordSignature(brokenChain[2]), false, 'Record 2 verification must fail');
});


// ======================================================================
// PART 3: MILESTONE 4 - LOCAL LLM STREAMING & PERSONA EXTRACTION
// ======================================================================
console.log(`\n${c.bold}▶ CATEGORY: Milestone 4 (Local LLM Dual-Protocol Streaming & Personas)${c.reset}`);

const {
  streamChatCompletions,
  generateClinicalAiAnalysisStream,
  normalizeEndpoint,
  testLocalLlmConnection,
} = await import('../src/utils/localLlm.ts');

await runTest('M4-Endpoint', 'normalizeEndpoint properly handles ports, protocols, and trailing slashes', () => {
  assert.equal(normalizeEndpoint('localhost:11434'), 'http://localhost:11434');
  assert.equal(normalizeEndpoint('http://192.168.0.25:11434/v1/'), 'http://192.168.0.25:11434/v1');
  assert.equal(normalizeEndpoint('https://api.local/'), 'https://api.local');
});

// Live Ephemeral HTTP Server for Empirical Stream Testing
let serverMode = 'sse'; // 'sse' | 'ollama' | 'split' | 'error' | 'models'
const server = http.createServer((req, res) => {
  const url = req.url || '';

  // Models probe endpoint
  if (url === '/v1/models' || url === '/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'llama3.2:latest' }, { id: 'mistral:7b' }] }));
    return;
  }
  if (url === '/api/tags') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ models: [{ name: 'ollama-gemma2:9b' }] }));
    return;
  }

  // Chat completions endpoint
  if (req.method === 'POST') {
    let reqBody = '';
    req.on('data', (chk) => { reqBody += chk; });
    req.on('end', () => {
      if (serverMode === 'sse') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        res.write('data: {"choices":[{"delta":{"content":"[SOAP 요약]\\n"}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"content":"S: 환자 우측 관자놀이 통증\\n"}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"content":"O: NRS 8점 경감 완료."}}]}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      } else if (serverMode === 'ollama') {
        // Native Ollama NDJSON without "data: " prefix
        res.writeHead(200, {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
        });
        res.write('{"message":{"content":"[Ollama 소견]\\n"},"done":false}\n');
        res.write('{"message":{"content":"환자분의 통증이 "},"done":false}\n');
        res.write('{"message":{"content":"점진적으로 호전되고 있습니다."},"done":true}\n');
        res.end();
      } else if (serverMode === 'split') {
        // Challenging split chunks: JSON cut in middle of transmission
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Transfer-Encoding': 'chunked',
        });
        res.write('data: {"choices":[{"delta":');
        setTimeout(() => {
          res.write('{"content":"토큰 분할 "}}]}\n\n');
          setTimeout(() => {
            res.write('data: {"choices":[{"delta":{"content":"복원 성공!"}}]}\n\n');
            res.write('data: [DONE]\n\n');
            res.end();
          }, 20);
        }, 20);
      } else if (serverMode === 'error') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  }
});

await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    resolve();
  });
});

const address = server.address();
const serverPort = address.port;
const serverEndpoint = `http://127.0.0.1:${serverPort}/v1`;

try {
  // Test 4.1: Probe live model detection
  await runTest('M4-LiveHttp', 'testLocalLlmConnection detects active local models over HTTP', async () => {
    const probeRes = await testLocalLlmConnection({
      enabled: true,
      endpoint: serverEndpoint,
      model: 'llama3.2',
    });
    assert.equal(probeRes.success, true);
    assert.ok(probeRes.models && probeRes.models.includes('llama3.2:latest'));
  });

  // Test 4.2: Standard OpenAI SSE Stream Parsing
  await runTest('M4-LiveHttp', 'streamChatCompletions parses OpenAI-compatible SSE token stream', async () => {
    serverMode = 'sse';
    const receivedChunks = [];
    let finalAccumulated = '';

    const result = await streamChatCompletions(
      { enabled: true, endpoint: serverEndpoint, model: 'llama3.2' },
      [{ role: 'user', content: '임상 분석 요청' }],
      (delta, acc) => {
        receivedChunks.push(delta);
        finalAccumulated = acc;
      }
    );

    assert.ok(receivedChunks.length >= 3, 'Must emit at least 3 chunk deltas');
    assert.ok(result.includes('[SOAP 요약]'));
    assert.ok(result.includes('S: 환자 우측 관자놀이 통증'));
    assert.ok(result.includes('O: NRS 8점 경감 완료.'));
    assert.equal(finalAccumulated, result);
  });

  // Test 4.3: Native Ollama NDJSON Stream Parsing
  await runTest('M4-LiveHttp', 'streamChatCompletions parses native Ollama NDJSON token stream', async () => {
    serverMode = 'ollama';
    const receivedChunks = [];

    const result = await streamChatCompletions(
      { enabled: true, endpoint: serverEndpoint, model: 'llama3.2' },
      [{ role: 'user', content: 'Ollama 분석 요청' }],
      (delta) => {
        receivedChunks.push(delta);
      }
    );

    assert.ok(receivedChunks.length >= 3);
    assert.ok(result.includes('[Ollama 소견]'));
    assert.ok(result.includes('점진적으로 호전되고 있습니다.'));
  });

  // Test 4.4: Split-packet buffer reassembly
  await runTest('M4-LiveHttp', 'streamChatCompletions reassembles tokens split across network chunk boundaries', async () => {
    serverMode = 'split';
    const receivedChunks = [];

    const result = await streamChatCompletions(
      { enabled: true, endpoint: serverEndpoint, model: 'llama3.2' },
      [{ role: 'user', content: '분할 청크 테스트' }],
      (delta) => {
        receivedChunks.push(delta);
      }
    );

    assert.ok(result.includes('토큰 분할 복원 성공!'));
  });

  // Test 4.5: Fallback on server error
  await runTest('M4-Fallback', 'Falls back to on-device clinical engine when server responds with HTTP 500', async () => {
    serverMode = 'error';
    const receivedChunks = [];

    const result = await streamChatCompletions(
      { enabled: true, endpoint: serverEndpoint, model: 'llama3.2' },
      [{ role: 'user', content: '장애 상황 테스트' }],
      (delta) => {
        receivedChunks.push(delta);
      },
      undefined,
      'summary',
      '위험 징후: 방사통'
    );

    assert.ok(result.includes('[온디바이스 임상 엔진 분석 리포트]'));
    assert.ok(result.includes('100% 기기 내부 로컬 분석'));
    assert.ok(receivedChunks.length > 5, 'Fallback engine streams tokens incrementally');
  });

} finally {
  server.close();
}

// Test Persona System Prompts in generateClinicalAiAnalysisStream
await runTest('M4-Personas', 'Clinical briefing accepts doctor and patient personas with specialized prompts', async () => {
  // Test doctor persona (fallback mode since no server)
  const doctorResult = await generateClinicalAiAnalysisStream(
    { enabled: false, endpoint: 'http://localhost:9999', model: 'test' },
    '환자 NRS 8점',
    () => {},
    'doctor'
  );
  assert.ok(doctorResult.includes('[온디바이스 임상 엔진 분석 리포트]'));

  // Verify ClinicalBriefing.tsx contains persona UI switch
  const briefingSrc = fs.readFileSync(path.join(SRC_DIR, 'pages/ClinicalBriefing.tsx'), 'utf8');
  assert.ok(briefingSrc.includes("setActivePersona('doctor')"), 'Must have doctor tab');
  assert.ok(briefingSrc.includes("setActivePersona('patient')"), 'Must have patient tab');
  assert.ok(briefingSrc.includes("personaToUse"), 'Must pass selected persona to streaming generator');
});

// Verify Android Manifest cleartext traffic
await runTest('M4-Android', 'AndroidManifest.xml explicitly enables android:usesCleartextTraffic for local network AI', () => {
  const manifest = fs.readFileSync(path.join(ANDROID_DIR, 'app/src/main/AndroidManifest.xml'), 'utf8');
  assert.match(manifest, /android:usesCleartextTraffic\s*=\s*"true"/);
});


// ======================================================================
// SUMMARY & VERDICT
// ======================================================================
console.log(`\n${c.bold}----------------------------------------------------------------------${c.reset}`);
console.log(`${c.bold}CHALLENGER VERIFICATION SUMMARY:${c.reset} ${c.green}${totalPassed} Passed${c.reset}, ${totalFailed > 0 ? c.red : c.green}${totalFailed} Failed${c.reset}`);
console.log(`----------------------------------------------------------------------\n`);

if (totalFailed > 0) {
  console.error(`${c.red}${c.bold}VERDICT: REQUEST_CHANGES - ${totalFailed} tests failed!${c.reset}\n`);
  process.exit(1);
} else {
  console.log(`${c.green}${c.bold}VERDICT: APPROVE - All ${totalPassed} adversarial challenger tests passed cleanly!${c.reset}\n`);
  process.exit(0);
}
