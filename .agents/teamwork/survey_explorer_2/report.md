# Survey Report: Android Shortcuts, Web App Manifest & Floating SOS Widget (Requirement R2)

**Author**: Survey Explorer 2 (`survey_explorer_2`)  
**Date**: 2026-11-06  
**Scope**: Requirement R2 (Android App Shortcuts, Web App Manifest shortcuts, In-App Floating SOS widget overlay) & Capacitor/Android project architecture.

---

## 1. Executive Summary

This investigation analyzed the complete architecture supporting **Requirement R2**:
- **Android App Shortcuts** (`res/xml/shortcuts.xml`, `AndroidManifest.xml`, `MainActivity.java`, Capacitor Bridge)
- **Web App Manifest Shortcuts** (`vite.config.js`, `manifest.webmanifest`, `index.html`)
- **Deep Linking & Intent Routing** (Intent data URL dispatch from Android native into React Router)
- **In-App Floating SOS Widget** (`Layout.tsx`, `AcutePainContext.tsx`, `AcutePainMode.tsx`, `Settings.tsx`)

### Key Findings
1. **Web App Manifest Shortcuts**: Fully configured in `vite.config.js` with 3 shortcuts (`/?mode=acute`, `/briefing`, `/entry`). Generated properly into `dist/manifest.webmanifest` and injected into `dist/index.html`. In standalone PWA browser mode, clicking shortcuts navigates directly into routes and triggers `AcutePainMode` modal.
2. **Android Native Static Shortcuts**: Defined in `android/app/src/main/res/xml/shortcuts.xml` and referenced in `AndroidManifest.xml`. However:
   - **Critical Category Issue**: `<categories android:name="android.shortcut.conversation" />` is incorrectly placed on general shortcuts; standard Android shortcuts should omit conversation category to avoid launcher filtering issues.
   - **Missing Deep Linking Bridge (`@capacitor/app`)**: Neither `MainActivity.java` nor React JS connects native intent URLs to React Router. `@capacitor/app` is **not installed** in `package.json`, meaning when a user taps an Android home screen shortcut, the app either launches into `/` without query parameters or ignores the intent on warm start (`singleTask`).
3. **In-App Floating SOS Widget**: Implemented in `Layout.tsx` lines 28–43.
   - Positioned fixed at `bottom-20 right-4 z-40` directly above the 56px bottom navigation bar.
   - Guarded by `settings.quickSosEnabled !== false` (defaults to `true`).
   - Tapping invokes `triggerHaptic()` and `openAcute()`, which triggers `<AcutePainMode onClose={closeAcute} />` in `AcutePainContext.tsx` across all nested routes (`/`, `/acute`, `/calendar`, `/history`, `/briefing`, `/entry`, `/condition/:id`, `/settings`).
   - Minor gap: `pages/Settings.tsx` lacks a UI toggle switch for `quickSosEnabled`, although the schema and storage default already support it.

---

## 2. Codebase & Configuration Inspection

### 2.1 Project Structure & Workspace
The actual mobile web & Capacitor application is situated under the `body-signal` directory:
- `body-signal/package.json`: Contains React 19, React Router v7, `@capacitor/android ^8.0.0`, `@capacitor/core ^8.0.0`, `@capacitor/haptics ^8.0.2`, `@capacitor/local-notifications ^8.3.1`, `vite-plugin-pwa ^1.2.0`.
- `body-signal/capacitor.config.json`:
  ```json
  {
    "appId": "com.bodysignal.app",
    "appName": "Body Signal",
    "webDir": "dist",
    "bundledWebRuntime": false
  }
  ```
- `body-signal/android/`: Complete Android Gradle project with wrapper `gradlew`, targeting compileSdk 34 and AndroidX.

### 2.2 Android Shortcuts & Manifest Configuration

#### A. `android/app/src/main/res/xml/shortcuts.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
    <shortcut
        android:shortcutId="acute_pain"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="@string/shortcut_acute_short"
        android:shortcutLongLabel="@string/shortcut_acute_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="com.bodysignal.app"
            android:targetClass="com.bodysignal.app.MainActivity"
            android:data="https://localhost/?mode=acute" />
        <categories android:name="android.shortcut.conversation" />
    </shortcut>
    <shortcut
        android:shortcutId="clinical_briefing"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="@string/shortcut_briefing_short"
        android:shortcutLongLabel="@string/shortcut_briefing_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="com.bodysignal.app"
            android:targetClass="com.bodysignal.app.MainActivity"
            android:data="https://localhost/briefing" />
        <categories android:name="android.shortcut.conversation" />
    </shortcut>
    <shortcut
        android:shortcutId="quick_med"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="@string/shortcut_med_short"
        android:shortcutLongLabel="@string/shortcut_med_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="com.bodysignal.app"
            android:targetClass="com.bodysignal.app.MainActivity"
            android:data="https://localhost/entry" />
        <categories android:name="android.shortcut.conversation" />
    </shortcut>
</shortcuts>
```

#### B. `android/app/src/main/res/values/strings.xml`
```xml
    <string name="shortcut_acute_short">1초 통증 기록</string>
    <string name="shortcut_acute_long">🚨 1초 급성 통증 기록</string>
    <string name="shortcut_briefing_short">진료 브리핑</string>
    <string name="shortcut_briefing_long">🩺 의료진 진료 브리핑</string>
    <string name="shortcut_med_short">복약 기록</string>
    <string name="shortcut_med_long">💊 빠른 복약 기록</string>
```

#### C. `android/app/src/main/AndroidManifest.xml`
```xml
        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="localhost" />
            </intent-filter>

            <meta-data
                android:name="android.app.shortcuts"
                android:resource="@xml/shortcuts" />

        </activity>
```

#### D. `android/app/src/main/java/com/bodysignal/app/MainActivity.java`
```java
package com.bodysignal.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
```

---

## 3. Deep Linking & Shortcut Intent Call Chain Analysis

### 3.1 What Happens When an Android Shortcut is Pressed
1. User long-presses app icon on Android launcher. Launcher reads `shortcuts.xml` metadata.
2. User taps "🚨 1초 급성 통증 기록". Android creates an `Intent`:
   - Action: `android.intent.action.VIEW`
   - Data: `Uri.parse("https://localhost/?mode=acute")`
   - Target: `com.bodysignal.app.MainActivity`
3. If app is closed (cold launch):
   - `MainActivity.onCreate()` is called.
   - `Bridge.java:229`: `this.intentUri = intent.getData();`
   - `Bridge.java:620`: `appUrl = localUrl;` (`"https://localhost"`)
   - `Bridge.java:278`: `webView.loadUrl(appUrl);`
   - **Notice**: Bridge **does not** load `intentUri` directly into `webView.loadUrl()`! Bridge intentionally reserves `intentUri` for the `@capacitor/app` plugin's `App.getLaunchUrl()`.
4. If app is already running (warm launch):
   - Because `MainActivity` has `android:launchMode="singleTask"`, Android calls `onNewIntent(intent)`.
   - `BridgeActivity.onNewIntent(intent)` invokes `this.bridge.onNewIntent(intent)`.
   - `Bridge.java:1301`:
     ```java
     for (PluginHandle plugin : plugins.values()) {
         plugin.getInstance().handleOnNewIntent(intent);
     }
     ```
   - **Notice**: If `@capacitor/app` is not installed, no plugin handles `handleOnNewIntent(intent)`. The WebView stays untouched.

### 3.2 Solution for Intent Routing: Installing & Using `@capacitor/app`
In Capacitor architecture, the canonical method to bridge deep link URLs to JavaScript is `@capacitor/app`:
1. `npm install @capacitor/app@^8.0.0` inside `body-signal`.
2. Sync: `npx cap sync android`.
3. In React (`body-signal/src/components/DeepLinkHandler.tsx` or inside `App.tsx`):
```tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';

export const DeepLinkHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Cold start: check if launched with deep link URL
    CapApp.getLaunchUrl().then((launchUrl) => {
      if (launchUrl?.url) {
        handleUrl(launchUrl.url);
      }
    });

    // 2. Warm start: listen for onNewIntent URLs
    const sub = CapApp.addListener('appUrlOpen', (event) => {
      handleUrl(event.url);
    });

    return () => {
      sub.then((handle) => handle.remove());
    };
  }, [navigate]);

  const handleUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      const target = url.pathname + url.search;
      if (target && target !== '/') {
        navigate(target);
      }
    } catch {
      if (urlString.includes('mode=acute')) {
        navigate('/?mode=acute');
      } else if (urlString.includes('/briefing')) {
        navigate('/briefing');
      } else if (urlString.includes('/entry')) {
        navigate('/entry');
      }
    }
  };

  return null;
};
```
4. Place `<DeepLinkHandler />` inside `<BrowserRouter>` in `App.tsx`.

---

## 4. In-App Floating SOS Widget Overlay Architecture

### 4.1 Component Hierarchy
```
<SettingsProvider>
  <AuthProvider>
    <HealthProvider>
      <AppContent>
        <BrowserRouter>
          <AcutePainProvider>       <-- Renders <AcutePainMode /> overlay when isOpen is true
            <DeepLinkHandler />      <-- Captures shortcut intents & navigates
            <Routes>
              <Route element={<Layout />}>   <-- Layout renders Floating SOS Widget
                <Route path="/" element={<DashboardPage />} />
                <Route path="/acute" element={<DashboardPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/briefing" element={<ClinicalBriefingPage />} />
                <Route path="/entry" element={<EntryFormPage />} />
                <Route path="/condition/:id" element={<ConditionDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </AcutePainProvider>
        </BrowserRouter>
      </AppContent>
    </HealthProvider>
  </AuthProvider>
</SettingsProvider>
```

### 4.2 Floating SOS Widget in `Layout.tsx`
Lines 27–43:
```tsx
      {/* Floating Quick SOS Widget (Always accessible 1-sec acute pain logging) */}
      {settings.quickSosEnabled !== false && (
        <aside aria-label="1초 급성 통증 기록 위젯" className="fixed bottom-20 right-4 z-40 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              openAcute();
            }}
            aria-label="지금 너무 아파요 1초 급성 통증 기록"
            className="flex items-center gap-2 pl-3 pr-3.5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-xl shadow-rose-600/40 ring-2 ring-rose-300 dark:ring-rose-400 active:scale-95 transition-all"
          >
            <span className="flex h-2 w-2 rounded-full bg-white animate-ping" />
            <span>🚨 1초 긴급 기록</span>
          </button>
        </aside>
      )}
```

### 4.3 What Happens on Tap
1. `triggerHaptic()` sends light vibration to mobile device.
2. `openAcute()` is invoked on `AcutePainContext`.
3. `AcutePainContext.tsx` sets `isOpen = true`.
4. `<AcutePainMode onClose={closeAcute} />` mounts as a fullscreen modal (`fixed inset-0 z-50 flex flex-col bg-slate-900 ...`).
5. The UI features:
   - **NRS 1~10 Large Touch Buttons**: 10 big touch squares (`h-14 rounded-2xl font-black text-xl`) with color gradation (Green for 1-4, Amber for 5-7, Rose for 8-10).
   - **Top 6 Acute Body Part Quick Tiles**: 머리/두통, 목/경추, 어깨/등, 허리/요통, 무릎/관절, 배/복통.
   - **Medication Quick Select**: '안 먹음' vs '먹었음' toggle with common pain medication tags.
   - **Massive Bottom Action Bar**: `[NRS {intensity}점 • {selectedPart}] 즉시 저장하기`.
6. Tapping save:
   - Calls `saveEntry(payload)`.
   - Displays a confirmation checkmark animation for 1.6s.
   - Calls `onClose()`, resetting `isOpen = false` and cleaning up query params (`?mode=acute`).

### 4.4 Settings Integration
- `UserSettingsSchema` in `types/health.ts` defines `quickSosEnabled: z.boolean().default(true)`.
- `DEFAULT_SETTINGS` in `utils/storage.ts` initializes `quickSosEnabled: true`.
- **Identified Improvement**: Expose a toggle switch in `pages/Settings.tsx` (under a "사용자 편의 및 위젯 설정" section) to allow patients to toggle the floating widget on or off, calling `updateUserSettings({ quickSosEnabled: ... })`.

---

## 5. Web App Manifest Verification

In `body-signal/vite.config.js`:
```js
        shortcuts: [
          {
            name: "1초 급성 통증 기록",
            short_name: "긴급 통증",
            description: "아플 때 1초 만에 바로 기록합니다",
            url: "/?mode=acute",
            icons: [{ src: "pwa-icon.svg", sizes: "192x192" }]
          },
          {
            name: "의료진 진료 브리핑",
            short_name: "진료 브리핑",
            description: "의사·간호사용 30초 진료 요약 및 EMR 복사",
            url: "/briefing",
            icons: [{ src: "pwa-icon.svg", sizes: "192x192" }]
          },
          {
            name: "빠른 복약 기록",
            short_name: "복약 기록",
            description: "약 복용 여부 및 효과 기록",
            url: "/entry",
            icons: [{ src: "pwa-icon.svg", sizes: "192x192" }]
          }
        ]
```
- In Chrome/Edge/Android Chrome PWA mode:
  - Long press on PWA icon shows these three shortcuts.
  - Tapping "1초 급성 통증 기록" launches `/?mode=acute`.
  - `AcutePainContext.tsx` reads `location.search` (`?mode=acute`) on mount and opens `AcutePainMode`.
  - Tapping "의료진 진료 브리핑" loads `/briefing`.
  - Tapping "빠른 복약 기록" loads `/entry`.
- Manifest is built to `dist/manifest.webmanifest` and referenced in `dist/index.html` via `<link rel="manifest" href="./manifest.webmanifest">`.

---

## 6. Actionable Recommendations for Downstream Implementer

1. **Install `@capacitor/app`**:
   - Run `npm install @capacitor/app@^8.0.0` in `body-signal`.
   - Add to `body-signal/package.json`.
2. **Implement `DeepLinkHandler`**:
   - Create `src/components/DeepLinkHandler.tsx`.
   - Mount `<DeepLinkHandler />` within `BrowserRouter` in `src/App.tsx`.
3. **Clean up `shortcuts.xml`**:
   - Remove `<categories android:name="android.shortcut.conversation" />` from `android/app/src/main/res/xml/shortcuts.xml`.
4. **Add UI toggle for `quickSosEnabled` in `Settings.tsx`**:
   - Under Settings, provide an on/off switch for "화면 플로팅 SOS 긴급 기록 버튼 표시".
5. **Sync & Build Verification**:
   - Run `npm run build && npx cap sync android` in `body-signal`.
   - Run `.\gradlew assembleDebug` in `body-signal/android`.
