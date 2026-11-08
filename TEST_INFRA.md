# E2E Test Infra: Bignal Mobile Production Testing

## Test Philosophy
- **Opaque-Box & Requirement-Driven**: Derived strictly from `ORIGINAL_REQUEST.md`, `body-signal/user_feedback/Feedback_2026-11-06.md`, and `PROJECT.md`.
- **Zero Reliance on Internal Private States**: Validates application behavior through public APIs, DOM structure, data stores, cryptographic standards, and native platform bridges.
- **Methodology**: 4-Tier Progressive Verification combining Category-Partition, Boundary Value Analysis (BVA), Pairwise Combinatorial Testing, and End-to-End Real-World Clinical Workloads.

---

## 1. Feature Inventory (14 User Feedback Features)

| # | Code | Feature Name | Source (Feedback) | Milestone | Tier 1 (Happy) | Tier 2 (Boundary) | Tier 3 (Cross) | Status |
|:-:|:----:|:-------------|:-----------------:|:---------:|:--------------:|:-----------------:|:--------------:|:------:|
| 1 | **F1** | Full-Bleed PIN Setup Modal | Feedback #1 | M1 | ≥5 | ≥5 | ✓ | **PASS** |
| 2 | **F2** | Biometric Passkey Unlock | Feedback #2 | M1 | ≥5 | ≥5 | ✓ | **PASS** |
| 3 | **F3** | Ergonomic Keypad Redesign | Feedback #3 | M1 | ≥5 | ≥5 | ✓ | **PASS** |
| 4 | **F4** | Real-Time Dynamic Theme Sync | Feedback #4 | M2 | ≥5 | ≥5 | ✓ | **PASS** |
| 5 | **F5** | Dynamic Medication Prompt Linking | Feedback #5 | M3 | ≥5 | ≥5 | ✓ | **PASS** |
| 6 | **F6** | In-Flow Medication Management | Feedback #6 | M3 | ≥5 | ≥5 | ✓ | **PASS** |
| 7 | **F7** | System Font Scale Inheritance | Feedback #7 | M2 | ≥5 | ≥5 | ✓ | **PASS** |
| 8 | **F8** | Standard Symptom Logging Stability | Feedback #8 | M3 | ≥5 | ≥5 | ✓ | **PASS** |
| 9 | **F9** | Dashboard Entry Streamlining | Feedback #9 | M3 | ≥5 | ≥5 | ✓ | **PASS** |
| 10 | **F10** | Multi-Region Body Map Selection | Feedback #10 | M3 | ≥5 | ≥5 | ✓ | **PASS** |
| 11 | **F11** | Local AI Disconnection Guard | Feedback #11 | M4 | ≥5 | ≥5 | ✓ | **PASS** |
| 12 | **F12** | Department-Categorized Briefing | Feedback #12 | M4 | ≥5 | ≥5 | ✓ | **PASS** |
| 13 | **F13** | System-Linked Haptics Enforcement | Feedback #13 | M2 | ≥5 | ≥5 | ✓ | **PASS** |
| 14 | **F14** | Android SDK 34 Compliance & APK Rebuild | Feedback #14 | M5 | ≥5 | ≥5 | ✓ | **PASS** |

---

## 2. Test Architecture & Tier Methodology

### Tier 1: Feature Coverage (Happy Path) — 70 Tests (14 × 5)
- Tests primary behaviors and happy paths for each of the 14 features in complete isolation.
- Focus: interface contracts, schema validation, state transitions, and component mounts.

### Tier 2: Boundary & Corner Cases — 70 Tests (14 × 5)
- Boundary inputs: minimum/maximum values (NRS 0, NRS 10, fontScale 0.85x ~ 2.0x).
- Extreme states: empty medication presets, whitespace strings, long text (>100 chars), missing parameters.
- User disruptions: prompt cancellation, mid-flow abort, rapid multi-taps, network timeout (>4000ms), 5-fail lockout.

### Tier 3: Cross-Feature Combinations — 14 Pairwise Tests
- E.g. F1+F4 (Theme change during active PIN modal maintains solid background).
- F2+F13 (Biometric unlock with haptics disabled produces zero vibrations).
- F3+F7 (Ergonomic keypad under 1.3x system font scale preserves ≥64px targets).
- F5+F6 (In-flow added medication preset immediately populates acute prompt).
- F8+F10 (Full PQRST symptom entry with multi-region body parts saves and verifies SHA-256 chain).
- F11+F12 (Department briefing displays clean offline warning without fake tokens when local AI is offline).

### Tier 4: Real-World Clinical Workload Scenarios — 7 Scenarios
- **Scenario 1**: Sudden Acute Migraine Flare-up at Midnight (`T4.1`).
- **Scenario 2**: Post-Op Knee & Lower Back Multi-Region Pain (`T4.2`).
- **Scenario 3**: Comprehensive Clinic Visit Doctor Briefing (`T4.3`).
- **Scenario 4**: Elderly Patient Large-Font Experience (`T4.4`).
- **Scenario 5**: Sensory-Sensitive Patient Silent Mode (`T4.5`).
- **Scenario 6**: Day-in-the-Life Chronic Pain Management (`T4.6`).
- **Scenario 7**: End-to-End Security & Native Compliance Lifecycle (`T4.7`).

---

## 3. Test Directory Layout & Deliverables

```
body-signal/
├── test/
│   ├── e2e/
│   │   ├── feedback_helpers.mjs           # Test harness utilities & mocks
│   │   ├── tier1_feedback_features.mjs     # 70 Tier 1 tests
│   │   ├── tier2_feedback_boundaries.mjs   # 70 Tier 2 tests
│   │   ├── tier3_feedback_combinations.mjs # 14 Tier 3 tests
│   │   └── tier4_feedback_scenarios.mjs    # 7 Tier 4 tests
│   ├── run-feedback-tests.mjs             # Standalone Feedback test runner
│   └── run-all-tests.mjs                  # Unified runner (331 total tests)
└── scripts/
    └── run-e2e-tests.mjs                  # Baseline test runner (170 tests)
```

---

## 4. Execution Commands

```powershell
# 1. Run Feedback 14 Features Suite (161 tests):
node body-signal/test/run-feedback-tests.mjs

# 2. Run Targeted Tier in Feedback Suite:
node body-signal/test/run-feedback-tests.mjs --tier 1
node body-signal/test/run-feedback-tests.mjs --tier 4

# 3. Filter by Feature Code:
node body-signal/test/run-feedback-tests.mjs --feature F1
node body-signal/test/run-feedback-tests.mjs --feature F10

# 4. Run Unified Test Harness (All 331 tests):
node body-signal/test/run-all-tests.mjs

# 5. Run Baseline Test Suite (170 tests):
npm --prefix body-signal test
```
