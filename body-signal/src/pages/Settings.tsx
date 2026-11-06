import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useHealth } from '../context/HealthContext';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Bell,
  Moon,
  Sun,
  Smartphone,
  Lock,
  Globe,
  Download,
  Upload,
  FileSpreadsheet,
  Calendar,
  Trash2,
  Pill,
  Plus,
  X,
  Vibrate,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { PinModal } from '../components/PinModal';
import { triggerHaptic } from '../utils/native';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    t,
    setLanguage,
    setTheme,
    setHaptics,
    setReminder,
    addMedicationPreset,
    removeMedicationPreset,
  } = useSettings();

  const { conditions, logs, diaryEntries, exportBackupJson, importBackupJson, resetData } = useHealth();
  const { isPinSet, setupNewPin, disablePin } = useAuth();

  // Modals state
  const [pinModalMode, setPinModalMode] = useState<'set' | 'change' | null>(null);
  const [newMedName, setNewMedName] = useState('');
  const [showAddMed, setShowAddMed] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleTogglePin = async () => {
    triggerHaptic();
    if (isPinSet) {
      if (window.confirm('앱 잠금을 해제하시겠습니까? 데이터가 암호화되지 않은 일반 상태로 보관됩니다.')) {
        await disablePin();
        showToast(t('pinRemoved'));
      }
    } else {
      setPinModalMode('set');
    }
  };

  const handleExportJson = () => {
    triggerHaptic();
    const dataStr = exportBackupJson();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `body-signal-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('백업 파일이 다운로드되었습니다.');
  };

  const handleExportCsv = () => {
    triggerHaptic();
    const escapeCsv = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['일시', '질환명', '발생부위', '통증강도(NRS)', '복용약물/치료', '임상메모'],
      ...logs.map((log) => {
        const cond = conditions.find((c) => c.id === log.conditionId);
        return [
          log.date,
          cond?.label || '미지정',
          log.bodyPartOverride || cond?.bodyPart || '',
          log.intensity,
          log.medication || '',
          log.notes || '',
        ];
      }),
    ];

    const csvContent = rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `body-signal-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('진료용 CSV 리포트가 다운로드되었습니다.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importBackupJson(text);
      showToast('백업이 성공적으로 복원되었습니다.');
    } catch (err: any) {
      alert(err.message || '백업 복원에 실패했습니다.');
    } finally {
      e.target.value = '';
    }
  };

  const handleReset = async () => {
    if (window.confirm(t('resetConfirmPrompt'))) {
      await resetData();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-xl font-bold">{t('settingsTitle')}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('settingsSubtitle')}</p>
      </header>

      {feedbackMsg && (
        <div className="rounded-xl bg-emerald-500 text-white p-3 text-xs font-bold text-center animate-in fade-in shadow-md">
          {feedbackMsg}
        </div>
      )}

      {/* Local Private Profile Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
            <UserCheck size={22} />
          </div>
          <div>
            <h3 className="font-bold text-sm">{t('localProfile')}</h3>
            <p className="text-[11px] text-slate-400">{t('localProfileDesc')}</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          On-Device
        </span>
      </div>

      {/* Section: General Settings */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
          {t('generalSection')}
        </h2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          {/* Language Toggle */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                <Globe size={18} />
              </div>
              <span className="font-bold text-xs">{t('languageSetting')}</span>
            </div>
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                type="button"
                onClick={() => setLanguage('ko')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  settings.language === 'ko'
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                한국어
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  settings.language === 'en'
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600">
                <Moon size={18} />
              </div>
              <span className="font-bold text-xs">{t('themeSetting')}</span>
            </div>
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${
                  settings.theme === 'light'
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                {t('themeLight')}
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${
                  settings.theme === 'dark'
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                {t('themeDark')}
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${
                  settings.theme === 'system'
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                {t('themeSystem')}
              </button>
            </div>
          </div>

          {/* Haptics Toggle */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600">
                <Vibrate size={18} />
              </div>
              <div>
                <span className="font-bold text-xs block">{t('hapticsSetting')}</span>
                <span className="text-[10px] text-slate-400">{t('hapticsSettingDesc')}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHaptics(!settings.hapticsEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.hapticsEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.hapticsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Daily Reminder Notification */}
          <div className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600">
                  <Bell size={18} />
                </div>
                <div>
                  <span className="font-bold text-xs block">{t('dailyReminder')}</span>
                  <span className="text-[10px] text-slate-400">{t('dailyReminderDesc')}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReminder(!settings.reminderEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  settings.reminderEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings.reminderEnabled && (
              <div className="flex items-center justify-between pt-2 pl-11">
                <span className="text-xs font-bold text-slate-500">{t('reminderTimeSetting')}</span>
                <input
                  type="time"
                  value={settings.reminderTime}
                  onChange={(e) => setReminder(true, e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-bold"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section: Security & App Lock */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
          {t('privacySection')}
        </h2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                <Lock size={18} />
              </div>
              <div>
                <span className="font-bold text-xs block">{t('appLockPin')}</span>
                <span className="text-[10px] text-slate-400">{t('appLockPinDesc')}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTogglePin}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                isPinSet ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isPinSet ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {isPinSet && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setPinModalMode('change');
              }}
              className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400"
            >
              <span>{t('changePin')}</span>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </section>

      {/* Section: Presets (Medication management) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between ml-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('presetSection')}
          </h2>
          <button
            type="button"
            onClick={() => setShowAddMed(!showAddMed)}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
          >
            <Plus size={14} /> {t('addPresetBtn')}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          {showAddMed && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="예: 게보린 1정, 인공눈물"
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs font-medium focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (newMedName.trim()) {
                    addMedicationPreset(newMedName);
                    setNewMedName('');
                    setShowAddMed(false);
                  }
                }}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm"
              >
                추가
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {settings.medicationPresets.map((preset) => (
              <span
                key={preset.id}
                className="flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300"
              >
                <Pill size={12} className="text-blue-500" />
                {preset.name}
                <button
                  type="button"
                  onClick={() => removeMedicationPreset(preset.id)}
                  className="text-blue-400 hover:text-rose-500"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Section: Storage & Backup */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
          {t('storageSection')}
        </h2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          <button
            type="button"
            onClick={handleExportJson}
            className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                <Download size={18} />
              </div>
              <div>
                <span className="font-bold text-xs block">{t('exportJson')}</span>
                <span className="text-[10px] text-slate-400">{t('exportJsonDesc')}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-lg">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <span className="font-bold text-xs block">{t('exportCsv')}</span>
                <span className="text-[10px] text-slate-400">{t('exportCsvDesc')}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>

          <label className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-lg">
                <Upload size={18} />
              </div>
              <div>
                <span className="font-bold text-xs block">{t('importBackup')}</span>
                <span className="text-[10px] text-slate-400">{t('importBackupDesc')}</span>
              </div>
            </div>
            <input type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
            <ChevronRight size={16} className="text-slate-300" />
          </label>

          <button
            type="button"
            onClick={handleReset}
            className="w-full text-left p-3.5 flex items-center justify-between hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-rose-600"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/80 rounded-lg">
                <Trash2 size={18} />
              </div>
              <div>
                <span className="font-bold text-xs block">{t('resetApp')}</span>
                <span className="text-[10px] text-slate-400">{t('resetAppDesc')}</span>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* PIN Setup/Change Modal */}
      {pinModalMode && (
        <PinModal
          isOpen={true}
          mode={pinModalMode}
          onSuccess={async (newPin) => {
            await setupNewPin(newPin);
            setPinModalMode(null);
            showToast(t('pinSetSuccess'));
          }}
          onCancel={() => setPinModalMode(null)}
        />
      )}

      {/* Version badge */}
      <div className="text-center pt-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
          <Shield size={12} className="text-emerald-500" />
          Body Signal Mobile v1.0.0 (Encrypted)
        </span>
      </div>
    </div>
  );
};

export default SettingsPage;
