# Body Signal — Implemented Features (`v2.0.2`)

## 1. Pain & Symptom Logging
- **1-Second Acute Pain Mode**: Rapid oversized SOS severity capture with quick body region chips.
- **3-Second Quick Logger**: Dashboard inline intensity (`0–10` NRS) and quick medication buttons.
- **Full Entry Form & PQRST**: Detailed condition linking, front/back interactive BodyMap, pain qualities, radiation, triggers, relieving factors, Red Flag warnings, and medication intake tracking.
- **Post-Medication Follow-up**: Re-evaluate pain intensity `1–2 hours` after dosing to measure drug response.

## 2. Clinical Consultation & Analytics
- **30-Second Doctor View & SOAP EMR**: Aggregates symptoms by medical department (`Orthopedics / Rehabilitation`, `Neurology / Neurosurgery`, `Gastroenterology`, `Internal Medicine / General`), highlights Red Flags, and copies formatted Standard or SOAP summaries.
- **Calendar Heatmap & Statistics**: Monthly/daily pain trends, NRS progression charts, and condition timeline views.
- **Optional On-Device AI Briefing**: Strictly loopback-only (`localhost`, `127.0.0.1`, `[::1]`) or built-in device edge AI (`window.ai`) for clinical summaries and Q&A.

## 3. Diagnostic Vault & Insurance Readiness
- **Encrypted Diagnostic Archive**: Store hospital photos, receipts, and lab memos with automatic EXIF stripping and AES-GCM 256 encryption.
- **Indemnity Claim Tracker**: Tracks diagnostic records and upcoming indemnity insurance claim filing deadlines.

## 4. Security, Privacy & Bilingual UX
- **100% Offline & Bilingual**: Automatic first-launch locale detection (`English` / `한국어`) plus instant Settings toggle.
- **Defense-in-Depth Protection**: Mandatory 6-digit PIN, non-extractable session key, 3-minute idle auto-lock, AndroidKeyStore + OS biometric/credential unlock, offline TOTP 2FA, native root/hook/debugger check, `FLAG_SECURE`, Privacy Mask overlay, and encrypted JSON backups (plus warned, formula-sanitized CSV exports).
