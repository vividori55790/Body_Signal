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
import { Fingerprint, ShieldCheck } from 'lucide-react';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { checkBiometricAvailability } from './utils/biometrics';
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
    isBiometricAvailable,
    isBiometricEnabled,
    setupNewPin,
    toggleBiometric,
  } = useAuth();
  const { settings, isSettingsLoaded, acceptDisclaimer, t } = useSettings();
  const isEn = settings.language === 'en';
  const [showIntroLogo, setShowIntroLogo] = useState(true);
  const [pendingOnboardingPin, setPendingOnboardingPin] = useState<string | null>(null);
  const [biometricPromptError, setBiometricPromptError] = useState('');
  const [isEnablingBiometric, setIsEnablingBiometric] = useState(false);

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
            const bioReady =
              isBiometricAvailable || (await checkBiometricAvailability({ allowDeviceCredential: false }));
            if (bioReady && !isBiometricEnabled) {
              setBiometricPromptError('');
              setPendingOnboardingPin(newPin);
            }
          }}
          onCancel={() => {}}
        />
      </>
    );
  }

  if (pendingOnboardingPin) {
    return (
      <>
        <LockedBackButtonHandler />
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 select-none">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-400">
              <Fingerprint size={30} />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-lg font-extrabold tracking-tight text-white">
                {t('onboardingBiometricTitle')}
              </h1>
              <p className="text-xs leading-relaxed text-slate-300">
                {t('onboardingBiometricDesc')}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2.5 text-[11px] font-semibold text-emerald-300">
              <ShieldCheck size={16} className="shrink-0" />
              <span>{t('onboardingBiometricPinNote')}</span>
            </div>
            {biometricPromptError && (
              <p className="text-xs font-bold text-rose-400 text-center">{biometricPromptError}</p>
            )}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={isEnablingBiometric}
                onClick={async () => {
                  setIsEnablingBiometric(true);
                  setBiometricPromptError('');
                  try {
                    const ok = await toggleBiometric(true, pendingOnboardingPin);
                    if (ok) {
                      setPendingOnboardingPin(null);
                    } else {
                      setBiometricPromptError(t('onboardingBiometricFailed'));
                    }
                  } finally {
                    setIsEnablingBiometric(false);
                  }
                }}
                className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-lg shadow-teal-600/25 disabled:opacity-50"
              >
                {t('onboardingEnableBiometricBtn')}
              </button>
              <button
                type="button"
                disabled={isEnablingBiometric}
                onClick={() => setPendingOnboardingPin(null)}
                className="w-full py-3 rounded-2xl border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-slate-200 font-bold text-xs disabled:opacity-50"
              >
                {t('onboardingPinOnlyBtn')}
              </button>
            </div>
          </div>
        </main>
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
