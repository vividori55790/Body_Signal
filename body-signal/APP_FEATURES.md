# Body Signal - App Features Overview (`v2.0.0`)

## Summary

**Body Signal (Bignal)** is a local-first, privacy-focused health and symptom tracking Android/PWA application licensed under `GPL-3.0-only`. All records, medications, and diagnostic images are encrypted on-device with zero cloud accounts, ads, or trackers.

---

## Core Features

1. **Brand Launch Splash & Mandatory First-Use Disclaimer**
   - Displays the Bignal brand splash screen on launch before transitioning to the security LockScreen.
   - Requires explicit acknowledgment of the medical, emergency, and local backup responsibility disclaimer before first use (re-readable anytime in Settings).

2. **Disease-Centered Tracking & Unassigned Symptom Grouping**
   - Log pain and symptoms under an **existing condition**, as **unassigned**, or as a **new condition**.
   - Batch-assign accumulated unassigned logs to a diagnosed condition later from the Dashboard.
   - Supports a 1-second Acute Pain Mode, compact Dashboard Quick Logger, and full PQRST entry form.

3. **Organic BodyMap & Ephemeral Pain Slider**
   - Interactive front/back human silhouette with spray-paint region selection and multi-part department mapping.
   - 1–10 NRS pain buttons that morph into a smooth horizontal slider on press/hold-slide and return cleanly on release.

4. **30-Second Clinical Briefing**
   - Organizes symptoms, trends, red-flag alerts, and medication efficacy by medical department.
   - Includes one-tap EMR text export and print layout, plus an optional lab toggle for strictly on-device loopback LLM summaries (`localhost` / `127.0.0.1` / `[::1]` only; external hosts blocked).

5. **Encrypted Diagnostic & Insurance Vault**
   - Strips image EXIF metadata before encrypting diagnostic documents and receipts with AES-GCM 256.
   - Supports Grid/Feed switching and automatic 3-year indemnity insurance claim deadline calculations.

6. **Hardware-Backed On-Device Security**
   - Fail-closed startup gating, mandatory 6-digit PBKDF2 PIN setup on first launch, non-extractable WebCrypto session key vault, and 3-minute idle auto-lock.
   - Native Android root/hook/debugger integrity detection, `AndroidKeyStore` + `BiometricPrompt` (`DEVICE_CREDENTIAL`) with atomic key rotation, offline RFC 6238 TOTP 2FA with replay/lockout guards, `FLAG_SECURE` / assistant screen-context blocking, strict CSP, R8 release hardening, SHA-256 audit chains, CSV plaintext/formula-injection warning, and passphrase-encrypted AES-256 backup export/import.
