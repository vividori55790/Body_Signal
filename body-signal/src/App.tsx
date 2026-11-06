import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/Dashboard';
import EntryFormPage from './pages/EntryForm';
import SettingsPage from './pages/Settings';
import HistoryPage from './pages/History';
import CalendarPage from './pages/CalendarPage';
import ClinicalBriefingPage from './pages/ClinicalBriefing';
import ConditionDetailPage from './pages/ConditionDetail';
import LockScreen from './components/LockScreen';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HealthProvider } from './context/HealthContext';

import { AcutePainProvider } from './context/AcutePainContext';
import DeepLinkHandler from './components/DeepLinkHandler';

const AppContent: React.FC = () => {
  const { isUnlocked } = useAuth();

  if (!isUnlocked) {
    return <LockScreen />;
  }

  return (
    <BrowserRouter>
      <AcutePainProvider>
        <DeepLinkHandler />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/acute" element={<DashboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
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
