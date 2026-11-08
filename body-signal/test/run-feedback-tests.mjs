#!/usr/bin/env node

/**
 * Bignal Mobile App - Feedback 14 Features (F1-F14) Production E2E Test Suite Runner
 *
 * Tiers:
 *  - Tier 1: Feature Coverage (Happy Path, 14 features × 5 = 70 tests)
 *  - Tier 2: Boundary & Corner Cases (14 features × 5 = 70 tests)
 *  - Tier 3: Cross-Feature Combinations (14 tests)
 *  - Tier 4: Real-World Clinical Scenarios (7 tests)
 *
 * Total Test Count: 161 Tests
 */

import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import test suites
import { tier1FeedbackTests } from './e2e/tier1_feedback_features.mjs';
import { tier2FeedbackTests } from './e2e/tier2_feedback_boundaries.mjs';
import { tier3FeedbackTests } from './e2e/tier3_feedback_combinations.mjs';
import { tier4FeedbackTests } from './e2e/tier4_feedback_scenarios.mjs';

// Terminal formatting
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m',
  bgBlue: '\x1b[44m\x1b[37m',
};

// Parse command line arguments
const args = process.argv.slice(2);
let filterTier = null;
let filterFeature = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tier' && args[i + 1]) {
    filterTier = args[i + 1].split(',').map(Number);
    i++;
  } else if (args[i] === '--feature' && args[i + 1]) {
    filterFeature = args[i + 1].toLowerCase();
    i++;
  }
}

const tiers = [
  { tier: 1, name: 'Tier 1: Feature Coverage (Happy Path)', tests: tier1FeedbackTests },
  { tier: 2, name: 'Tier 2: Boundary & Corner Cases', tests: tier2FeedbackTests },
  { tier: 3, name: 'Tier 3: Cross-Feature Combinations', tests: tier3FeedbackTests },
  { tier: 4, name: 'Tier 4: Real-World Clinical Scenarios', tests: tier4FeedbackTests },
];

export async function runFeedbackTestSuite() {
  const startTime = performance.now();

  console.log(`\n${c.bold}${c.cyan}======================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}  Bignal (Body Signal) Mobile - Feedback 14 Features E2E Test Suite   ${c.reset}`);
  console.log(`${c.cyan}======================================================================${c.reset}`);
  console.log(`${c.dim}Environment : Node.js ${process.version} | Platform: ${process.platform}${c.reset}`);
  console.log(`${c.dim}Execution   : Feedback-Driven Verification (F1-F14, Tiers 1-4)${c.reset}\n`);

  let totalPassed = 0;
  let totalFailed = 0;
  const tierResults = [];
  const failures = [];

  for (const { tier, name, tests } of tiers) {
    if (filterTier && !filterTier.includes(tier)) {
      continue;
    }

    let filteredTests = tests;
    if (filterFeature) {
      filteredTests = tests.filter((t) => {
        const featMatch = t.feature && t.feature.toLowerCase().includes(filterFeature);
        const featsMatch = t.features && t.features.some((f) => f.toLowerCase().includes(filterFeature));
        const idMatch = t.id && t.id.toLowerCase().includes(filterFeature);
        return featMatch || featsMatch || idMatch;
      });
    }

    if (filteredTests.length === 0) continue;

    console.log(`${c.bold}${c.blue}▶ ${name}${c.reset} ${c.dim}(${filteredTests.length} tests)${c.reset}`);

    let tierPassed = 0;
    let tierFailed = 0;
    const tierStartTime = performance.now();

    for (const test of filteredTests) {
      const t0 = performance.now();
      try {
        await test.run();
        const duration = (performance.now() - t0).toFixed(1);
        console.log(`  ${c.green}✓${c.reset} ${c.cyan}[${test.id}]${c.reset} ${test.name} ${c.dim}(${duration}ms)${c.reset}`);
        tierPassed++;
        totalPassed++;
      } catch (err) {
        const duration = (performance.now() - t0).toFixed(1);
        console.log(`  ${c.red}✗${c.reset} ${c.red}[${test.id}]${c.reset} ${test.name} ${c.dim}(${duration}ms)${c.reset}`);
        console.log(`    ${c.red}Error: ${err.message}${c.reset}`);
        tierFailed++;
        totalFailed++;
        failures.push({ tier, test, error: err });
      }
    }

    const tierDuration = ((performance.now() - tierStartTime) / 1000).toFixed(2);
    tierResults.push({
      tier,
      name,
      total: filteredTests.length,
      passed: tierPassed,
      failed: tierFailed,
      duration: tierDuration,
    });
    console.log();
  }

  const totalDuration = ((performance.now() - startTime) / 1000).toFixed(2);

  // Summary Table
  console.log(`${c.bold}${c.cyan}----------------------------------------------------------------------${c.reset}`);
  console.log(`${c.bold}FEEDBACK E2E TEST EXECUTION SUMMARY (F1 - F14)${c.reset}`);
  console.log(`${c.cyan}----------------------------------------------------------------------${c.reset}`);
  console.log(` ${'Tier Name'.padEnd(46)} | ${'Total'.padStart(5)} | ${'Pass'.padStart(5)} | ${'Fail'.padStart(5)} | ${'Time'.padStart(6)}`);
  console.log(` ${'-'.repeat(46)} | ${'-'.repeat(5)} | ${'-'.repeat(5)} | ${'-'.repeat(5)} | ${'-'.repeat(6)}`);

  for (const r of tierResults) {
    const statusColor = r.failed === 0 ? c.green : c.red;
    console.log(
      ` ${r.name.padEnd(46)} | ${String(r.total).padStart(5)} | ${statusColor}${String(r.passed).padStart(5)}${c.reset} | ${r.failed > 0 ? c.red : c.dim}${String(r.failed).padStart(5)}${c.reset} | ${r.duration.padStart(5)}s`
    );
  }

  console.log(` ${'-'.repeat(46)} | ${'-'.repeat(5)} | ${'-'.repeat(5)} | ${'-'.repeat(5)} | ${'-'.repeat(6)}`);
  const finalColor = totalFailed === 0 ? c.green : c.red;
  console.log(
    ` ${c.bold}${'TOTAL ACROSS ALL TIERS'.padEnd(46)}${c.reset} | ${String(totalPassed + totalFailed).padStart(5)} | ${finalColor}${String(totalPassed).padStart(5)}${c.reset} | ${totalFailed > 0 ? c.red : c.dim}${String(totalFailed).padStart(5)}${c.reset} | ${totalDuration.padStart(5)}s`
  );
  console.log(`${c.cyan}----------------------------------------------------------------------${c.reset}`);

  // Feature Checklist (14 Feedback Features)
  console.log(`\n${c.bold}Feedback Feature Inventory Coverage (14 Features):${c.reset}`);
  const feedbackFeatures = [
    { code: 'F1', name: 'F1. Full-Bleed PIN Setup Modal' },
    { code: 'F2', name: 'F2. Biometric Passkey Unlock' },
    { code: 'F3', name: 'F3. Ergonomic Keypad Redesign' },
    { code: 'F4', name: 'F4. Real-Time Dynamic Theme Sync' },
    { code: 'F5', name: 'F5. Dynamic Medication Prompt Linking' },
    { code: 'F6', name: 'F6. In-Flow Medication Management' },
    { code: 'F7', name: 'F7. System Font Scale Inheritance' },
    { code: 'F8', name: 'F8. Standard Symptom Logging Stability' },
    { code: 'F9', name: 'F9. Dashboard Entry Streamlining' },
    { code: 'F10', name: 'F10. Multi-Region Body Map Selection' },
    { code: 'F11', name: 'F11. Local AI Disconnection Guard' },
    { code: 'F12', name: 'F12. Department-Categorized Briefing' },
    { code: 'F13', name: 'F13. System-Linked Haptics Enforcement' },
    { code: 'F14', name: 'F14. Android SDK 34 Compliance & APK Rebuild' },
  ];

  for (const feat of feedbackFeatures) {
    const codeRegex = new RegExp(`\\b${feat.code}\\b`);
    const featFailures = failures.filter((f) => {
      const featStr = f.test.feature || '';
      const featsArr = f.test.features || [];
      return codeRegex.test(featStr) || featsArr.includes(feat.code);
    });
    const symbol = featFailures.length === 0 ? `${c.green}✓ PASS${c.reset}` : `${c.red}✗ FAIL${c.reset}`;
    console.log(`  ${symbol}  ${feat.name}`);
  }

  console.log();
  if (totalFailed === 0) {
    console.log(`${c.bgGreen}${c.bold} SUCCESS ${c.reset} All ${totalPassed} Feedback E2E tests passed cleanly!\n`);
    return { success: true, totalPassed, totalFailed };
  } else {
    console.log(`${c.bgRed}${c.bold} FAILURE ${c.reset} ${totalFailed} of ${totalPassed + totalFailed} tests failed.\n`);
    return { success: false, totalPassed, totalFailed };
  }
}

// If executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith('run-feedback-tests.mjs')) {
  runFeedbackTestSuite()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('\nFatal runner error:', err);
      process.exit(1);
    });
}
