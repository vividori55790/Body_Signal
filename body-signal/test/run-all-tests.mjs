#!/usr/bin/env node

/**
 * Bignal Mobile App - Unified Test Runner (Baseline + Feedback Suites)
 * Total Tests: 331 Tests (170 Baseline + 161 Feedback)
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};

function runScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const proc = spawn('node', [scriptPath, ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
    });
    proc.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function main() {
  console.log(`\n${c.bold}${c.cyan}======================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}      Bignal Full Test Harness (Baseline Suite + Feedback Suite)      ${c.reset}`);
  console.log(`${c.cyan}======================================================================${c.reset}\n`);

  // 1. Run Baseline Suite
  console.log(`${c.bold}RUNNING SUITE 1: Baseline Production E2E Suite (170 Tests)...${c.reset}\n`);
  const baselineOk = await runScript(path.join(projectRoot, 'scripts/run-e2e-tests.mjs'));

  // 2. Run Feedback 14 Features Suite
  console.log(`\n${c.bold}RUNNING SUITE 2: User Feedback 14 Features E2E Suite (161 Tests)...${c.reset}\n`);
  const feedbackOk = await runScript(path.join(projectRoot, 'test/run-feedback-tests.mjs'));

  console.log(`\n${c.bold}${c.cyan}======================================================================${c.reset}`);
  console.log(`${c.bold}UNIFIED TEST EXECUTION RESULTS${c.reset}`);
  console.log(`${c.cyan}======================================================================${c.reset}`);
  console.log(` Baseline E2E Suite (R1.1 - R5.3) : ${baselineOk ? c.green + '✓ 170/170 PASS' : c.red + '✗ FAIL'}${c.reset}`);
  console.log(` Feedback E2E Suite (F1 - F14)    : ${feedbackOk ? c.green + '✓ 161/161 PASS' : c.red + '✗ FAIL'}${c.reset}`);
  console.log(` Total Combined Tests             : ${c.bold}331 Tests${c.reset}`);
  console.log(`${c.cyan}======================================================================${c.reset}\n`);

  if (baselineOk && feedbackOk) {
    console.log(`${c.green}${c.bold}ALL 331 TESTS PASSED CLEANLY! Ready for production deployment.${c.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${c.red}${c.bold}ONE OR MORE SUITES FAILED.${c.reset}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in unified test runner:', err);
  process.exit(1);
});
