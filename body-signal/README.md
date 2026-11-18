# Body Signal (`body-signal`)

Frontend React/TypeScript web app and Capacitor Android project for **Body Signal (Bignal)** (`com.bodysignal.app`, `v2.0.1`).

See the root [README.md](../README.md) for the full project overview, security architecture, and F-Droid metadata links.

## Tech Stack

- **UI & Charts**: React 19, TypeScript, Tailwind CSS, `lucide-react`, `recharts`
- **Local Storage & Validation**: IndexedDB (`idb`), Zod (`zod`), Web Crypto AES-GCM 256 / PBKDF2
- **Native Shell**: Capacitor 8 (`@capacitor/android`, `@capacitor/app`, `@capacitor/haptics`, `@capacitor/local-notifications`)

## Common Scripts

```bash
npm ci
npm run dev          # Local development server
npm run lint         # ESLint check
npx tsc --noEmit     # TypeScript type check
npm run build        # Production web bundle -> dist/
npx cap sync android # Sync web bundle into android/

# Verification Suites
node test/security_hardening_test.mjs
node scripts/test-m3-security.mjs
npm run test:data
npm run test:e2e
```
