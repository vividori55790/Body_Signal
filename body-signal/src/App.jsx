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
import { clearData, createBackup, loadData, parseBackup, saveData } from "./utils/dataStore";

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

    const savedData = loadData();
    setConditions(savedData.conditions);
    setLogs(savedData.logs);

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
      saveData({ conditions, logs });
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
    clearData();
    localStorage.removeItem("bs-theme"); // Reset theme as well
    localStorage.removeItem("bs-pin-enabled"); // Reset pin state
    window.location.reload();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(createBackup({ conditions, logs }), null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `body-signal-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file) => {
    const contents = await file.text();
    const importedData = parseBackup(contents);
    setConditions(importedData.conditions);
    setLogs(importedData.logs);
  };

  const handleExportCalendar = () => {
    if (logs.length === 0) {
      window.alert("No logs to export.");
      return;
    }

    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Body Signal//EN\n";
    const pad = (value) => (value < 10 ? `0${value}` : value);
    const formatDate = (date) => (
      `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
      + `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
    );

    logs.forEach((log) => {
      const condition = conditions.find((item) => item.id === log.conditionId);
      if (!condition) return;

      const start = new Date(log.date);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const summary = `Level ${log.intensity} ${condition.label}`;
      const description = `Notes: ${log.notes || "None"}\\nMedication: ${log.medication || "None"}`;

      icsContent += `BEGIN:VEVENT\nDTSTART:${formatDate(start)}\nDTEND:${formatDate(end)}\n`;
      icsContent += `SUMMARY:${summary}\nDESCRIPTION:${description}\nEND:VEVENT\n`;
    });

    icsContent += "END:VCALENDAR";
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "body_signal_history.ics";
    link.click();
    URL.revokeObjectURL(url);
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
                onImport={handleImport}
                onExportCalendar={handleExportCalendar}
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
