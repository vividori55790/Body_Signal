# Bignal Survey & Architectural Discovery Report: R3, R4, R5

**Author**: Survey Explorer 3 (teamwork_explorer)  
**Date**: 2026-11-06  
**Target Project**: Bignal (`c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\body-signal`)  
**Status**: Exploration & Gap Analysis Complete (Read-Only)

---

## Executive Summary

1. **Storage & Security (R3)**: Modern storage is implemented using `idb` (`bignal_mobile_db`, store `app_state`). Web Crypto API (`crypto.subtle`) provides AES-GCM 256 and PBKDF2 (100k iterations) in `crypto.ts`. However, encryption currently only triggers when a user PIN is present. Furthermore, SHA-256 is only utilized for whole-backup verification, not per-record medical audit signatures. Android App Switcher privacy requires native `FLAG_SECURE` in `MainActivity.java` and fixing the UI privacy curtain condition in `AuthContext.tsx`.
2. **Local LLM Architecture (R4)**: An OpenAI-compatible SSE streaming client (`streamChatCompletions`, `generateClinicalAiAnalysisStream`, `askClinicalQuestionStream`) already exists in `localLlm.ts` with on-device fallback and Settings UI. To support native Ollama endpoints (`/api/chat`, `/api/tags`) and resolve Android local network blocking, `android:usesCleartextTraffic="true"` must be added to `AndroidManifest.xml`, and an adaptive ndjson/SSE stream parser is recommended.
3. **Build & Android Verification (R5)**: `npx tsc --noEmit` succeeds with **0 errors**. Android build tools (Microsoft JDK 17, Android SDK 34, Gradle 8.14.3) are present and verified on the host machine. The root script `build_apk.ps1` successfully executes `gradlew assembleDebug` to output `Bignal-v0.1.0-debug.apk`.

---

## Part 1. Storage & Security (Requirement R3)

### 1.1 Existing Storage Layer Analysis
* **Primary Modern Layer**: `body-signal/src/utils/storage.ts`
  * Engine: IndexedDB via `idb` (`^8.0.4`).
  * Database Name: `bignal_mobile_db`, Version `1`.
  * Object Store: `app_state` (single key-value store holding keys: `'health_data'`, `'pin_meta'`, `'user_settings'`).
* **Legacy Storage Layer**: `body-signal/src/utils/dataStore.js`
  * Engine: `localStorage` (Keys: `bs-data-v2`, `bs-sync-queue-v1`).
  * `storage.ts` has a built-in migration routine `migrateLegacyDataIfNeeded()` that reads `bs-data-v2`, normalizes records, persists them into IndexedDB, and marks `bs-migrated-to-idb`.
* **Capacitor Storage / Dexie**: Not used. Dexie is not installed. Capacitor Preferences is not used; `idb` provides superior structured storage for complex nested objects in web and Capacitor WebView.
* **Cloud Sync Evaluation**: 100% offline. No cloud endpoints, analytics, or remote database synchronization exist in `storage.ts` or `HealthContext.tsx`.

### 1.2 On-Device AES-GCM 256 Encryption Implementation Plan
#### Current State (`crypto.ts` & `storage.ts`)
* `crypto.ts` implements standard Web Crypto API primitives:
  * AES-GCM with 256-bit key length (`KEY_LENGTH_BITS = 256`).
  * 12-byte initialization vector (`IV_LENGTH_BYTES = 12`).
  * 16-byte random salt (`SALT_LENGTH_BYTES = 16`).
  * PBKDF2 key derivation (`100,000` iterations, SHA-256).
  * Storage format: `EncryptedPackage` (`{ v: 1, salt: hex, iv: hex, ct: base64 }`).
* **Current Limitation**: In `saveHealthData(data, pin?)` (`storage.ts:160-166`), encryption is **only applied if `pin` is passed**:
  ```ts
  if (pin) {
    const jsonStr = JSON.stringify(toSave);
    const encrypted = await encryptWithPin(jsonStr, pin);
    await db.put('app_state', encrypted, 'health_data');
  } else {
    await db.put('app_state', toSave, 'health_data'); // Plaintext!
  }
  ```
#### Architecture Recommendation for 100% On-Device Encryption At Rest
1. **Device Master Key (Transparent At-Rest Encryption)**:
   * Generate an on-device non-exportable CryptoKey:
     ```ts
     const deviceKey = await crypto.subtle.generateKey(
       { name: 'AES-GCM', length: 256 },
       false, // non-extractable for maximum security
       ['encrypt', 'decrypt']
     );
     ```
   * Alternatively, derive a device key from an on-device hardware-backed/indexedDB device salt so that all health data stored in `bignal_mobile_db` is **always encrypted with AES-GCM 256** even before a user sets a personal PIN.
2. **User PIN Key Hierarchy (Envelope Encryption)**:
   * When the user enables PIN protection, derive a Key Encryption Key (KEK) via PBKDF2 (100k iter) from the user PIN to wrap/protect the master key or re-encrypt the data package.
   * When PIN is removed, decrypt and re-encrypt under the transparent device master key.

---

### 1.3 SHA-256 Data Integrity Signatures & Medical Audit Trail
#### Current State
* `crypto.ts` exports `computeSha256Checksum(data: string): Promise<string>`.
* Currently, this is only used for backup export/import verification (`encryptBackupWithPassphrase`).
* `PainLogSchema` (`src/types/health.ts:16-33`) does **not** contain an integrity signature or hash field.
* `HealthContext.tsx:saveEntry` does **not** generate record hashes.

#### Architecture Recommendation
1. **Schema Extension (`src/types/health.ts`)**:
   ```ts
   export const PainLogSchema = z.object({
     id: z.string().min(1),
     conditionId: z.string().min(1),
     date: z.string(),
     intensity: z.number().int().min(1).max(10),
     medication: z.string().max(500).optional().default(''),
     notes: z.string().max(5000).optional().default(''),
     bodyPartOverride: z.string().optional(),
     painQuality: z.array(z.string()).optional().default([]),
     radiation: z.string().optional().default(''),
     painTiming: z.enum(['morning', 'afternoon', 'evening', 'night', 'constant', 'intermittent']).optional(),
     triggers: z.array(z.string()).optional().default([]),
     reliefFactors: z.array(z.string()).optional().default([]),
     redFlags: z.array(z.string()).optional().default([]),
     postMedIntensity: z.number().int().min(0).max(10).optional(),
     // Medical Audit Trail & Integrity Signatures
     signature: z.string().optional(),        // SHA-256 HMAC or hash of canonical record
     prevSignature: z.string().optional(),    // Chained hash of previous log (tamper-evident audit chain)
     signedAt: z.string().optional(),         // ISO timestamp of signing
   });
   ```
2. **Deterministic Canonical Serialization (`crypto.ts`)**:
   ```ts
   export function getCanonicalRecordData(log: Omit<PainLog, 'signature' | 'signedAt'>): string {
     // Deterministic key sorting to prevent JSON ordering differences
     return [
       log.id,
       log.conditionId,
       log.date,
       log.intensity,
       log.medication || '',
       log.notes || '',
       log.bodyPartOverride || '',
       (log.painQuality || []).sort().join(','),
       log.radiation || '',
       log.painTiming || '',
       (log.triggers || []).sort().join(','),
       (log.reliefFactors || []).sort().join(','),
       (log.redFlags || []).sort().join(','),
       log.postMedIntensity ?? '',
       log.prevSignature || 'GENESIS'
     ].join('|');
   }

   export async function signPainLogRecord(log: Omit<PainLog, 'signature' | 'signedAt'>): Promise<string> {
     const canonical = getCanonicalRecordData(log);
     return computeSha256Checksum(canonical);
   }

   export async function verifyPainLogIntegrity(log: PainLog): Promise<boolean> {
     if (!log.signature) return false;
     const expected = await signPainLogRecord(log);
     return expected === log.signature;
   }
   ```
3. **Auditing & UI Integration**:
   * In `HealthContext.tsx:saveEntry`, when appending `newLog`, compute `signature` with `prevSignature = logs[0]?.signature || 'GENESIS'`.
   * Display integrity verification status in `TrustBadge.tsx` and `ClinicalBriefing.tsx` ("의료 의무기록 무결성 서명 검증 완료 (SHA-256)").

---

### 1.4 Background Transition, Auto-Lock, & Android App Switcher Privacy Masking
#### Current State & Gaps
1. **Web / WebView Visibility Listener (`AuthContext.tsx:46-61`)**:
   * Listens to `document.addEventListener('visibilitychange', ...)`.
   * Sets `backgroundTimeRef.current = Date.now()` and `setIsPrivacyMasked(true)`.
   * When returning, if elapsed >= `60_000ms`, locks app and clears `activeSessionPin`.
   * **Bug in Mask Condition (`AuthContext.tsx:142`)**:
     ```tsx
     {isPrivacyMasked && isPinSet && !isUnlocked && (
       <div className="fixed inset-0 z-[100] bg-slate-900 ...">
     ```
     `!isUnlocked` is **false** when an authenticated user switches away! Therefore, while the user switches apps, the privacy mask is **not visible** until the app locks.
     *Fix*: Condition should be `{isPrivacyMasked && isPinSet && (...)}`.
2. **Android Native App Switcher Masking (`MainActivity.java`)**:
   * Android OS takes an asynchronous window surface capture when an activity transitions to the background. In WebView, JavaScript cannot guarantee that the DOM overlay is rendered before Android snapshots the screen.
   * **Native Solution**: Set `FLAG_SECURE` on the Android Window.
     In `body-signal/android/app/src/main/java/com/bodysignal/app/MainActivity.java`:
     ```java
     package com.bodysignal.app;

     import android.os.Bundle;
     import android.view.WindowManager;
     import com.getcapacitor.BridgeActivity;

     public class MainActivity extends BridgeActivity {
         @Override
         public void onCreate(Bundle savedInstanceState) {
             super.onCreate(savedInstanceState);
             // Prevent Android App Switcher thumbnail capture and unauthorized screenshots
             getWindow().setFlags(
                 WindowManager.LayoutParams.FLAG_SECURE,
                 WindowManager.LayoutParams.FLAG_SECURE
             );
         }
     }
     ```
     *Benefit*: `FLAG_SECURE` automatically blanks out the app thumbnail in Android's recent apps switcher, completely protecting sensitive patient pain records and medical notes.

---

## Part 2. Local LLM Architecture (Requirement R4)

### 2.1 Current Architecture Overview
* **Utility**: `body-signal/src/utils/localLlm.ts` (370 lines).
* **Settings**: `body-signal/src/pages/Settings.tsx` (Local LLM section with toggle, endpoint input, presets, model selection, test button).
* **Clinical Consumer**: `body-signal/src/pages/ClinicalBriefing.tsx` (AI clinical summary and interactive Q&A assistant).

### 2.2 Local Network Communication Adapter (Ollama & LM Studio / OpenAI-Compatible)
#### Protocol Variations
| Local Engine | Standard Endpoint | Stream Protocol | Model List Endpoint |
|---|---|---|---|
| **Ollama (v0.1.24+)** | `http://<host>:11434/v1/chat/completions` | SSE (`data: {"choices": [{"delta": {"content": "..."}}]}`) | `GET /v1/models` |
| **Ollama Native** | `http://<host>:11434/api/chat` | NDJSON (`{"message": {"content": "..."}, "done": false}`) | `GET /api/tags` |
| **LM Studio** | `http://<host>:1234/v1/chat/completions` | SSE (`data: {"choices": [{"delta": {"content": "..."}}]}`) | `GET /v1/models` |
| **LocalAI / Jan / vLLM** | `http://<host>:8080/v1/chat/completions` | SSE (`data: ...`) | `GET /v1/models` |

#### Key Network Findings for Mobile Android
1. **Android Cleartext Traffic**:
   * Android 9 (API 28)+ blocks unencrypted HTTP (`http://192.168.x.x` or `http://10.0.2.2`) by default.
   * `AndroidManifest.xml` in `body-signal` **currently lacks `android:usesCleartextTraffic="true"`**!
   * Any local network HTTP fetch from the Android app to an Ollama or LM Studio instance on the local LAN will fail with `Cleartext HTTP traffic not permitted`.
   * **Fix Required**: Add `android:usesCleartextTraffic="true"` inside `<application>` in `AndroidManifest.xml`.
2. **Localhost Resolution in Mobile/Emulators**:
   * In Android Emulator: host machine is `10.0.2.2:11434`.
   * On Physical Android Device via Wi-Fi: host machine is `192.168.x.x:11434`.
   * `Settings.tsx` already has quick presets for `http://localhost:11434/v1`, `http://10.0.2.2:11434/v1`, and `http://localhost:1234/v1`.
3. **Adaptive Streaming Parser in `localLlm.ts`**:
   Currently, `streamChatCompletions` parses lines beginning with `data: `. To also natively support Ollama `/api/chat` or `/api/generate`, the line parser should:
   ```ts
   for (const line of lines) {
     const trimmed = line.trim();
     if (!trimmed || trimmed.startsWith(':') || trimmed === 'data: [DONE]') continue;

     // 1. OpenAI-compatible SSE format (starts with "data: ")
     if (trimmed.startsWith('data: ')) {
       try {
         const json = JSON.parse(trimmed.slice(6));
         const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.text || '';
         if (delta) { accumulated += delta; onChunk(delta, accumulated); }
       } catch {}
     }
     // 2. Ollama Native NDJSON format (direct JSON object)
     else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
       try {
         const json = JSON.parse(trimmed);
         const delta = json.message?.content || json.response || '';
         if (delta) { accumulated += delta; onChunk(delta, accumulated); }
       } catch {}
     }
   }
   ```
4. **Resilient Connection Testing (`testLocalLlmConnection`)**:
   Probe `/v1/models` first; if it returns 404, probe `/api/tags` (Ollama native). This ensures users can type either `http://192.168.0.5:11434` or `http://192.168.0.5:11434/v1` and both succeed.

### 2.3 Settings Screen UI & Test Connection
* Already configured in `Settings.tsx:447-586`:
  * Toggle switch to enable/disable Local LLM.
  * Endpoint URL input field with quick one-touch preset buttons.
  * Model name input with chips (`llama3.2`, `phi3`, `mistral`, `gemma2`).
  * "로컬 LLM 연결 테스트" button with live spinner and pass/fail feedback banner showing discovered models.

### 2.4 Real-time SSE Streaming & Persona Generation
* `generateClinicalAiAnalysisStream` already implements prompt differentiation:
  * `'doctor'`: PQRST metrics, SOAP note alignment, medication adherence rate, red flags triage, clinical questions.
  * `'patient'`: Empathic, plain Korean, recovery guidance, doctor visit questions.
* In `ClinicalBriefing.tsx`:
  * "로컬 LLM 임상 보조 AI" features real-time incremental rendering (`setAiAnalysis(accumulated)`).
  * "로컬 AI에게 내 증상 물어보기" enables multi-turn interactive clinical Q&A.
  * *Enhancement*: Provide a persona switch tab ([의사용 요약] / [환자용 안내]) on the UI to allow 1-click toggling between target audiences.

---

## Part 3. Build & Verification (Requirement R5)

### 3.1 Project Configuration & Tooling Verification
* `package.json` in `body-signal`:
  * Dependencies: React 19, `@capacitor/android` 8.0.0, `@capacitor/cli` 8.0.0, `@capacitor/core` 8.0.0, `@capacitor/haptics`, `@capacitor/local-notifications`, `idb` 8.0.4, `date-fns`, `lucide-react`, `recharts`, `tailwind-merge`, `zod`.
* `tsconfig.json`:
  * `noEmit: true`, `target: ES2022`, `moduleResolution: bundler`.
* `vite.config.js`:
  * Configures `vite-plugin-pwa` with web app manifest shortcuts:
    * `/?mode=acute` (1초 급성 통증 기록)
    * `/briefing` (의료진 진료 브리핑)
    * `/entry` (빠른 복약 기록)
* **TypeScript Integrity Check**:
  * Executed `npx tsc --noEmit` inside `body-signal`.
  * **Result**: Exit code `0`, **0 errors**.

### 3.2 Android Build Environment & Toolchain Inspection
* **JDK**: Microsoft JDK 17 (`C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot`), verified functional.
* **Android SDK**: `C:\Users\vivid\AppData\Local\Android\Sdk` (configured in `android/local.properties`), verified functional.
* **Gradle Wrapper**: `Gradle 8.14.3` via `body-signal/android/gradlew.bat`. Tested and verified working with JDK 17.
* **Android Gradle Plugin**: `8.13.0`.
* **SDK Targets**: `compileSdk = 34`, `targetSdk = 34`, `minSdk = 24`.
* **Shortcuts Configuration**: `body-signal/android/app/src/main/res/xml/shortcuts.xml` is registered in `AndroidManifest.xml` with `shortcut_acute`, `shortcut_briefing`, and `shortcut_med`.

### 3.3 Official APK Build Pipeline
The build pipeline to produce `Bignal-v0.1.0-debug.apk` at the project root is:
1. `cd body-signal && npm run build`
2. `cd body-signal && npx cap sync android`
3. `$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot"`
4. `$env:ANDROID_HOME = "C:\Users\vivid\AppData\Local\Android\Sdk"`
5. `cd body-signal\android && .\gradlew.bat assembleDebug`
6. `Copy-Item body-signal\android\app\build\outputs\apk\debug\app-debug.apk -Destination .\Bignal-v0.1.0-debug.apk -Force`

The root script `build_apk.ps1` already exists to execute steps 3–5. A pre-built `Bignal-v0.1.0-debug.apk` (4,102,039 bytes) is present at the repository root.

---

## Part 4. Gap Matrix & Implementation Roadmap

| Req | Item | Current State | Required Change | Impact / Urgency |
|---|---|---|---|---|
| **R3** | At-Rest AES-GCM 256 | Only encrypts if PIN is provided in `saveHealthData`. | Implement transparent device master key encryption when PIN is not set. | High (Acceptance criteria) |
| **R3** | SHA-256 Record Integrity | Only backup envelopes have checksums. | Add `signature` / `prevSignature` to `PainLogSchema` and verify integrity. | High (Medical audit trail) |
| **R3** | App Switcher Masking | UI overlay has buggy `!isUnlocked` condition; native Android can still snapshot. | 1) Add `FLAG_SECURE` in `MainActivity.java`. 2) Fix `AuthContext.tsx` mask condition. | High (HIPAA / Privacy) |
| **R4** | Local Network HTTP | Cleartext HTTP blocked by Android 9+ default policy. | Add `android:usesCleartextTraffic="true"` to `AndroidManifest.xml`. | High (Network connectivity) |
| **R4** | Ollama Native Streaming | Only parses `data: ` SSE format. | Add support for NDJSON (`{"message":{"content":"..."}}`). | Medium (Broad compatibility) |
| **R4** | Doctor/Patient Persona | Logic in `localLlm.ts` supports both, but UI hardcodes `'doctor'`. | Add persona tab switch in `ClinicalBriefing.tsx`. | Medium (Usability) |
| **R5** | TypeScript & Build | `npx tsc --noEmit` is clean (0 errors); build script exists. | Maintain 0 errors after R3/R4 implementation; run `gradlew assembleDebug`. | High (Release deliverable) |

---

## Conclusion
The Bignal project has a robust architectural foundation with high-quality TypeScript code and existing cryptographic and AI scaffolding. Addressing the identified gaps (device-level default encryption, per-record SHA-256 signatures, native `FLAG_SECURE`, `android:usesCleartextTraffic`, and Ollama NDJSON parsing) will fully achieve production-grade compliance with all R3, R4, and R5 requirements.
