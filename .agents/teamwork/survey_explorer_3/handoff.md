# Handoff Report: Survey Explorer 3 (R3, R4, R5)

**Agent**: Survey Explorer 3 (`teamwork_explorer`)  
**Working Directory**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\survey_explorer_3`  
**Parent Conversation ID**: `1799b539-02c9-4b03-9d7a-d6838a61bbc2`  
**Handoff Type**: Hard (Investigation complete)

---

## 1. Observation

1. **Storage Layer**:
   - `body-signal/src/utils/storage.ts:1-28`: Modern persistence uses `idb` (`^8.0.4`) with database `bignal_mobile_db` (v1) and object store `app_state`.
   - `body-signal/src/utils/dataStore.js:1-5`: Legacy layer used `localStorage` (`bs-data-v2`). `storage.ts:70-110` implements `migrateLegacyDataIfNeeded()` to migrate old records into IndexedDB.
   - `body-signal/src/utils/storage.ts:160-166`:
     ```ts
     if (pin) {
       const jsonStr = JSON.stringify(toSave);
       const encrypted = await encryptWithPin(jsonStr, pin);
       await db.put('app_state', encrypted, 'health_data');
     } else {
       await db.put('app_state', toSave, 'health_data');
     }
     ```
     When `pin` is undefined, data is stored in plaintext.

2. **Cryptography & Signatures**:
   - `body-signal/src/utils/crypto.ts:7-17`: Defines PBKDF2 (100,000 iterations, SHA-256), 256-bit AES-GCM, 12-byte IV, 16-byte salt, returning `EncryptedPackage` (`{ v: 1, salt, iv, ct }`).
   - `body-signal/src/utils/crypto.ts:59-63`: `computeSha256Checksum` uses `crypto.subtle.digest('SHA-256', ...)`. Used in `encryptBackupWithPassphrase` and `decryptBackupWithPassphrase`.
   - `body-signal/src/types/health.ts:16-35`: `PainLogSchema` does not have a `signature`, `auditHash`, or `prevSignature` field.
   - `body-signal/src/context/HealthContext.tsx:123-143`: `saveEntry` does not calculate or attach a SHA-256 checksum to `newLog`.

3. **Background & Privacy Masking**:
   - `body-signal/src/context/AuthContext.tsx:46-61`: Listens to `document.addEventListener('visibilitychange', ...)`. Auto-lock threshold is 60,000ms (`AUTO_LOCK_TIMEOUT_MS = 60_000`).
   - `body-signal/src/context/AuthContext.tsx:142`:
     ```tsx
     {isPrivacyMasked && isPinSet && !isUnlocked && (
     ```
     `!isUnlocked` prevents the privacy curtain from appearing when an unlocked app transitions to the background.
   - `body-signal/android/app/src/main/java/com/bodysignal/app/MainActivity.java:1-6`: Does not configure `WindowManager.LayoutParams.FLAG_SECURE`.

4. **Local LLM**:
   - `body-signal/src/utils/localLlm.ts:188-265`: `streamChatCompletions` connects to `${base}/v1/chat/completions`, parses lines starting with `data: `, and invokes `onChunk`. Includes `fallbackClinicalStream` when offline.
   - `body-signal/src/pages/Settings.tsx:447-586`: Contains Local LLM toggle, endpoint input with presets (`localhost:11434/v1`, `10.0.2.2:11434/v1`, `localhost:1234/v1`), model input, and connection test button.
   - `body-signal/android/app/src/main/AndroidManifest.xml:4-10`: Does not set `android:usesCleartextTraffic="true"`.
   - `body-signal/src/pages/ClinicalBriefing.tsx:74`: Passes hardcoded `'doctor'` to `generateClinicalAiAnalysisStream`.

5. **Build & Toolchain**:
   - Ran `Set-Location body-signal; npx tsc --noEmit`: Exited with code `0` (0 errors).
   - JDK 17 verified at `C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot`.
   - Android SDK verified at `C:\Users\vivid\AppData\Local\Android\Sdk`.
   - Gradle wrapper verified: `Gradle 8.14.3` (`.\gradlew.bat --version` exited with code `0`).
   - Root script `build_apk.ps1` runs `.\gradlew.bat assembleDebug` and produces `Bignal-v0.1.0-debug.apk`.

---

## 2. Logic Chain

1. **Storage Security Chain**:
   - Observation 1 shows `saveHealthData` branches on `if (pin)`.
   - If a user uses the app without setting a PIN, pain logs and conditions are written as raw JSON objects in IndexedDB.
   - Therefore, to satisfy Requirement R3 ("100% 온디바이스 AES-GCM 256 암호화로 안전하게 저장"), an on-device device key (Root Encryption Key) must be generated and stored locally to encrypt all data at rest by default, with PIN acting as a key encryption wrapper when enabled.

2. **Audit Trail Chain**:
   - Observation 2 shows `computeSha256Checksum` exists in `crypto.ts`, but `PainLogSchema` in `types/health.ts` and `saveEntry` in `HealthContext.tsx` do not generate signatures per record.
   - Therefore, to satisfy Requirement R3 ("저장되는 기록마다 SHA-256 기반 무결성 서명이 생성되어 위변조 여부를 검증할 수 있다"), `signature` and `prevSignature` must be added to `PainLogSchema`, computed via canonical string hashing during `saveEntry`, and validated with a verification function.

3. **Privacy Masking Chain**:
   - Observation 3 shows `!isUnlocked` in `AuthContext.tsx` blocks the overlay when switching while unlocked.
   - Furthermore, Android's OS-level task switcher captures the window surface asynchronously before JavaScript DOM changes take effect.
   - Therefore, adding `FLAG_SECURE` to `MainActivity.java` is required to guarantee that the Android App Switcher thumbnail is blanked out, and fixing the condition in `AuthContext.tsx` ensures in-app web curtain consistency.

4. **Local LLM Adapter Chain**:
   - Observation 4 shows Android blocks unencrypted HTTP traffic by default, and `AndroidManifest.xml` does not allow cleartext traffic.
   - Local LLM servers running on the user's LAN or machine use unencrypted HTTP (e.g. `http://192.168.0.x:11434` or `http://10.0.2.2:11434`).
   - Without `android:usesCleartextTraffic="true"`, mobile app requests to local LLMs will fail.
   - Adding `android:usesCleartextTraffic="true"` and supporting both SSE (`data: `) and Ollama NDJSON (`{"message": ...}`) in `streamChatCompletions` guarantees seamless connectivity.

5. **Build Pipeline Chain**:
   - Observation 5 confirms `tsc --noEmit` is clean (0 errors) and all Android build prerequisites (JDK 17, Android SDK 34, Gradle 8.14.3) are operational.
   - Therefore, running `npm run build && npx cap sync android` followed by `build_apk.ps1` will reliably produce the target `Bignal-v0.1.0-debug.apk`.

---

## 3. Caveats

- **Ollama CORS**: If a user runs Ollama on a PC and accesses it from a physical phone over Wi-Fi, Ollama requires environment variable `OLLAMA_ORIGINS="*"` and `OLLAMA_HOST="0.0.0.0:11434"`. A hint should be shown in the UI/docs.
- **Biometrics (Fingerprint/Face)**: Biometric authentication was not specified in R3 (PIN + AES-GCM was specified), but can wrap the PIN in future updates via `@capacitor-community/biometrics`.
- **Read-Only Scope**: In accordance with role constraints, no source files were modified during this investigation.

---

## 4. Conclusion

The codebase is well-structured and ready for production enhancements. The path forward for implementation is clearly mapped:
1. **R3**: Add transparent device-level AES-GCM 256 encryption in `storage.ts`, add per-record SHA-256 signatures (`signature`, `prevSignature`) in `types/health.ts` and `HealthContext.tsx`, and add `FLAG_SECURE` in `MainActivity.java` with fixed `AuthContext.tsx` masking.
2. **R4**: Add `android:usesCleartextTraffic="true"` to `AndroidManifest.xml`, make `streamChatCompletions` parse both SSE and NDJSON, and add doctor/patient persona toggle in `ClinicalBriefing.tsx`.
3. **R5**: Maintain `npx tsc --noEmit` at 0 errors, execute `build_apk.ps1`, and verify `Bignal-v0.1.0-debug.apk` at the project root.

---

## 5. Verification Method

- **TypeScript Typecheck**:
  ```powershell
  cd body-signal
  npx tsc --noEmit
  ```
  Expected result: 0 errors.

- **Android Gradle Build Verification**:
  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot"
  $env:Path = "$env:JAVA_HOME\bin;" + $env:Path
  $env:ANDROID_HOME = "C:\Users\vivid\AppData\Local\Android\Sdk"
  cd body-signal\android
  .\gradlew.bat assembleDebug
  ```
  Expected result: `BUILD SUCCESSFUL` and APK generated at `body-signal\android\app\build\outputs\apk\debug\app-debug.apk`.

- **Files to Inspect**:
  - Technical Report: `.agents/teamwork/survey_explorer_3/report.md`
  - Handoff Report: `.agents/teamwork/survey_explorer_3/handoff.md`
