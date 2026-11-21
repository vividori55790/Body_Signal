import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  UserSettings,
  MedicationPreset,
  LogoVariant,
  ThemeAccentId,
  LanguagePreference,
} from '../types/health';
import { loadUserSettings, saveUserSettings, DEFAULT_SETTINGS } from '../utils/storage';
import {
  translations,
  translate,
  LocaleId,
  TranslationKey,
  resolveActiveLocale,
  getLocaleDirection,
  loadLocalePack,
} from '../i18n/translations';
import { cancelDailyReminder, triggerHaptic, setHapticsEnabled } from '../utils/native';

interface SettingsContextValue {
  settings: UserSettings;
  resolvedLanguage: LocaleId;
  isSettingsLoaded: boolean;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  setLanguage: (lang: LanguagePreference) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  setThemeAccent: (accent: ThemeAccentId) => Promise<void>;
  setLogoVariant: (variant: LogoVariant) => Promise<void>;
  setHaptics: (enabled: boolean) => Promise<void>;
  setQuickSos: (enabled: boolean) => Promise<void>;
  setShowDiagnosticsTab: (enabled: boolean) => Promise<void>;
  setDefaultQuickLoggerOpen: (enabled: boolean) => Promise<void>;
  setDefaultBodyMapOpen: (enabled: boolean) => Promise<void>;
  recordCollapsibleDismissal: (
    target: 'quickLogger' | 'bodyMap',
    didUseSinceOpen: boolean
  ) => Promise<boolean>;
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
  const [systemLocaleTick, setSystemLocaleTick] = useState(0);
  const [localePackVersion, setLocalePackVersion] = useState(0);

  const applyTheme = (theme: 'light' | 'dark' | 'system', accent: ThemeAccentId = 'emerald') => {
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
    root.dataset.accent = accent || 'emerald';
  };

  useEffect(() => {
    loadUserSettings()
      .then((loaded) => {
        setSettings(loaded);
        applyTheme(loaded.theme, loaded.themeAccent);
        setHapticsEnabled(loaded.hapticsEnabled);
      })
      .finally(() => {
        setIsSettingsLoaded(true);
      });
  }, []);

  // Real-time OS language change listener when settings.language === 'system'
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLocaleChange = () => {
      setSystemLocaleTick((v) => v + 1);
    };
    window.addEventListener('languagechange', handleLocaleChange);
    return () => {
      window.removeEventListener('languagechange', handleLocaleChange);
    };
  }, []);

  const resolvedLanguage = useMemo(() => {
    void systemLocaleTick;
    return resolveActiveLocale(settings.language);
  }, [settings.language, systemLocaleTick]);

  // Lazy-load dynamic locale pack if an external/N-locale pack is selected
  useEffect(() => {
    let active = true;
    loadLocalePack(resolvedLanguage).then((loaded) => {
      if (active && loaded) {
        setLocalePackVersion((v) => v + 1);
      }
    });
    return () => {
      active = false;
    };
  }, [resolvedLanguage]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = resolvedLanguage;
    document.documentElement.dataset.lang = resolvedLanguage;
    document.documentElement.dir = getLocaleDirection(resolvedLanguage);
  }, [resolvedLanguage]);

  useEffect(() => {
    applyTheme(settings.theme, settings.themeAccent);
  }, [settings.theme, settings.themeAccent]);

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

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    void translations;
    void localePackVersion;
    return translate(resolvedLanguage, key, params);
  };

  const setLanguage = async (language: LanguagePreference) => {
    await updateAndSave((prev) => ({ ...prev, language }));
  };

  const setTheme = async (theme: 'light' | 'dark' | 'system') => {
    applyTheme(theme, settings.themeAccent);
    await updateAndSave((prev) => ({ ...prev, theme }));
  };

  const setThemeAccent = async (themeAccent: ThemeAccentId) => {
    applyTheme(settings.theme, themeAccent);
    await updateAndSave((prev) => ({ ...prev, themeAccent }));
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

  const setDefaultQuickLoggerOpen = async (defaultQuickLoggerOpen: boolean) => {
    await updateAndSave((prev) => ({
      ...prev,
      defaultQuickLoggerOpen,
      quickLoggerUnusedCloseCount: 0,
    }));
  };

  const setDefaultBodyMapOpen = async (defaultBodyMapOpen: boolean) => {
    await updateAndSave((prev) => ({
      ...prev,
      defaultBodyMapOpen,
      bodyMapUnusedCloseCount: 0,
    }));
  };

  const recordCollapsibleDismissal = async (
    target: 'quickLogger' | 'bodyMap',
    didUseSinceOpen: boolean
  ): Promise<boolean> => {
    const keyMap = {
      quickLogger: {
        defaultKey: 'defaultQuickLoggerOpen',
        countKey: 'quickLoggerUnusedCloseCount',
      },
      bodyMap: {
        defaultKey: 'defaultBodyMapOpen',
        countKey: 'bodyMapUnusedCloseCount',
      },
    } as const;
    const { defaultKey, countKey } = keyMap[target];

    if (didUseSinceOpen) {
      if ((settings[countKey] || 0) > 0) {
        await updateAndSave((prev) => ({ ...prev, [countKey]: 0 }));
      }
      return false;
    }

    if (!settings[defaultKey]) {
      return false;
    }

    const nextCount = (settings[countKey] || 0) + 1;
    const shouldPrompt = nextCount >= 2;
    await updateAndSave((prev) => ({
      ...prev,
      [countKey]: shouldPrompt ? 0 : nextCount,
    }));
    return shouldPrompt;
  };

  const setReminder = async (_reminderEnabled: boolean, reminderTime?: string) => {
    // Deferred to v4: keep reminders disabled and avoid LocalNotifications permission prompts in v2/v3.
    const time = reminderTime || settings.reminderTime;
    await cancelDailyReminder();
    await updateAndSave((prev) => ({
      ...prev,
      reminderEnabled: false,
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
        resolvedLanguage,
        isSettingsLoaded,
        t,
        setLanguage,
        setTheme,
        setThemeAccent,
        setLogoVariant,
        setHaptics,
        setQuickSos,
        setShowDiagnosticsTab,
        setDefaultQuickLoggerOpen,
        setDefaultBodyMapOpen,
        recordCollapsibleDismissal,
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
