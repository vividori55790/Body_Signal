import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSettings, MedicationPreset } from '../types/health';
import { loadUserSettings, saveUserSettings, DEFAULT_SETTINGS } from '../utils/storage';
import { translations, Language } from '../i18n/translations';
import { scheduleDailyReminder, cancelDailyReminder, triggerHaptic } from '../utils/native';

interface SettingsContextValue {
  settings: UserSettings;
  t: (key: keyof typeof translations['ko']) => string;
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  setHaptics: (enabled: boolean) => Promise<void>;
  setReminder: (enabled: boolean, time?: string) => Promise<void>;
  addMedicationPreset: (name: string) => Promise<void>;
  removeMedicationPreset: (id: string) => Promise<void>;
  addSymptomPreset: (name: string) => Promise<void>;
  removeSymptomPreset: (name: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadUserSettings().then((loaded) => {
      setSettings(loaded);
      applyTheme(loaded.theme);
    });
  }, []);

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const updateAndSave = async (updater: (prev: UserSettings) => UserSettings) => {
    const next = updater(settings);
    setSettings(next);
    await saveUserSettings(next);
    if (next.hapticsEnabled) {
      triggerHaptic();
    }
  };

  const t = (key: keyof typeof translations['ko']): string => {
    const lang = settings.language || 'ko';
    return (translations[lang] as any)?.[key] || (translations['ko'] as any)?.[key] || key;
  };

  const setLanguage = async (language: Language) => {
    await updateAndSave((prev) => ({ ...prev, language }));
  };

  const setTheme = async (theme: 'light' | 'dark' | 'system') => {
    applyTheme(theme);
    await updateAndSave((prev) => ({ ...prev, theme }));
  };

  const setHaptics = async (hapticsEnabled: boolean) => {
    await updateAndSave((prev) => ({ ...prev, hapticsEnabled }));
  };

  const setReminder = async (reminderEnabled: boolean, reminderTime?: string) => {
    const time = reminderTime || settings.reminderTime;
    if (reminderEnabled) {
      await scheduleDailyReminder(time);
    } else {
      await cancelDailyReminder();
    }
    await updateAndSave((prev) => ({
      ...prev,
      reminderEnabled,
      reminderTime: time,
    }));
  };

  const addMedicationPreset = async (name: string) => {
    if (!name.trim()) return;
    const newPreset: MedicationPreset = {
      id: crypto.randomUUID(),
      name: name.trim(),
    };
    await updateAndSave((prev) => ({
      ...prev,
      medicationPresets: [...prev.medicationPresets, newPreset],
    }));
  };

  const removeMedicationPreset = async (id: string) => {
    await updateAndSave((prev) => ({
      ...prev,
      medicationPresets: prev.medicationPresets.filter((p) => p.id !== id),
    }));
  };

  const addSymptomPreset = async (name: string) => {
    if (!name.trim()) return;
    await updateAndSave((prev) => ({
      ...prev,
      symptomPresets: Array.from(new Set([...prev.symptomPresets, name.trim()])),
    }));
  };

  const removeSymptomPreset = async (name: string) => {
    await updateAndSave((prev) => ({
      ...prev,
      symptomPresets: prev.symptomPresets.filter((s) => s !== name),
    }));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        t,
        setLanguage,
        setTheme,
        setHaptics,
        setReminder,
        addMedicationPreset,
        removeMedicationPreset,
        addSymptomPreset,
        removeSymptomPreset,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
