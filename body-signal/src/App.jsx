import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import EntryForm from "./pages/EntryForm";
import SettingsPage from "./pages/Settings";
import HistoryPage from "./pages/History";
import CalendarPage from "./pages/CalendarPage";
import LockScreen from './components/LockScreen'; // Added
import { syncEventToGoogleCalendar, getLinkedGoogleAccount } from './utils/googleSync'; // Added

import ConditionDetailPage from "./pages/ConditionDetail";
import { MOCK_CONDITIONS, MOCK_LOGS } from "./mockData";

function App() {
  // Centralized State
  const [conditions, setConditions] = useState([]); // Initialized empty, will load from localStorage
  const [logs, setLogs] = useState([]); // Initialized empty, will load from localStorage
  const [theme, setTheme] = useState('light'); // Changed from isDarkMode to theme
  const [isUnlocked, setIsUnlocked] = useState(false); // Added

  // Initialize Data, Theme, and Lock State
  useEffect(() => {
    // Lock logic
    const pinEnabled = localStorage.getItem('bs-pin-enabled') === 'true';
    setIsUnlocked(!pinEnabled);

    // Data loading
    const savedData = localStorage.getItem('bs-data-v2');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setConditions(parsedData.conditions.length > 0 ? parsedData.conditions : MOCK_CONDITIONS);
      setLogs(parsedData.logs.length > 0 ? parsedData.logs : MOCK_LOGS);
    } else {
      setConditions(MOCK_CONDITIONS);
      setLogs(MOCK_LOGS);
    }

    // Theme loading
    const savedTheme = localStorage.getItem("bs-theme");
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('light'); // Default theme
    }
  }, []); // Run once on mount

  // Persistence for conditions and logs (now combined into 'bs-data-v2')
  useEffect(() => {
    if (isUnlocked) { // Only save if unlocked, to prevent saving empty data if locked
      localStorage.setItem("bs-data-v2", JSON.stringify({ conditions, logs }));
    }
  }, [conditions, logs, isUnlocked]);

  // Theme application
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("bs-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  // Handlers
  const handleSaveLog = async (conditionId, logData, syncToGoogle = true) => {
    const newLog = {
      id: Date.now().toString(), // Changed to Date.now().toString() for unique ID
      conditionId,
      date: new Date().toISOString(), // Added date
      ...logData
    };
    const newLogs = [newLog, ...logs]; // Prepends new log
    setLogs(newLogs);
    // Persistence is handled by the useEffect, no need to set here directly

    if (syncToGoogle) {
        const account = getLinkedGoogleAccount();
        if (account) {
             const condition = conditions.find(c => c.id === conditionId);
             // Fire and forget, or could await it
             syncEventToGoogleCalendar(newLog, condition?.label || 'Condition').catch(e => console.error("Google Sync Error:", e));
        }
    }
  };

  const handleSaveEntry = (payload) => {
    const { isNewCondition, conditionData, logData, syncToGoogle } = payload;
    let conditionId = conditionData.id;

    if (isNewCondition) {
      conditionId = crypto.randomUUID();
      const newCondition = {
        id: conditionId,
        ...conditionData,
        isArchived: false,
      };
      setConditions((prev) => [...prev, newCondition]);
    }

    // Call the new handleSaveLog for consistency and Google Sync
    handleSaveLog(conditionId, logData, syncToGoogle);
  };

  const handleReset = () => {
    localStorage.removeItem("bs-data-v2"); // Changed to new key
    localStorage.removeItem("bs-theme"); // Reset theme as well
    localStorage.removeItem("bs-pin-enabled"); // Reset pin state
    window.location.reload();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify({ conditions, logs }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `body-signal-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateCondition = (id, updatedData) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updatedData } : c)),
    );
  };

  if (!isUnlocked) {
      return <LockScreen onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              <Dashboard
                conditions={conditions}
                logs={logs}
                onUpdateCondition={handleUpdateCondition}
                onSave={handleSaveEntry}
              />
            }
          />
          <Route
            path="/entry"
            element={
              <EntryForm
                activeConditions={conditions}
                onSave={handleSaveEntry}
              />
            }
          />
          <Route
            path="/calendar"
            element={<CalendarPage logs={logs} conditions={conditions} />}
          />
          <Route
            path="/history"
            element={<HistoryPage logs={logs} conditions={conditions} />}
          />
          <Route
            path="/condition/:id"
            element={
              <ConditionDetailPage
                conditions={conditions}
                logs={logs}
                onUpdateCondition={handleUpdateCondition}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                onReset={handleReset}
                onExport={handleExport}
                isDarkMode={theme === 'dark'}
                toggleTheme={toggleTheme}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
