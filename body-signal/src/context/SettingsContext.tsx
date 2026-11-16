import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSettings, MedicationPreset, LogoVariant } from '../types/health';
import { loadUserSettings, saveUserSettings, DEFAULT_SETTINGS } from '../utils/storage';
import { translations, Language } from '../i18n/translations';
import { scheduleDailyReminder, cancelDailyReminder, triggerHaptic, setHapticsEnabled } from '../utils/native';

interface SettingsContextValue {
  settings: UserSettings;
  isSettingsLoaded: boolean;
  t: (key: keyof typeof translations['ko']) => string;
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  setLogoVariant: (variant: LogoVariant) => Promise<void>;
  setHaptics: (enabled: boolean) => Promise<void>;
  setQuickSos: (enabled: boolean) => Promise<void>;
  setShowDiagnosticsTab: (enabled: boolean) => Promise<void>;
  setReminder: (enabled: boolean, time?: string) => Promise<void>;
  acceptDisclaimer: () => Promise<void>;
  addMedicationPreset: (name: string, dosage?: string) => Promise<MedicationPreset | null>;
  updateMedicationPreset: (id: string, updates: Partial<MedicationPreset>) => Promise<void>;
  removeMedicationPreset: (id: string) => Promise<void>;
  addSymptomPreset: (name: string) => Promise<void>;
  removeSymptomPreset: (name: string) => Promise<void>;
  updateLocalLlm: (configUpdates: Partial<UserSettings['localLlm']>) => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  useEffect(() => {
    loadUserSettings()
      .then((loaded) => {
        setSettings(loaded);
        applyTheme(loaded.theme);
        setHapticsEnabled(loaded.hapticsEnabled);
      })
      .finally(() => {
        setIsSettingsLoaded(true);
      });
  }, []);

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    let isDark = false;

    if (theme === 'dark') {
      isDark = true;
    } else if (theme === 'light') {
      isDark = false;
    } else if (theme === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    }

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  // Real-time dynamic theme sync with OS preference changes (F4)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (settings.theme === 'system') {
        const root = document.documentElement;
        if (e && typeof e.matches === 'boolean') {
          if (e.matches) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
        } else {
          applyTheme('system');
        }
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [settings.theme]);

  const updateAndSave = async (updater: (prev: UserSettings) => UserSettings) => {
    const next = updater(settings);
    setSettings(next);
    setHapticsEnabled(next.hapticsEnabled);
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

  const setLogoVariant = async (logoVariant: LogoVariant) => {
    await updateAndSave((prev) => ({ ...prev, logoVariant }));
  };

  const setHaptics = async (hapticsEnabled: boolean) => {
    setHapticsEnabled(hapticsEnabled);
    await updateAndSave((prev) => ({ ...prev, hapticsEnabled }));
  };

  const setQuickSos = async (quickSosEnabled: boolean) => {
    await updateAndSave((prev) => ({ ...prev, quickSosEnabled }));
  };

  const setShowDiagnosticsTab = async (showDiagnosticsTab: boolean) => {
    await updateAndSave((prev) => ({ ...prev, showDiagnosticsTab }));
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

  const addMedicationPreset = async (name: string, dosage?: string): Promise<MedicationPreset | null> => {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    const cappedName = trimmed.slice(0, 80);
    const cappedDosage = dosage ? dosage.trim().slice(0, 40) : undefined;

    // Check duplicate (case-insensitive name match)
    const existing = settings.medicationPresets.find(
      (p) => p.name.trim().toLowerCase() === cappedName.toLowerCase()
    );
    if (existing) {
      return existing;
    }

    const newPreset: MedicationPreset = {
      id: crypto.randomUUID(),
      name: cappedName,
      dosage: cappedDosage || undefined,
    };
    await updateAndSave((prev) => ({
      ...prev,
      medicationPresets: [...prev.medicationPresets, newPreset],
    }));
    return newPreset;
  };

  const updateMedicationPreset = async (id: string, updates: Partial<MedicationPreset>) => {
    await updateAndSave((prev) => ({
      ...prev,
      medicationPresets: prev.medicationPresets.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
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

  const updateLocalLlm = async (configUpdates: Partial<UserSettings['localLlm']>) => {
    await updateAndSave((prev) => ({
      ...prev,
      localLlm: { ...prev.localLlm, ...configUpdates },
    }));
  };

  const acceptDisclaimer = async () => {
    triggerHaptic();
    await updateAndSave((prev) => ({
      ...prev,
      disclaimerAcceptedAt: new Date().toISOString(),
    }));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isSettingsLoaded,
        t,
        setLanguage,
        setTheme,
        setLogoVariant,
        setHaptics,
        setQuickSos,
        setShowDiagnosticsTab,
        setReminder,
        acceptDisclaimer,
        addMedicationPreset,
        updateMedicationPreset,
        removeMedicationPreset,
        addSymptomPreset,
        removeSymptomPreset,
        updateLocalLlm,
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
