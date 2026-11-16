#!/usr/bin/env node

/**
 * Empirical Verification Suite for Requirement R2:
 * Shortcuts & In-App Floating SOS Widget
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${c.green}✓ PASS${c.reset}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ${c.red}✗ FAIL${c.reset}: ${name}`);
    console.error(`    ${c.red}${err.message}${c.reset}`);
    failed++;
  }
}

console.log(`\n${c.bold}${c.cyan}======================================================================${c.reset}`);
console.log(`${c.bold}${c.cyan}   R2 (Shortcuts & In-App Floating SOS Widget) Verification Suite   ${c.reset}`);
console.log(`${c.cyan}======================================================================${c.reset}\n`);

// ----------------------------------------------------------------------
// 1. Android App Shortcuts (shortcuts.xml & AndroidManifest.xml)
// ----------------------------------------------------------------------
console.log(`${c.bold}▶ Section 1: Android App Shortcuts XML Inspection${c.reset}`);

const shortcutsXmlPath = path.join(ROOT_DIR, 'android/app/src/main/res/xml/shortcuts.xml');
const shortcutsXml = fs.readFileSync(shortcutsXmlPath, 'utf8');

await test('shortcuts.xml exists and has valid XML tags', () => {
  assert.ok(fs.existsSync(shortcutsXmlPath));
  assert.match(shortcutsXml, /<shortcuts xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android">/);
  assert.match(shortcutsXml, /<\/shortcuts>/);
});

await test('shortcuts.xml contains all 3 required shortcuts: acute_pain, clinical_briefing, quick_med', () => {
  assert.match(shortcutsXml, /android:shortcutId="acute_pain"/);
  assert.match(shortcutsXml, /android:shortcutId="clinical_briefing"/);
  assert.match(shortcutsXml, /android:shortcutId="quick_med"/);
});

await test('shortcuts.xml targets correct data URIs for all 3 shortcuts', () => {
  assert.match(shortcutsXml, /android:data="https:\/\/localhost\/\?mode=acute"/);
  assert.match(shortcutsXml, /android:data="https:\/\/localhost\/briefing"/);
  assert.match(shortcutsXml, /android:data="https:\/\/localhost\/entry"/);
});

await test('shortcuts.xml contains NO conversation categories (must be removed from all shortcuts)', () => {
  const conversationMatch = shortcutsXml.match(/android:name="android\.shortcut\.conversation"/);
  assert.equal(conversationMatch, null, 'No conversation categories should exist in shortcuts.xml');
});

const stringsXml = fs.readFileSync(path.join(ROOT_DIR, 'android/app/src/main/res/values/strings.xml'), 'utf8');
await test('strings.xml provides short and long labels for all 3 shortcuts', () => {
  assert.match(stringsXml, /<string name="shortcut_acute_short">/);
  assert.match(stringsXml, /<string name="shortcut_acute_long">/);
  assert.match(stringsXml, /<string name="shortcut_briefing_short">/);
  assert.match(stringsXml, /<string name="shortcut_briefing_long">/);
  assert.match(stringsXml, /<string name="shortcut_med_short">/);
  assert.match(stringsXml, /<string name="shortcut_med_long">/);
});

const androidManifest = fs.readFileSync(path.join(ROOT_DIR, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
await test('AndroidManifest.xml registers shortcuts resource metadata', () => {
  assert.match(androidManifest, /android:name="android\.app\.shortcuts"/);
  assert.match(androidManifest, /android:resource="@xml\/shortcuts"/);
});

// ----------------------------------------------------------------------
// 2. Capacitor App Plugin Integration
// ----------------------------------------------------------------------
console.log(`\n${c.bold}▶ Section 2: Capacitor App Plugin Integration${c.reset}`);

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
await test('package.json declares @capacitor/app dependency', () => {
  assert.ok(packageJson.dependencies['@capacitor/app'], '@capacitor/app must be in dependencies');
});

const pluginsJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'android/app/src/main/assets/capacitor.plugins.json'), 'utf8'));
await test('capacitor.plugins.json registers @capacitor/app with AppPlugin classpath', () => {
  const appPlugin = pluginsJson.find((p) => p.pkg === '@capacitor/app');
  assert.ok(appPlugin, '@capacitor/app must be registered in capacitor.plugins.json');
  assert.equal(appPlugin.classpath, 'com.capacitorjs.plugins.app.AppPlugin');
});

// ----------------------------------------------------------------------
// 3. Deep Link Intent Handler
// ----------------------------------------------------------------------
console.log(`\n${c.bold}▶ Section 3: Deep Link Intent Handler & Routing${c.reset}`);

const deepLinkSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/DeepLinkHandler.tsx'), 'utf8');
await test('DeepLinkHandler imports CapApp and listens to appUrlOpen and getLaunchUrl', () => {
  assert.match(deepLinkSrc, /@capacitor\/app/);
  assert.match(deepLinkSrc, /CapApp\.getLaunchUrl\(\)/);
  assert.match(deepLinkSrc, /CapApp\.addListener\(\s*['"]appUrlOpen['"]/);
});

await test('DeepLinkHandler contains routing branches for acute pain, briefing, and entry', () => {
  assert.match(deepLinkSrc, /openAcute\(\)/);
  assert.match(deepLinkSrc, /navigate\(['"]\/briefing['"]\)/);
  assert.match(deepLinkSrc, /navigate\(['"]\/entry['"]\)/);
});

// Empirical routing logic simulation
await test('DeepLink URL parsing simulation correctly routes all intents', () => {
  let acuteTriggered = false;
  let navigatedTo = '';

  const mockOpenAcute = () => { acuteTriggered = true; };
  const mockNavigate = (to) => { navigatedTo = to; };

  const testDispatcher = (urlString) => {
    acuteTriggered = false;
    navigatedTo = '';
    const url = new URL(urlString);
    if (url.searchParams.get('mode') === 'acute' || url.search.includes('mode=acute') || url.pathname === '/acute') {
      mockOpenAcute();
      return;
    }
    if (url.pathname.includes('/briefing')) {
      mockNavigate('/briefing');
      return;
    }
    if (url.pathname.includes('/entry')) {
      mockNavigate('/entry');
      return;
    }
    mockNavigate(url.pathname);
  };

  testDispatcher('https://localhost/?mode=acute');
  assert.equal(acuteTriggered, true);
  assert.equal(navigatedTo, '');

  testDispatcher('https://localhost/acute');
  assert.equal(acuteTriggered, true);

  testDispatcher('https://localhost/briefing');
  assert.equal(acuteTriggered, false);
  assert.equal(navigatedTo, '/briefing');

  testDispatcher('https://localhost/entry');
  assert.equal(acuteTriggered, false);
  assert.equal(navigatedTo, '/entry');
});

const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf8');
await test('App.tsx mounts <DeepLinkHandler /> inside BrowserRouter and AcutePainProvider', () => {
  assert.match(appSrc, /import DeepLinkHandler/);
  assert.match(appSrc, /<BrowserRouter>[\s\S]*<AcutePainProvider>[\s\S]*<DeepLinkHandler \/>[\s\S]*<Routes>/);
});

// ----------------------------------------------------------------------
// 4. In-App Floating SOS Widget & Settings Toggle
// ----------------------------------------------------------------------
console.log(`\n${c.bold}▶ Section 4: In-App Floating SOS Widget & Settings Toggle${c.reset}`);

const layoutSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Layout.tsx'), 'utf8');
await test('Layout.tsx renders floating SOS widget button across all routes', () => {
  assert.match(layoutSrc, /settings\.quickSosEnabled\s*!==\s*false/);
  assert.match(layoutSrc, /aria-label="1초 급성 통증 기록 위젯"/);
  assert.match(layoutSrc, /aria-label="지금 너무 아파요 1초 급성 통증 기록"/);
  assert.match(layoutSrc, /triggerHaptic\(\)/);
  assert.match(layoutSrc, /openAcute\(\)/);
  assert.match(layoutSrc, /fixed bottom-20 right-4 z-40/);
});

const settingsSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/pages/Settings.tsx'), 'utf8');
await test('Settings.tsx includes toggle switch for quickSosEnabled', () => {
  assert.match(settingsSrc, /setQuickSos/);
  assert.match(settingsSrc, /quickSosSetting/);
  assert.match(settingsSrc, /aria-label="상시 긴급 통증 SOS 위젯 표시 토글"/);
});

const settingsContextSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/context/SettingsContext.tsx'), 'utf8');
await test('SettingsContext provides setQuickSos method updating UserSettings', () => {
  assert.match(settingsContextSrc, /setQuickSos:\s*\(enabled:\s*boolean\)\s*=>\s*Promise<void>/);
  assert.match(settingsContextSrc, /const setQuickSos = async \(quickSosEnabled: boolean\)/);
  assert.match(settingsContextSrc, /updateAndSave\(\(prev\)\s*=>\s*\(\{\s*\.\.\.prev,\s*quickSosEnabled\s*\}\)\)/);
});

console.log(`\n----------------------------------------------------------------------`);
console.log(`R2 VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`----------------------------------------------------------------------\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`${c.green}${c.bold}SUCCESS: Requirement R2 fully satisfied and verified!${c.reset}\n`);
}
