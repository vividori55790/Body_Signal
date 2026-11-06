# E2E Test Infra: Bignal Mobile Production Testing

## Test Philosophy
- Opaque-box, requirement-driven derived directly from `ORIGINAL_REQUEST.md`.
- No reliance on internal module private methods. Validates behavior through public interfaces, DOM/CLI/data stores, and automated verification suites.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory (15 Features)
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|----------------------|:------:|:------:|:------:|
| 1 | R1.1 Acute Pain Mode Large Touch UI | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ |
| 2 | R1.2 Dashboard Top Rapid Integration | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ |
| 3 | R1.3 Medication Response 1-Tap Tracking | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ |
| 4 | R2.1 Android App Shortcuts | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ |
| 5 | R2.2 Web App Manifest Shortcuts | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ |
| 6 | R2.3 In-App Floating SOS Widget | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ |
| 7 | R3.1 On-Device AES-GCM 256 Encryption | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ |
| 8 | R3.2 SHA-256 Data Integrity Signatures | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ |
| 9 | R3.3 Auto-lock & App Switcher Masking | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ |
| 10 | R4.1 Local LLM Network Adapter | ORIGINAL_REQUEST §R4 | ≥5 | ≥5 | ✓ |
| 11 | R4.2 Settings Screen Config UI | ORIGINAL_REQUEST §R4 | ≥5 | ≥5 | ✓ |
| 12 | R4.3 Real-Time SSE/NDJSON Streaming | ORIGINAL_REQUEST §R4 | ≥5 | ≥5 | ✓ |
| 13 | R5.1 TypeScript Integrity Verification | ORIGINAL_REQUEST §R5 | ≥5 | ≥5 | ✓ |
| 14 | R5.2 Capacitor Android Sync & Build | ORIGINAL_REQUEST §R5 | ≥5 | ≥5 | ✓ |
| 15 | R5.3 Android APK Output Verification | ORIGINAL_REQUEST §R5 | ≥5 | ≥5 | ✓ |

## Test Architecture
- **Test Runner**: Node.js / Vite test harness (`npm run test:data`, TypeScript verification scripts, and automated E2E test scripts).
- **Test Case Tiers**:
  - **Tier 1 (Feature Coverage)**: Happy path verification for each of the 15 features in isolation.
  - **Tier 2 (Boundary & Corner Cases)**: Extreme inputs, empty fields, max intensity (NRS 10), min intensity (NRS 1), network errors, corrupted storage, invalid PIN, malformed SSE packets.
  - **Tier 3 (Cross-Feature Combinations)**: Acute pain logged -> Medication taken -> 1-tap re-evaluation -> SHA-256 signature chain -> AES-GCM 256 persistence -> LLM clinical summary generation.
  - **Tier 4 (Real-World Clinical Scenarios)**: Real-world patient workflows (Sudden migraine attack at midnight, post-surgery pain tracking, chronic arthritis weekly log, doctor clinic briefing review).
  - **Tier 5 (Adversarial Coverage Hardening)**: White-box challenger gap analysis and stress testing.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Sudden Acute Migraine Flare-up | R1.1, R1.2, R2.3, R3.1, R3.2 | High |
| 2 | Post-Operative Analgesic Response | R1.3, R3.1, R3.2, R4.3 | High |
| 3 | Clinic Visit Doctor Briefing | R2.1, R3.2, R4.1, R4.2, R4.3 | High |
| 4 | Security & Tamper Detection Under Background State | R3.1, R3.2, R3.3 | High |
| 5 | Android Launcher Direct Deep Linking | R2.1, R2.2, R1.1 | Medium |
