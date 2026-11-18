import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@capacitor',
  'android',
  'capacitor',
  'src',
  'main',
  'java',
  'com',
  'getcapacitor',
  'plugin',
  'SystemBars.java'
);

if (!fs.existsSync(target)) {
  console.log('[postinstall] SystemBars.java not found; skipping patch.');
  process.exit(0);
}

const original = fs.readFileSync(target, 'utf8');
const token = 'Build.VERSION_CODES.VANILLA_ICE_CREAM';

if (!original.includes(token)) {
  console.log('[postinstall] SystemBars.java already compatible with compileSdk 34.');
  process.exit(0);
}

const patched = original.replaceAll(token, '35');
fs.writeFileSync(target, patched, 'utf8');
console.log('[postinstall] Patched SystemBars.java (VANILLA_ICE_CREAM -> 35) for compileSdk 34.');
