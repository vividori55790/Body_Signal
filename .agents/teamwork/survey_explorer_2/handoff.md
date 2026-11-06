# Handoff Report: Survey Explorer 2 (Requirement R2)

**Agent**: `survey_explorer_2`  
**Working Directory**: `c:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\.agents\teamwork\survey_explorer_2`  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Android App Shortcuts Definition**:
   - `body-signal/android/app/src/main/res/xml/shortcuts.xml`:
     Lines 1–42 define 3 shortcuts: `acute_pain`, `clinical_briefing`, `quick_med`.
     Lines 14, 27, 40 contain `<categories android:name="android.shortcut.conversation" />`.
     Intents target package `com.bodysignal.app` and class `com.bodysignal.app.MainActivity` with data URIs:
     - `https://localhost/?mode=acute`
     - `https://localhost/briefing`
     - `https://localhost/entry`
   - `body-signal/android/app/src/main/res/values/strings.xml`:
     Lines 7–12 define strings `shortcut_acute_short`, `shortcut_acute_long`, `shortcut_briefing_short`, `shortcut_briefing_long`, `shortcut_med_short`, `shortcut_med_long`.
   - `body-signal/android/app/src/main/AndroidManifest.xml`:
     Lines 25–30 declare `<intent-filter>` for scheme `https`, host `localhost`.
     Lines 32–35 declare `<meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />`.
   - `body-signal/android/app/src/main/java/com/bodysignal/app/MainActivity.java`:
     Line 5: `public class MainActivity extends BridgeActivity {}` with no custom intent handling.

2. **Capacitor Dependencies & Bridge**:
   - `body-signal/package.json`:
     Dependencies include `@capacitor/android: ^8.0.0`, `@capacitor/core: ^8.0.0`, `@capacitor/haptics: ^8.0.2`, `@capacitor/local-notifications: ^8.3.1`.
     `@capacitor/app` is **not present** in `package.json`.
   - `body-signal/android/app/src/main/assets/capacitor.plugins.json`:
     Lines 1–10 list only `@capacitor/haptics` and `@capacitor/local-notifications`.
   - `body-signal/node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/Bridge.java`:
     Line 229: `this.intentUri = intent.getData();`
     Line 620: `appUrl = localUrl;` (`"https://localhost"`)
     Line 278: `webView.loadUrl(appUrl);`
     Line 1301–1303: In `onNewIntent(intent)`, iterates registered plugins `plugin.getInstance().handleOnNewIntent(intent)`.

3. **Web App Manifest Shortcuts**:
   - `body-signal/vite.config.js`:
     Lines 33–55 define `manifest.shortcuts` array with `1초 급성 통증 기록` (`/?mode=acute`), `의료진 진료 브리핑` (`/briefing`), `빠른 복약 기록` (`/entry`).
   - `body-signal/dist/manifest.webmanifest`:
     Contains the serialized shortcuts matching `vite.config.js`.
   - `body-signal/dist/index.html`:
     Line 15: `<link rel="manifest" href="./manifest.webmanifest"><script id="vite-plugin-pwa:register-sw" src="./registerSW.js"></script>`.

4. **In-App Floating SOS Widget & Acute Pain Modal**:
   - `body-signal/src/App.tsx`:
     Lines 26–43 wrap `<AcutePainProvider>` around `<Routes>`, where `<Route element={<Layout />}>` encapsulates all routes.
   - `body-signal/src/components/Layout.tsx`:
     Lines 28–43 render floating SOS button `fixed bottom-20 right-4 z-40`:
     ```tsx
     {settings.quickSosEnabled !== false && (
       <aside aria-label="1초 급성 통증 기록 위젯" className="fixed bottom-20 right-4 z-40 max-w-md mx-auto">
         <button
           type="button"
           onClick={() => {
             triggerHaptic();
             openAcute();
           }}
           ...
     ```
   - `body-signal/src/context/AcutePainContext.tsx`:
     Lines 25–30 monitor `location.search` (`?mode=acute`) and `location.pathname` (`/acute`) to open modal.
     Line 49 renders `<AcutePainMode onClose={closeAcute} />` when `isOpen` is true.
   - `body-signal/src/types/health.ts` Line 75 & `body-signal/src/utils/storage.ts` Line 38 define `quickSosEnabled: true`.
   - `body-signal/src/pages/Settings.tsx`: No toggle UI is currently rendered for `quickSosEnabled`.

---

## 2. Logic Chain

1. From Observation 1 & 2:
   - Android launcher reads `shortcuts.xml` and delivers an `android.intent.action.VIEW` intent to `MainActivity` with data `https://localhost/?mode=acute`.
   - However, Capacitor's `BridgeActivity` loads the base `https://localhost` on launch without appending intent query parameters.
   - On warm start (`onNewIntent`), Bridge notifies plugins via `handleOnNewIntent(intent)`.
   - Because `@capacitor/app` is not installed (Observation 2), no plugin handles the intent, and React Router never receives the target route or query.
   - Therefore, while Android App Shortcuts are statically registered in XML, they cannot navigate inside the app without `@capacitor/app` and an intent listener in React.
2. From Observation 1:
   - `<categories android:name="android.shortcut.conversation" />` is intended exclusively for communication/chat apps (Android 11 conversation bubbles). Non-messaging shortcuts should omit conversation categories to ensure launcher compatibility across Android versions.
3. From Observation 3 & 4:
   - For Web App Manifest / PWA, shortcuts are already fully generated and functional. Clicking `/?mode=acute` in a browser triggers `AcutePainContext.tsx` lines 25–30, rendering `<AcutePainMode />`.
4. From Observation 4:
   - The in-app floating SOS widget is already present in `Layout.tsx` across all application routes. Tapping it calls `openAcute()`, which triggers `<AcutePainMode />` modal overlay.
   - However, `Settings.tsx` lacks a user-facing toggle to control `quickSosEnabled`, even though the schema supports it.

---

## 3. Caveats

- We did not test dynamic shortcuts programmatically via `ShortcutManagerCompat.pushDynamicShortcut` since the requirement specifies static/XML-based shortcuts and Web App Manifest shortcuts.
- We did not modify any source code or install packages in accordance with our read-only explorer role.
- Android APK build environment requires JDK 17 and Android SDK 34 (as specified in `build_apk_local.ps1` and `build_apk.ps1`).

---

## 4. Conclusion

1. **Android App Shortcuts**: Needs two straightforward additions:
   - Remove `<categories android:name="android.shortcut.conversation" />` from `android/app/src/main/res/xml/shortcuts.xml`.
   - Install `@capacitor/app` (`^8.0.0`) and create a `DeepLinkHandler` component in React to bridge `App.getLaunchUrl()` and `App.addListener('appUrlOpen')` into `useNavigate()`.
2. **Web App Manifest**: Fully compliant and operational. No changes required.
3. **In-App Floating SOS Widget**: The floating widget in `Layout.tsx` and modal in `AcutePainMode.tsx` are already implemented and functional across all routes. To complete user customization, add a toggle for `quickSosEnabled` in `pages/Settings.tsx`.

---

## 5. Verification Method

1. **Inspect Configuration & Code**:
   - Verify `shortcuts.xml` lines without conversation categories.
   - Check `package.json` for `@capacitor/app`.
   - Inspect `App.tsx` for `<DeepLinkHandler />`.
2. **Build and Type Check**:
   - Run `npx tsc --noEmit` in `body-signal` (expected: 0 errors).
   - Run `npm run build` in `body-signal` (expected: bundle succeeds, `dist/manifest.webmanifest` contains shortcuts).
   - Run `npx cap sync android` in `body-signal` (expected: `@capacitor/app` registered in `capacitor.plugins.json`).
3. **Android Intent Emulation**:
   - Using ADB:
     ```bash
     adb shell am start -a android.intent.action.VIEW -d "https://localhost/?mode=acute" com.bodysignal.app
     adb shell am start -a android.intent.action.VIEW -d "https://localhost/briefing" com.bodysignal.app
     ```
   - Invalidation condition: If the app remains on `/` without opening `AcutePainMode` or navigating to `/briefing`, the deep link bridge is not functioning.
