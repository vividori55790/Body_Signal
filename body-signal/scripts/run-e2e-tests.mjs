#!/usr/bin/env node

/**
 * Bignal Mobile App - Comprehensive End-to-End (E2E) Test Suite Runner
 *
 * Tiers:
 *  - Tier 1: Feature Coverage (Happy Path, 15 features × ≥5 = ≥75 tests)
 *  - Tier 2: Boundary & Corner Cases (Limits, Empty Inputs, Malformed Data, 15 features × ≥5 = ≥75 tests)
 *  - Tier 3: Cross-Feature Combinations (Pairwise State & Workflow Combinations, ≥15 tests)
 *  - Tier 4: Real-World Clinical Scenarios (5 Realistic Clinical Workflows)
 *
 * Total Test Count: 170 Tests
 */

import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import test suites
import { tier1Tests } from '../src/test/e2e/tier1_features.mjs';
import { tier2Tests } from '../src/test/e2e/tier2_boundaries.mjs';
import { tier3Tests } from '../src/test/e2e/tier3_combinations.mjs';
import { tier4Tests } from '../src/test/e2e/tier4_scenarios.mjs';

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
  { tier: 1, name: 'Tier 1: Feature Coverage (Happy Path)', tests: tier1Tests },
  { tier: 2, name: 'Tier 2: Boundary & Corner Cases', tests: tier2Tests },
  { tier: 3, name: 'Tier 3: Cross-Feature Combinations', tests: tier3Tests },
  { tier: 4, name: 'Tier 4: Real-World Clinical Scenarios', tests: tier4Tests },
];

async function runTestSuite() {
  const startTime = performance.now();

  console.log(`\n${c.bold}${c.cyan}======================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}     Bignal (Body Signal) Mobile - Production E2E Test Suite     ${c.reset}`);
  console.log(`${c.cyan}======================================================================${c.reset}`);
  console.log(`${c.dim}Environment : Node.js ${process.version} | Platform: ${process.platform}${c.reset}`);
  console.log(`${c.dim}Execution   : Opaque-Box, Requirement-Driven Verification (Tiers 1-4)${c.reset}\n`);

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
      filteredTests = tests.filter(
        (t) =>
          t.feature.toLowerCase().includes(filterFeature) ||
          t.id.toLowerCase().includes(filterFeature)
      );
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
  console.log(`${c.bold}E2E TEST EXECUTION SUMMARY${c.reset}`);
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

  // Feature Checklist (15 Features)
  console.log(`\n${c.bold}Feature Inventory Coverage (15 Features):${c.reset}`);
  const features = [
    'R1.1 Acute Pain Mode Large Touch UI',
    'R1.2 Dashboard Top Rapid Integration',
    'R1.3 Medication Response 1-Tap Tracking',
    'R2.1 Android App Shortcuts',
    'R2.2 Web App Manifest Shortcuts',
    'R2.3 In-App Floating SOS Widget',
    'R3.1 On-Device AES-GCM 256 Encryption',
    'R3.2 SHA-256 Data Integrity Signatures',
    'R3.3 Auto-lock & App Switcher Masking',
    'R4.1 Local LLM Network Adapter',
    'R4.2 Settings Screen Config UI',
    'R4.3 Real-Time SSE/NDJSON Streaming',
    'R5.1 TypeScript Integrity Verification',
    'R5.2 Capacitor Android Sync & Build',
    'R5.3 Android APK Output Verification',
  ];

  for (const feat of features) {
    const featFailures = failures.filter((f) => f.test.feature && f.test.feature.includes(feat.split(' ')[0]));
    const symbol = featFailures.length === 0 ? `${c.green}✓ PASS${c.reset}` : `${c.red}✗ FAIL${c.reset}`;
    console.log(`  ${symbol}  ${feat}`);
  }

  console.log();
  if (totalFailed === 0) {
    console.log(`${c.bgGreen}${c.bold} SUCCESS ${c.reset} All ${totalPassed} E2E tests passed cleanly! Ready for deployment.\n`);
    process.exit(0);
  } else {
    console.log(`${c.bgRed}${c.bold} FAILURE ${c.reset} ${totalFailed} of ${totalPassed + totalFailed} tests failed. Please review errors above.\n`);
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('\nFatal runner error:', err);
  process.exit(1);
});
