# Body Signal — Implemented Features (`v2.3.0`)

## 1. Pain & Symptom Logging
- **1-Second Acute Pain Mode**: Rapid oversized SOS severity capture with quick body region chips and unassigned symptom triage.
- **3-Second Quick Logger**: Dashboard inline intensity (`0–10` NRS) and quick medication buttons.
- **Full Entry Form & PQRST**: Detailed condition linking, canonical interactive BodyMap (`bodyPartIds`), PQRST structured codes (`quality`, `radiation`, `triggers`, `reliefFactors`, `redFlags`), and medication intake tracking.
- **Post-Medication Follow-up**: Re-evaluate pain intensity `1–2 hours` after dosing to measure drug response.

## 2. Analytics & Clinical Architecture
- **Calendar Heatmap & Statistics**: Monthly/daily pain trends, NRS progression charts, and condition timeline views.
- **Clinical Consultation Briefing & Local AI *(Deferred to v4.0.0)***: Clinical EMR/SOAP aggregation and strictly loopback-only (`localhost`, `127.0.0.1`, `[::1]`) or built-in device edge AI (`window.ai`) are paused during the `v2.x–v3.x` personal tracking overhaul and scheduled to resume in `v4.0.0`.

## 3. Diagnostic Vault & Insurance Readiness
- **Encrypted Diagnostic Archive**: Store hospital photos, receipts, and lab memos with automatic EXIF stripping and AES-GCM 256 encryption.
- **Indemnity Claim Tracker**: Tracks diagnostic records and upcoming indemnity insurance claim filing deadlines.

## 4. Security, Privacy & N-Language Architecture
- **100% Offline & Scalable i18n**: System-auto locale detection (`system` default resolving `ko` / `en` and extensible `locales/*.json` locale packs with `Intl` formatting and RTL metadata), plus manual switcher in Settings.
- **Defense-in-Depth Protection**: Mandatory 6-digit PIN, non-extractable session key, 3-minute idle auto-lock, AndroidKeyStore + OS biometric/credential unlock, offline TOTP 2FA, native root/hook/debugger check, `FLAG_SECURE`, Privacy Mask overlay, and encrypted JSON backups (plus warned, formula-sanitized CSV exports).
