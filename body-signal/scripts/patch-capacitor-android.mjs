import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nmCapacitor = path.resolve(__dirname, '..', 'node_modules', '@capacitor');

// 1. Patch SystemBars.java (Android 15 VANILLA_ICE_CREAM constant -> numeric API 35 for compileSdk 34)
const systemBarsPath = path.join(
  nmCapacitor,
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

if (fs.existsSync(systemBarsPath)) {
  const src = fs.readFileSync(systemBarsPath, 'utf8');
  const next = src.replaceAll('Build.VERSION_CODES.VANILLA_ICE_CREAM', '35');
  if (next !== src) {
    fs.writeFileSync(systemBarsPath, next, 'utf8');
    console.log('[postinstall] Patched SystemBars.java (VANILLA_ICE_CREAM -> 35).');
  }
}

// 2. Align Java/Kotlin JVM target (21 -> 17) across Capacitor Android plugin Gradle files
const gradleRelPaths = [
  path.join('android', 'capacitor', 'build.gradle'),
  path.join('app', 'android', 'build.gradle'),
  path.join('haptics', 'android', 'build.gradle'),
  path.join('local-notifications', 'android', 'build.gradle'),
];

for (const rel of gradleRelPaths) {
  const gradlePath = path.join(nmCapacitor, rel);
  if (!fs.existsSync(gradlePath)) continue;

  const src = fs.readFileSync(gradlePath, 'utf8');
  const next = src
    .replaceAll('JavaVersion.VERSION_21', 'JavaVersion.VERSION_17')
    .replaceAll('jvmToolchain(21)', 'jvmToolchain(17)')
    .replace(
      /^[ \t]*publishing\s*\{\s*\r?\n[ \t]*singleVariant\("release"\)\s*\r?\n[ \t]*\}/gm,
      '    // publishing {\n    //     singleVariant("release")\n    // }'
    );

  if (next !== src) {
    fs.writeFileSync(gradlePath, next, 'utf8');
    console.log(`[postinstall] Patched ${rel} (JVM 21 -> 17).`);
  }
}
