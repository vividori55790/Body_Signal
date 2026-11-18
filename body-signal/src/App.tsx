import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/Dashboard';
import EntryFormPage from './pages/EntryForm';
import SettingsPage from './pages/Settings';
import HistoryPage from './pages/History';
import DiagnosticsPage from './pages/DiagnosticsPage';
import ClinicalBriefingPage from './pages/ClinicalBriefing';
import ConditionDetailPage from './pages/ConditionDetail';
import BrandSplash from './components/BrandSplash';
import LockScreen from './components/LockScreen';
import { PinModal } from './components/PinModal';
import DisclaimerModal from './components/DisclaimerModal';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HealthProvider } from './context/HealthContext';

import { AcutePainProvider } from './context/AcutePainContext';
import DeepLinkHandler from './components/DeepLinkHandler';
import { BackButtonHandler, LockedBackButtonHandler } from './components/BackButtonHandler';

const SPLASH_DURATION_MS = 1050;

const AppContent: React.FC = () => {
  const {
    isAuthReady,
    isUnlocked,
    isPinSet,
    isDeviceCompromised,
    deviceIntegrityReason,
    setupNewPin,
  } = useAuth();
  const { settings, isSettingsLoaded, acceptDisclaimer } = useSettings();
  const isEn = settings.language === 'en';
  const [showIntroLogo, setShowIntroLogo] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowIntroLogo(false);
    }, SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isAuthReady) {
    return (
      <>
        <LockedBackButtonHandler />
        <BrandSplash statusText={isEn ? 'Checking security integrity...' : '보안 상태 확인 중...'} />
      </>
    );
  }

  if (isDeviceCompromised) {
    return (
      <>
        <LockedBackButtonHandler />
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-3xl border border-rose-500/40 bg-slate-900 p-6 text-center space-y-4 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 text-rose-400 text-2xl font-black">
              !
            </div>
            <h1 className="text-lg font-bold text-rose-300">
              {isEn ? 'Security Integrity Check Failed' : '보안 환경 검증 실패'}
            </h1>
            <p className="text-xs leading-relaxed text-slate-300">
              {deviceIntegrityReason ||
                (isEn
                  ? 'Rooted, hooked, or tampered environment detected. App launch is blocked.'
                  : '루팅 또는 변조된 환경이 감지되어 앱 실행이 차단되었습니다.')}
            </p>
            <p className="text-[11px] text-slate-400">
              {isEn
                ? 'To protect sensitive medical records, Body Signal only runs on unmodified, non-rooted devices.'
                : '민감한 의료 기록 보호를 위해 순정(비루팅) 환경에서만 실행할 수 있습니다.'}
            </p>
          </div>
        </main>
      </>
    );
  }

  if (showIntroLogo) {
    return (
      <>
        <LockedBackButtonHandler />
        <BrandSplash />
      </>
    );
  }

  if (!isUnlocked) {
    return (
      <>
        <LockedBackButtonHandler />
        <LockScreen />
      </>
    );
  }

  if (!isSettingsLoaded) {
    return (
      <>
        <LockedBackButtonHandler />
        <BrandSplash statusText={isEn ? 'Loading settings...' : '설정 불러오는 중...'} />
      </>
    );
  }

  if (!settings.disclaimerAcceptedAt) {
    return (
      <>
        <LockedBackButtonHandler />
        <DisclaimerModal mode="gate" onAccept={acceptDisclaimer} />
      </>
    );
  }

  if (!isPinSet) {
    return (
      <>
        <LockedBackButtonHandler />
        <PinModal
          isOpen={true}
          mode="set"
          required={true}
          title={isEn ? 'Set Mandatory 6-Digit Security PIN' : '초기 6자리 보안 PIN 설정'}
          onSuccess={async (newPin) => {
            await setupNewPin(newPin);
          }}
          onCancel={() => {}}
        />
      </>
    );
  }

  return (
    <BrowserRouter>
      <AcutePainProvider>
        <DeepLinkHandler />
        <BackButtonHandler />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/acute" element={<DashboardPage />} />
            <Route path="/calendar" element={<HistoryPage initialTab="calendar" />} />
            <Route path="/diagnostics" element={<DiagnosticsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/briefing" element={<ClinicalBriefingPage />} />
            <Route path="/entry" element={<EntryFormPage />} />
            <Route path="/condition/:id" element={<ConditionDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AcutePainProvider>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <SettingsProvider>
      <AuthProvider>
        <HealthProvider>
          <AppContent />
        </HealthProvider>
      </AuthProvider>
    </SettingsProvider>
  );
};

export default App;
