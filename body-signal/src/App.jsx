import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import EntryForm from './pages/EntryForm';
import SettingsPage from './pages/Settings';
import HistoryPage from './pages/History';
import CalendarPage from './pages/CalendarPage';

import ConditionDetailPage from './pages/ConditionDetail';
import { MOCK_CONDITIONS, MOCK_LOGS } from './mockData';

function App() {
  // Centralized State
  const [conditions, setConditions] = useState(() => {
     const saved = localStorage.getItem('bs-conditions');
     // If saved exists but is empty array, fall back to MOCK (for demo purposes)
     // In a real app we wouldn't do this check, but for this demo request it's crucial.
     if (saved) {
         const parsed = JSON.parse(saved);
         if (parsed.length > 0) return parsed;
     }
     return MOCK_CONDITIONS;
  });
  
  const [logs, setLogs] = useState(() => {
     const saved = localStorage.getItem('bs-logs');
     if (saved) {
         const parsed = JSON.parse(saved);
         if (parsed.length > 0) return parsed;
     }
     return MOCK_LOGS;
  });

  // Persistence
  useEffect(() => {
      localStorage.setItem('bs-conditions', JSON.stringify(conditions));
      localStorage.setItem('bs-logs', JSON.stringify(logs));
  }, [conditions, logs]);

  // Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('bs-theme') === 'dark';
      }
      return false;
  });

  useEffect(() => {
      if (isDarkMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('bs-theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('bs-theme', 'light');
      }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  // Handlers
  const handleSaveEntry = (payload) => {
      const { isNewCondition, conditionData, logData } = payload;
      let conditionId = conditionData.id;

      if (isNewCondition) {
          conditionId = crypto.randomUUID();
          const newCondition = {
              id: conditionId,
              ...conditionData,
              isArchived: false
          };
          setConditions(prev => [...prev, newCondition]);
      }

      const newLog = {
          id: crypto.randomUUID(),
          conditionId: conditionId,
          ...logData
      };
      
      setLogs(prev => [...prev, newLog]);
  };

  const handleReset = () => {
      localStorage.removeItem('bs-conditions');
      localStorage.removeItem('bs-logs');
      window.location.reload();
  };

  const handleExport = () => {
      const dataStr = JSON.stringify({ conditions, logs }, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `body-signal-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleUpdateCondition = (id, updatedData) => {
      setConditions(prev => prev.map(c => 
          c.id === id ? { ...c, ...updatedData } : c
      ));
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
           <Route path="/" element={<Dashboard conditions={conditions} logs={logs} />} />
           <Route path="/entry" element={<EntryForm activeConditions={conditions} onSave={handleSaveEntry} />} />
           <Route path="/calendar" element={<CalendarPage logs={logs} conditions={conditions} />} />
           <Route path="/history" element={<HistoryPage logs={logs} conditions={conditions} />} />
           <Route path="/condition/:id" element={<ConditionDetailPage conditions={conditions} logs={logs} onUpdateCondition={handleUpdateCondition} />} />
            <Route path="/settings" element={<SettingsPage onReset={handleReset} onExport={handleExport} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />} />
           <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
