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
  Bot,
  Sparkles,
  RefreshCw,
  Server,
  AlertCircle,
  Fingerprint,
} from 'lucide-react';
import { PinModal } from '../components/PinModal';
import { triggerHaptic } from '../utils/native';
import { testLocalLlmConnection } from '../utils/localLlm';
import { encryptBackupWithPassphrase, decryptBackupWithPassphrase } from '../utils/crypto';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    t,
    setLanguage,
    setTheme,
    setHaptics,
    setQuickSos,
    setReminder,
    addMedicationPreset,
    removeMedicationPreset,
    updateLocalLlm,
  } = useSettings();

  const { conditions, logs, diaryEntries, exportBackupJson, importBackupJson, resetData } = useHealth();
  const {
    isPinSet,
    setupNewPin,
    disablePin,
    isBiometricAvailable,
    isBiometricEnabled,
    toggleBiometric,
    unlockApp,
  } = useAuth();

  // Modals state
  const [pinModalMode, setPinModalMode] = useState<'set' | 'change' | 'unlock' | null>(null);
  const [pendingSecurityAction, setPendingSecurityAction] = useState<'toggleBiometric' | 'disablePin' | null>(null);
  const [newMedName, setNewMedName] = useState('');
  const [showAddMed, setShowAddMed] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Local LLM State
  const [isTestingLlm, setIsTestingLlm] = useState(false);
  const [llmTestStatus, setLlmTestStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // Encrypted Backup Modal State
  const [backupModalMode, setBackupModalMode] = useState<'export' | 'importDecrypt' | 'importPreview' | null>(null);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupPassphraseConfirm, setBackupPassphraseConfirm] = useState('');
  const [backupError, setBackupError] = useState('');
  const [pendingImportRaw, setPendingImportRaw] = useState('');
  const [importPreviewData, setImportPreviewData] = useState<{
    jsonStr: string;
    conditionsCount: number;
    logsCount: number;
    diaryCount: number;
    isEncrypted: boolean;
  } | null>(null);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleTestLlm = async () => {
    triggerHaptic();
    setIsTestingLlm(true);
    setLlmTestStatus(null);
    const result = await testLocalLlmConnection(settings.localLlm);
    setIsTestingLlm(false);
    setLlmTestStatus({
      success: result.success,
      msg: result.message,
    });
    if (result.success) {
      triggerHaptic();
    }
  };

  const handleTogglePin = async () => {
    triggerHaptic();
    if (isPinSet) {
      // Require current PIN verification before disabling (Item 3)
      setPendingSecurityAction('disablePin');
      setPinModalMode('unlock');
    } else {
      setPinModalMode('set');
    }
  };

  const handleToggleBiometric = async () => {
    triggerHaptic();
    if (!isPinSet) {
      showToast('생체인증을 등록하려면 먼저 앱 잠금 PIN을 설정해야 합니다.');
      setPinModalMode('set');
      return;
    }

    // Require current PIN verification before enabling/disabling biometrics (Item 3)
    setPendingSecurityAction('toggleBiometric');
    setPinModalMode('unlock');
  };

  const resetBackupModal = () => {
    setBackupModalMode(null);
    setBackupPassphrase('');
    setBackupPassphraseConfirm('');
    setBackupError('');
    setPendingImportRaw('');
    setImportPreviewData(null);
  };

  const handleExportJson = () => {
    triggerHaptic();
    setBackupPassphrase('');
    setBackupPassphraseConfirm('');
    setBackupError('');
    setBackupModalMode('export');
  };

  const confirmEncryptedExport = async () => {
    if (backupPassphrase.length < 6) {
      setBackupError('보안을 위해 백업 암호는 최소 6자 이상이어야 합니다.');
      return;
    }
    if (backupPassphrase !== backupPassphraseConfirm) {
      setBackupError('입력하신 두 백업 암호가 일치하지 않습니다.');
      return;
    }

    try {
      triggerHaptic();
      const plainJson = exportBackupJson();
      const encryptedContent = await encryptBackupWithPassphrase(plainJson, backupPassphrase);
      const blob = new Blob([encryptedContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `body-signal-encrypted-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      resetBackupModal();
      showToast('AES-256 암호화 백업 파일이 다운로드되었습니다.');
    } catch (err: any) {
      setBackupError(err?.message || '암호화 백업 생성에 실패했습니다.');
    }
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
      const parsed = JSON.parse(text);

      // Encrypted backup detection
      if (parsed?.format === 'bignal-encrypted-backup-v1' || (parsed?.data?.ct && parsed?.data?.salt && parsed?.data?.iv)) {
        setPendingImportRaw(text);
        setBackupPassphrase('');
        setBackupError('');
        setBackupModalMode('importDecrypt');
        return;
      }

      // Legacy plaintext JSON backup preview
      const data = parsed?.data || parsed;
      if (data && Array.isArray(data.conditions) && Array.isArray(data.logs)) {
        setImportPreviewData({
          jsonStr: JSON.stringify(data),
          conditionsCount: data.conditions.length,
          logsCount: data.logs.length,
          diaryCount: Array.isArray(data.diaryEntries) ? data.diaryEntries.length : 0,
          isEncrypted: false,
        });
        setBackupError('');
        setBackupModalMode('importPreview');
      } else {
        throw new Error('올바른 백업 파일 형식이 아닙니다.');
      }
    } catch (err: any) {
      showToast(err.message || '백업 파일을 읽을 수 없습니다.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDecryptBackupPreview = async () => {
    if (!backupPassphrase) {
      setBackupError('백업 암호를 입력해 주세요.');
      return;
    }
    try {
      const decryptedJson = await decryptBackupWithPassphrase(pendingImportRaw, backupPassphrase);
      const data = JSON.parse(decryptedJson);
      if (!data || !Array.isArray(data.conditions) || !Array.isArray(data.logs)) {
        throw new Error('복호화된 백업 데이터가 손상되었습니다.');
      }
      setImportPreviewData({
        jsonStr: decryptedJson,
        conditionsCount: data.conditions.length,
        logsCount: data.logs.length,
        diaryCount: Array.isArray(data.diaryEntries) ? data.diaryEntries.length : 0,
        isEncrypted: true,
      });
      setBackupError('');
      setBackupModalMode('importPreview');
    } catch (err: any) {
      setBackupError(err?.message || '백업 암호가 일치하지 않거나 파일이 손상되었습니다.');
    }
  };

  const confirmRestoreBackup = async () => {
    if (!importPreviewData) return;
    try {
      triggerHaptic();
      await importBackupJson(importPreviewData.jsonStr);
      resetBackupModal();
      showToast('백업이 성공적으로 복원되었습니다.');
    } catch (err: any) {
      setBackupError(err?.message || '백업 복원에 실패했습니다.');
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

          {/* Quick SOS Widget Toggle */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600">
                <AlertCircle size={18} />
              </div>
              <div>
                <span className="font-bold text-xs block">{t('quickSosSetting')}</span>
                <span className="text-[10px] text-slate-400">{t('quickSosSettingDesc')}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQuickSos(settings.quickSosEnabled === false ? true : false)}
              aria-label="상시 긴급 통증 SOS 위젯 표시 토글"
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.quickSosEnabled !== false ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.quickSosEnabled !== false ? 'translate-x-6' : 'translate-x-1'
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

          {isPinSet && isBiometricAvailable && (
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <Fingerprint size={18} />
                </div>
                <div>
                  <span className="font-bold text-xs block">{t('biometricsSetting')}</span>
                  <span className="text-[10px] text-slate-400">{t('biometricsSettingDesc')}</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="생체인증 잠금 해제 전환"
                onClick={handleToggleBiometric}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  isBiometricEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    isBiometricEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
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

      {/* Section: Local LLM (Private On-Device AI) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between ml-1">
          {/* 로컬 LLM (오프라인 프라이빗 AI) */}
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('localLlmSection')}
          </h2>
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
            개발 중 · HTTPS/로컬 전용
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-lg">
                <Bot size={18} />
              </div>
              <div>
                {/* 로컬 LLM 임상 보조 연동 */}
                <span className="font-bold text-xs block text-slate-800 dark:text-slate-100">
                  {t('localLlmIntegration')}
                </span>
                <span className="text-[10px] text-slate-400">
                  {t('localLlmDesc')}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.localLlm.enabled}
              onChange={(e) => updateLocalLlm({ enabled: e.target.checked })}
              className="h-5 w-5 accent-purple-600 rounded cursor-pointer"
            />
          </div>

          {settings.localLlm.enabled && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in">
              {/* Endpoint */}
              <div>
                {/* 엔드포인트 URL (OpenAI 호환) */}
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {t('endpointUrlLabel')}
                </label>
                <input
                  type="text"
                  value={settings.localLlm.endpoint}
                  onChange={(e) => updateLocalLlm({ endpoint: e.target.value })}
                  placeholder="built-in://edge-ai 또는 http://localhost:11434/v1"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {/* Quick Endpoint Presets */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateLocalLlm({
                        endpoint: 'built-in://edge-ai',
                        model: 'gemini-nano',
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 transition-all ${
                      settings.localLlm.endpoint === 'built-in://edge-ai'
                        ? 'bg-purple-100 dark:bg-purple-900/60 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500 hover:text-purple-600'
                    }`}
                  >
                    {t('edgeAiPreset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLocalLlm({ endpoint: 'http://localhost:11434/v1', model: 'llama3.2' })}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 hover:text-purple-600"
                  >
                    Ollama 로컬 (11434)
                  </button>
                  {import.meta.env.DEV && (
                    <button
                      type="button"
                      onClick={() => updateLocalLlm({ endpoint: 'http://10.0.2.2:11434/v1', model: 'llama3.2' })}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 hover:text-purple-600"
                    >
                      안드로이드 에뮬레이터 (DEV)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateLocalLlm({ endpoint: 'http://localhost:1234/v1', model: 'llama3.2' })}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 hover:text-purple-600"
                  >
                    LM Studio (1234)
                  </button>
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
                  🔒 보안 정책상 원격/LAN LLM 연결은 암호화된 HTTPS 엔드포인트만 허용됩니다. (localhost 제외)
                </p>
              </div>

              {/* Model */}
              <div>
                {/* 모델명 (Model) */}
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {t('modelNameLabel')}
                </label>
                <input
                  type="text"
                  value={settings.localLlm.model}
                  onChange={(e) => updateLocalLlm({ model: e.target.value })}
                  placeholder="gemini-nano 또는 llama3.2"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {/* ['llama3.2', 'phi3', 'mistral', 'gemma2'] */}
                  {['gemini-nano', 'llama3.2', 'phi3', 'mistral', 'gemma2'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => updateLocalLlm({ model: m })}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        settings.localLlm.model === m
                          ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Connection Button */}
              {/* 로컬 LLM 연결 테스트 */}
              <button
                type="button"
                disabled={isTestingLlm}
                onClick={handleTestLlm}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all disabled:opacity-50"
              >
                {isTestingLlm ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    {t('testingLlm')}
                  </>
                ) : (
                  <>
                    <Server size={14} />
                    {t('testLlmBtn')}
                  </>
                )}
              </button>

              {/* Status Message */}
              {llmTestStatus && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-medium flex items-start gap-1.5 animate-in fade-in ${
                    llmTestStatus.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <span className="font-bold">{llmTestStatus.success ? '✓' : '⚠️'}</span>
                  <span>{llmTestStatus.msg}</span>
                </div>
              )}
            </div>
          )}
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

      {/* Encrypted Backup Export / Import Modal */}
      {backupModalMode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-emerald-500" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {backupModalMode === 'export'
                    ? '암호화 백업 내보내기 (AES-256)'
                    : backupModalMode === 'importDecrypt'
                    ? '암호화 백업 복호화'
                    : '백업 복원 미리보기'}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetBackupModal}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {backupModalMode === 'export' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  건강 기록을 보호하기 위해 백업 파일은 AES-GCM 256 및 SHA-256 무결성 검증으로 암호화됩니다. 복원 시 사용할 암호를 입력하세요.
                </p>
                <input
                  type="password"
                  value={backupPassphrase}
                  onChange={(e) => setBackupPassphrase(e.target.value)}
                  placeholder="백업 암호 입력 (6자 이상)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="password"
                  value={backupPassphraseConfirm}
                  onChange={(e) => setBackupPassphraseConfirm(e.target.value)}
                  placeholder="백업 암호 확인"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {backupError && (
                  <p className="text-xs font-bold text-rose-500 flex items-center gap-1">
                    <AlertCircle size={13} /> {backupError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetBackupModal}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={confirmEncryptedExport}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm"
                  >
                    암호화 다운로드
                  </button>
                </div>
              </div>
            )}

            {backupModalMode === 'importDecrypt' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  암호화된 백업 파일입니다. 내보낼 때 설정한 암호를 입력하면 내용을 미리 확인한 뒤 복원합니다.
                </p>
                <input
                  type="password"
                  value={backupPassphrase}
                  onChange={(e) => setBackupPassphrase(e.target.value)}
                  placeholder="백업 암호 입력"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {backupError && (
                  <p className="text-xs font-bold text-rose-500 flex items-center gap-1">
                    <AlertCircle size={13} /> {backupError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetBackupModal}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDecryptBackupPreview}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm"
                  >
                    복호화 및 미리보기
                  </button>
                </div>
              </div>
            )}

            {backupModalMode === 'importPreview' && importPreviewData && (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded-xl text-xs border ${
                    importPreviewData.isEncrypted
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                  }`}
                >
                  <p className="font-bold mb-1">
                    {importPreviewData.isEncrypted
                      ? '✓ SHA-256 무결성 검증 및 복호화 완료'
                      : '⚠️ 암호화되지 않은 구버전 JSON 백업'}
                  </p>
                  <ul className="space-y-0.5 text-[11px]">
                    <li>• 관리 질환: {importPreviewData.conditionsCount}건</li>
                    <li>• 통증 기록: {importPreviewData.logsCount}건</li>
                    <li>• 일기 메모: {importPreviewData.diaryCount}건</li>
                  </ul>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  복원을 진행하면 현재 기기의 기록이 위 백업 내용으로 대체됩니다.
                </p>
                {backupError && (
                  <p className="text-xs font-bold text-rose-500 flex items-center gap-1">
                    <AlertCircle size={13} /> {backupError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetBackupModal}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={confirmRestoreBackup}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs shadow-sm"
                  >
                    복원 확정
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PIN Setup/Change/Unlock Verification Modal */}
      {pinModalMode && (
        <PinModal
          isOpen={true}
          mode={pinModalMode}
          title={
            pinModalMode === 'unlock'
              ? pendingSecurityAction === 'disablePin'
                ? '앱 잠금 해제 전 본인 확인'
                : '생체인증 설정을 위한 본인 확인'
              : undefined
          }
          onSuccess={async (enteredPin) => {
            if (pinModalMode === 'unlock') {
              const res = await unlockApp(enteredPin);
              if (!res.success) {
                showToast(res.message || 'PIN이 일치하지 않습니다.');
                return;
              }

              if (pendingSecurityAction === 'disablePin') {
                await disablePin();
                setPendingSecurityAction(null);
                setPinModalMode(null);
                showToast(t('pinRemoved'));
              } else if (pendingSecurityAction === 'toggleBiometric') {
                const targetState = !isBiometricEnabled;
                setPendingSecurityAction(null);
                setPinModalMode(null);
                const success = await toggleBiometric(targetState);
                if (success) {
                  showToast(
                    targetState
                      ? '본인 확인 완료: 생체인증(지문/얼굴 인식)이 활성화되었습니다.'
                      : '본인 확인 완료: 생체인증이 비활성화되었습니다.'
                  );
                } else {
                  showToast('생체인증 설정이 취소되었거나 지원되지 않습니다.');
                }
              }
              return;
            }

            await setupNewPin(enteredPin);
            setPinModalMode(null);
            showToast(t('pinSetSuccess'));
          }}
          onCancel={() => {
            setPinModalMode(null);
            setPendingSecurityAction(null);
          }}
        />
      )}

      {/* Version badge */}
      <div className="text-center pt-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
          <Shield size={12} className="text-emerald-500" />
          Body Signal Mobile v1.1.0 (Encrypted)
        </span>
      </div>
    </div>
  );
};

export default SettingsPage;
