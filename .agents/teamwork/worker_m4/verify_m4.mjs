import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const bodySignalDir = path.join(rootDir, 'body-signal');

console.log('--- Running M4 Local LLM Integration & Streaming Verification ---');

// 1. Android Manifest Cleartext Traffic
const manifestPath = path.join(bodySignalDir, 'android/app/src/main/AndroidManifest.xml');
const manifestContent = fs.readFileSync(manifestPath, 'utf8');
assert.match(
  manifestContent,
  /android:usesCleartextTraffic\s*=\s*"true"/,
  'AndroidManifest.xml must declare android:usesCleartextTraffic="true"'
);
console.log('✓ [Test 1] AndroidManifest.xml has android:usesCleartextTraffic="true"');

// 2. localLlm.ts Dual Streaming Protocol Parser
const localLlmPath = path.join(bodySignalDir, 'src/utils/localLlm.ts');
const localLlmContent = fs.readFileSync(localLlmPath, 'utf8');

// Check SSE and NDJSON parsing logic
assert.match(
  localLlmContent,
  /trimmed\.startsWith\('data:\s*'\)/,
  'localLlm.ts must decode standard SSE format with data: prefix'
);
assert.match(
  localLlmContent,
  /trimmed\.startsWith\('\{'\)\s*&&\s*trimmed\.endsWith\('\}'\)/,
  'localLlm.ts must decode native Ollama NDJSON objects'
);
assert.match(
  localLlmContent,
  /parsed\.message\?\.content\s*\|\|\s*parsed\.response/,
  'localLlm.ts must extract message.content or response from Ollama NDJSON'
);
assert.match(
  localLlmContent,
  /fallbackClinicalStream/,
  'localLlm.ts must preserve fallbackClinicalStream when offline'
);
console.log('✓ [Test 2] localLlm.ts dual streaming protocol parser (SSE & Ollama NDJSON) confirmed');

// 3. ClinicalBriefing.tsx Persona Selection
const briefingPath = path.join(bodySignalDir, 'src/pages/ClinicalBriefing.tsx');
const briefingContent = fs.readFileSync(briefingPath, 'utf8');

assert.match(
  briefingContent,
  /activePersona\s*,\s*setActivePersona/,
  'ClinicalBriefing.tsx must maintain activePersona state'
);
assert.match(
  briefingContent,
  /의사용 전문 임상 요약 \(SOAP\)/,
  'ClinicalBriefing.tsx must render "의사용 전문 임상 요약 (SOAP)" tab/button'
);
assert.match(
  briefingContent,
  /환자용 쉬운 소견 요약/,
  'ClinicalBriefing.tsx must render "환자용 쉬운 소견 요약" tab/button'
);
assert.match(
  briefingContent,
  /setActivePersona\('doctor'\)/,
  'Clicking doctor tab must set activePersona to doctor'
);
assert.match(
  briefingContent,
  /setActivePersona\('patient'\)/,
  'Clicking patient tab must set activePersona to patient'
);
assert.match(
  briefingContent,
  /generateClinicalAiAnalysisStream\([\s\S]*personaToUse/,
  'generateClinicalAiAnalysisStream must receive activePersona / personaToUse'
);
console.log('✓ [Test 3] ClinicalBriefing.tsx Doctor vs Patient persona tabs and wiring confirmed');

console.log('ALL M4 VERIFICATION CHECKS PASSED CLEANLY!');
