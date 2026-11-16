import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useHealth } from '../context/HealthContext';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  ShieldCheck,
  Bell,
  Moon,
  Lock,
  Globe,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Pill,
  Plus,
  X,
  Vibrate,
  ChevronRight,
  ArrowLeft,
  Bot,
  RefreshCw,
  Server,
  AlertCircle,
  Fingerprint,
  KeyRound,
  Copy,
  EyeOff,
  Sliders,
  Database,
} from 'lucide-react';
import { PinModal } from '../components/PinModal';
import DisclaimerModal from '../components/DisclaimerModal';
import { triggerHaptic } from '../utils/native';
import { testLocalLlmConnection } from '../utils/localLlm';
import { encryptBackupWithPassphrase, decryptBackupWithPassphrase } from '../utils/crypto';
import {
  generateTotpSecret,
  buildOtpAuthUri,
  generateRecoveryCodes,
  verifyTotpCode,
} from '../utils/totp';

type SettingsSection = 'root' | 'general' | 'security' | 'presets' | 'data' | 'labs';

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const secParam = searchParams.get('sec');
  const activeSection: SettingsSection =
    secParam === 'general' ||
    secParam === 'security' ||
    secParam === 'presets' ||
    secParam === 'data' ||
    secParam === 'labs'
      ? secParam
      : 'root';

  const openSection = (sec: SettingsSection) => {
    triggerHaptic();
    if (sec === 'root') {
      setSearchParams({}, { replace: false });
    } else {
      setSearchParams({ sec }, { replace: false });
    }
  };

  const {
    settings,
    t,
    setLanguage,
    setTheme,
    setHaptics,
    setQuickSos,
    setShowDiagnosticsTab,
    setReminder,
    addMedicationPreset,
    removeMedicationPreset,
    updateLocalLlm,
  } = useSettings();

  const { conditions, logs, exportBackupJson, importBackupJson, resetData } = useHealth();
  const {
    isPinSet,
    setupNewPin,
    disablePin,
    isBiometricAvailable,
    isBiometricEnabled,
    toggleBiometric,
    setupOsCredentialLock,
    isTotpEnabled,
    enableTotp,
    disableTotp,
    unlockApp,
  } = useAuth();

  // Modals state
  const [pinModalMode, setPinModalMode] = useState<'set' | 'change' | 'unlock' | null>(null);
  const [pendingSecurityAction, setPendingSecurityAction] = useState<
    'toggleBiometric' | 'disablePin' | 'disableTotp' | null
  >(null);
  const [newMedName, setNewMedName] = useState('');
  const [showAddMed, setShowAddMed] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // TOTP 2FA Modal State
  const [totpModalOpen, setTotpModalOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpRecoveryCodes, setTotpRecoveryCodes] = useState<string[]>([]);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [totpSetupError, setTotpSetupError] = useState('');

  // Local LLM State
  const [isTestingLlm, setIsTestingLlm] = useState(false);
  const [llmTestStatus, setLlmTestStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // Encrypted Backup Modal State
  const [backupModalMode, setBackupModalMode] = useState<'export' | 'importDecrypt' | 'importPreview' | null>(null);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
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

  // Lock background scroll whenever any modal is open
  useEffect(() => {
    if (!totpModalOpen && !backupModalMode) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [totpModalOpen, backupModalMode]);

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
    setPendingSecurityAction('toggleBiometric');
    setPinModalMode('unlock');
  };

  const handleEnableOsCredentialDirect = async () => {
    triggerHaptic();
    const ok = await setupOsCredentialLock();
    if (ok) {
      showToast('안드로이드 지문·PIN·비밀번호 잠금이 활성화되었습니다.');
    } else {
      showToast('기기 잠금 등록이 취소되었거나 OS 잠금이 설정되어 있지 않습니다.');
    }
  };

  const handleToggleTotp = () => {
    triggerHaptic();
    if (!isPinSet) {
      showToast('2단계 인증을 사용하려면 먼저 앱 잠금을 활성화하세요.');
      return;
    }
    if (isTotpEnabled) {
      setPendingSecurityAction('disableTotp');
      setPinModalMode('unlock');
      return;
    }
    setTotpSecret(generateTotpSecret());
    setTotpRecoveryCodes(generateRecoveryCodes(8));
    setTotpVerifyCode('');
    setTotpSetupError('');
    setTotpModalOpen(true);
  };

  const confirmEnableTotp = async () => {
    const valid = await verifyTotpCode(totpSecret, totpVerifyCode);
    if (!valid) {
      setTotpSetupError('인증 앱의 6자리 코드가 일치하지 않습니다.');
      return;
    }
    await enableTotp(totpSecret, totpRecoveryCodes);
    setTotpModalOpen(false);
    setTotpSecret('');
    setTotpRecoveryCodes([]);
    setTotpVerifyCode('');
    showToast('2단계 인증(TOTP 2FA)이 활성화되었습니다.');
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
      setBackupError('백업 암호는 최소 6자 이상이어야 합니다.');
      return;
    }
    if (backupPassphrase !== backupPassphraseConfirm) {
      setBackupError('입력한 두 암호가 일치하지 않습니다.');
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
      showToast('AES-256 암호화 백업이 다운로드되었습니다.');
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
          cond?.label || '원인 미상',
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

      if (parsed?.format === 'bignal-encrypted-backup-v1' || (parsed?.data?.ct && parsed?.data?.salt && parsed?.data?.iv)) {
        setPendingImportRaw(text);
        setBackupPassphrase('');
        setBackupError('');
        setBackupModalMode('importDecrypt');
        return;
      }

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
      setBackupError('백업 암호를 입력하세요.');
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
      setBackupError(err?.message || '백업 암호가 일치하지 않습니다.');
    }
  };

  const confirmRestoreBackup = async () => {
    if (!importPreviewData) return;
    try {
      triggerHaptic();
      await importBackupJson(importPreviewData.jsonStr);
      resetBackupModal();
      showToast('백업이 복원되었습니다.');
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

  const sectionTitles: Record<SettingsSection, string> = {
    root: t('settingsTitle'),
    general: '화면 및 사용성',
    security: '보안 및 잠금',
    presets: '약물 상용구 관리',
    data: '백업 및 데이터',
    labs: '실험실 (개발 중)',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-24 text-slate-800 dark:text-slate-100 space-y-4">
      {/* Header with Multi-Depth Back Navigation */}
      <header className="flex items-center gap-2">
        {activeSection !== 'root' && (
          <button
            type="button"
            onClick={() => openSection('root')}
            aria-label="설정 목록으로"
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="text-xl font-bold">{sectionTitles[activeSection]}</h1>
      </header>

      {feedbackMsg && (
        <div className="rounded-xl bg-teal-700 text-white p-3 text-xs font-bold text-center shadow-sm">
          {feedbackMsg}
        </div>
      )}

      {/* DEPTH 1: Hierarchical Category Index */}
      {activeSection === 'root' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
            <button
              type="button"
              onClick={() => openSection('general')}
              className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <Sliders size={18} />
                </div>
                <div>
                  <span className="font-bold text-sm block">화면 및 사용성</span>
                  <span className="text-[11px] text-slate-400">
                    테마 · 언어 · 하단 패널 · 알림
                  </span>
                </div>
              </div>
              <ChevronRight size={17} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => openSection('security')}
              className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
                  <Shield size={18} />
                </div>
                <div>
                  <span className="font-bold text-sm block">보안 및 잠금</span>
                  <span className="text-[11px] text-slate-400">
                    {isPinSet ? '잠금 활성' : '미설정'} ·{' '}
                    {isTotpEnabled ? '2FA 활성' : '2FA 꺼짐'} · 캡처 차단 ON
                  </span>
                </div>
              </div>
              <ChevronRight size={17} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => openSection('presets')}
              className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Pill size={18} />
                </div>
                <div>
                  <span className="font-bold text-sm block">약물 상용구 관리</span>
                  <span className="text-[11px] text-slate-400">
                    등록된 약물 {settings.medicationPresets.length}개
                  </span>
                </div>
              </div>
              <ChevronRight size={17} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => openSection('data')}
              className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  <Database size={18} />
                </div>
                <div>
                  <span className="font-bold text-sm block">백업 및 데이터</span>
                  <span className="text-[11px] text-slate-400">
                    AES-256 암호화 백업 · CSV · 초기화
                  </span>
                </div>
              </div>
              <ChevronRight size={17} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => openSection('labs')}
              className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Bot size={18} />
                </div>
                <div>
                  <span className="font-bold text-sm block">실험실 (개발 중)</span>
                  <span className="text-[11px] text-slate-400">
                    로컬 LLM 연동 ({settings.localLlm.enabled ? '활성' : '비활성'})
                  </span>
                </div>
              </div>
              <ChevronRight size={17} className="text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* DEPTH 2A: General & Navigation Preferences */}
      {activeSection === 'general' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          {/* Language */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe size={18} className="text-slate-500" />
              <span className="font-bold text-xs">{t('languageSetting')}</span>
            </div>
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                type="button"
                onClick={() => setLanguage('ko')}
                className={`px-2.5 py-1 rounded-md font-bold ${
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
                className={`px-2.5 py-1 rounded-md font-bold ${
                  settings.language === 'en'
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon size={18} className="text-slate-500" />
              <span className="font-bold text-xs">{t('themeSetting')}</span>
            </div>
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              {(['light', 'dark', 'system'] as const).map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => setTheme(th)}
                  className={`px-2 py-1 rounded-md font-bold ${
                    settings.theme === th
                      ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-400'
                  }`}
                >
                  {th === 'light' ? t('themeLight') : th === 'dark' ? t('themeDark') : t('themeSystem')}
                </button>
              ))}
            </div>
          </div>

          {/* Haptics */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Vibrate size={18} className="text-slate-500" />
              <span className="font-bold text-xs">{t('hapticsSetting')}</span>
            </div>
            <button
              type="button"
              onClick={() => setHaptics(!settings.hapticsEnabled)}
              className={`w-11 h-6 rounded-full transition-colors ${
                settings.hapticsEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.hapticsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Optional Bottom Bar Shortcut: Diagnostics */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="pr-3">
              <span className="font-bold text-xs block">하단 패널에 진단·실손 바로가기 추가</span>
              <span className="text-[10px] text-slate-400">끄면 기본 4개 탭으로 간결하게 유지됩니다</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDiagnosticsTab(!settings.showDiagnosticsTab)}
              className={`w-11 h-6 rounded-full shrink-0 transition-colors ${
                settings.showDiagnosticsTab ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.showDiagnosticsTab ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Optional Floating SOS Button */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="pr-3">
              <span className="font-bold text-xs block">{t('quickSosSetting')}</span>
              <span className="text-[10px] text-slate-400">모든 화면 우하단에 플로팅 긴급 버튼 표시</span>
            </div>
            <button
              type="button"
              aria-label="상시 긴급 통증 SOS 위젯 표시 토글"
              onClick={() => setQuickSos(!settings.quickSosEnabled)}
              className={`w-11 h-6 rounded-full shrink-0 transition-colors ${
                settings.quickSosEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.quickSosEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Daily Reminder */}
          <div className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell size={18} className="text-slate-500" />
                <span className="font-bold text-xs">{t('dailyReminder')}</span>
              </div>
              <button
                type="button"
                onClick={() => setReminder(!settings.reminderEnabled)}
                className={`w-11 h-6 rounded-full transition-colors ${
                  settings.reminderEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
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
              <div className="flex items-center justify-between pl-7">
                <span className="text-xs text-slate-500">{t('reminderTimeSetting')}</span>
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
      )}

      {/* DEPTH 2B: Security & Lock */}
      {activeSection === 'security' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-indigo-500" />
              <div>
                <span className="font-bold text-xs block">{t('appLockPin')}</span>
                <span className="text-[10px] text-slate-400">AES-256 데이터 잠금</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTogglePin}
              className={`w-11 h-6 rounded-full transition-colors ${
                isPinSet ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
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
              className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-teal-700 dark:text-teal-400"
            >
              <span>{t('changePin')}</span>
              <ChevronRight size={16} />
            </button>
          )}

          {!isPinSet && isBiometricAvailable && (
            <button
              type="button"
              onClick={handleEnableOsCredentialDirect}
              className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <Fingerprint size={18} className="text-teal-600" />
                <div>
                  <span className="font-bold text-xs block">안드로이드 지문·기기 잠금 바로 사용</span>
                  <span className="text-[10px] text-slate-400">기기에 저장된 지문·PIN·비밀번호 연동</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          )}

          {isPinSet && isBiometricAvailable && (
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Fingerprint size={18} className="text-teal-600" />
                <div>
                  <span className="font-bold text-xs block">{t('biometricsSetting')}</span>
                  <span className="text-[10px] text-slate-400">OS 지문 · PIN · 비밀번호 잠금 해제</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="생체인증 잠금 해제 전환"
                onClick={handleToggleBiometric}
                className={`w-11 h-6 rounded-full transition-colors ${
                  isBiometricEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
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

          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-purple-600" />
              <div>
                <span className="font-bold text-xs block">2단계 인증 (OTP 2FA)</span>
                <span className="text-[10px] text-slate-400">Google Authenticator, Aegis 등 표준 OTP 지원</span>
              </div>
            </div>
            <button
              type="button"
              aria-label="2단계 인증 토글"
              onClick={handleToggleTotp}
              className={`w-11 h-6 rounded-full transition-colors ${
                isTotpEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isTotpEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <EyeOff size={18} className="text-slate-500" />
              <div>
                <span className="font-bold text-xs block">스크린샷 · Gemini 공유 차단</span>
                <span className="text-[10px] text-slate-400">FLAG_SECURE · Assist 컨텍스트 상시 차단</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
              ON
            </span>
          </div>
        </div>
      )}

      {/* DEPTH 2C: Medication Presets */}
      {activeSection === 'presets' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('manageMedPresets')}</span>
            <button
              type="button"
              onClick={() => setShowAddMed(!showAddMed)}
              className="text-xs font-bold text-teal-600 flex items-center gap-1"
            >
              <Plus size={14} /> {t('addPresetBtn')}
            </button>
          </div>

          {showAddMed && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="약물명 (예: 타이레놀 500mg)"
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs"
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
                className="px-3 rounded-xl bg-teal-700 text-white font-bold text-xs"
              >
                {t('save')}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {settings.medicationPresets.map((preset) => (
              <span
                key={preset.id}
                className="flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300"
              >
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
      )}

      {/* DEPTH 2D: Data & Backups */}
      {activeSection === 'data' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          <button
            type="button"
            onClick={handleExportJson}
            className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <div className="flex items-center gap-3">
              <Download size={18} className="text-emerald-600" />
              <div>
                <span className="font-bold text-xs block">{t('exportJson')} (AES-256)</span>
                <span className="text-[10px] text-slate-400">암호 설정 후 암호화 파일 저장</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={18} className="text-teal-600" />
              <div>
                <span className="font-bold text-xs block">{t('exportCsv')}</span>
                <span className="text-[10px] text-slate-400">진료 참고용 표 형식 내보내기</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>

          <label className="w-full text-left p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            <div className="flex items-center gap-3">
              <Upload size={18} className="text-amber-600" />
              <div>
                <span className="font-bold text-xs block">{t('importBackup')}</span>
                <span className="text-[10px] text-slate-400">복호화 및 미리보기 후 복원</span>
              </div>
            </div>
            <input type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
            <ChevronRight size={16} className="text-slate-300" />
          </label>

          <button
            type="button"
            onClick={handleReset}
            className="w-full text-left p-3.5 flex items-center justify-between hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600"
          >
            <div className="flex items-center gap-3">
              <Trash2 size={18} />
              <div>
                <span className="font-bold text-xs block">{t('resetApp')}</span>
                <span className="text-[10px] text-slate-400">기기 내 기록·사진·키 영구 삭제</span>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* DEPTH 2E: Experimental Labs (Local LLM, hidden from root clutter) */}
      {activeSection === 'labs' && (
        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  로컬 LLM (오프라인 프라이빗 AI)
                </h2>
                <span className="text-[10px] text-slate-400">
                  로컬 LLM 임상 보조 연동 · HTTPS/로컬 전용
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.localLlm.enabled}
                onChange={(e) => updateLocalLlm({ enabled: e.target.checked })}
                className="h-5 w-5 accent-teal-600 rounded cursor-pointer"
              />
            </div>

            {settings.localLlm.enabled && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    엔드포인트 URL (OpenAI 호환)
                  </label>
                  <input
                    type="text"
                    value={settings.localLlm.endpoint}
                    onChange={(e) => updateLocalLlm({ endpoint: e.target.value })}
                    placeholder="built-in://edge-ai 또는 http://localhost:11434/v1"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => updateLocalLlm({ endpoint: 'built-in://edge-ai', model: 'gemini-nano' })}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                    >
                      {t('edgeAiPreset')}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLocalLlm({ endpoint: 'http://localhost:11434/v1', model: 'llama3.2' })}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500"
                    >
                      Ollama 로컬 (11434)
                    </button>
                    {import.meta.env.DEV && (
                      <button
                        type="button"
                        onClick={() => updateLocalLlm({ endpoint: 'http://10.0.2.2:11434/v1', model: 'llama3.2' })}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500"
                      >
                        에뮬레이터 (DEV)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => updateLocalLlm({ endpoint: 'http://localhost:1234/v1', model: 'llama3.2' })}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500"
                    >
                      LM Studio (1234)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    모델명 (Model)
                  </label>
                  <input
                    type="text"
                    value={settings.localLlm.model}
                    onChange={(e) => updateLocalLlm({ model: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['llama3.2', 'phi3', 'mistral', 'gemma2'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updateLocalLlm({ model: m })}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          settings.localLlm.model === m
                            ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isTestingLlm}
                  onClick={handleTestLlm}
                  className="w-full py-2.5 rounded-xl bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isTestingLlm ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> {t('testingLlm')}
                    </>
                  ) : (
                    <>
                      <Server size={14} /> 로컬 LLM 연결 테스트
                    </>
                  )}
                </button>

                {llmTestStatus && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-medium ${
                      llmTestStatus.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {llmTestStatus.msg}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Encrypted Backup Modal (Portal + Scroll-Lock) */}
      {backupModalMode &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={resetBackupModal}
            className="fixed inset-0 z-[9998] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={18} className="text-teal-600" />
                  <h3 className="font-bold text-sm">
                    {backupModalMode === 'export'
                      ? '암호화 백업 내보내기'
                      : backupModalMode === 'importDecrypt'
                      ? '암호화 백업 복호화'
                      : '백업 복원 미리보기'}
                  </h3>
                </div>
                <button type="button" onClick={resetBackupModal} className="text-slate-400">
                  <X size={18} />
                </button>
              </div>

              {backupModalMode === 'export' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    AES-256 암호화에 사용할 암호(6자 이상)를 입력하세요.
                  </p>
                  <input
                    type="password"
                    value={backupPassphrase}
                    onChange={(e) => setBackupPassphrase(e.target.value)}
                    placeholder="백업 암호 입력"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  <input
                    type="password"
                    value={backupPassphraseConfirm}
                    onChange={(e) => setBackupPassphraseConfirm(e.target.value)}
                    placeholder="백업 암호 확인"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  {backupError && <p className="text-xs font-bold text-rose-500">{backupError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetBackupModal}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={confirmEncryptedExport}
                      className="flex-1 py-2.5 rounded-xl bg-teal-700 text-white text-xs font-bold"
                    >
                      암호화 저장
                    </button>
                  </div>
                </div>
              )}

              {backupModalMode === 'importDecrypt' && (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={backupPassphrase}
                    onChange={(e) => setBackupPassphrase(e.target.value)}
                    placeholder="백업 암호 입력"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  {backupError && <p className="text-xs font-bold text-rose-500">{backupError}</p>}
                  <button
                    type="button"
                    onClick={handleDecryptBackupPreview}
                    className="w-full py-2.5 rounded-xl bg-teal-700 text-white text-xs font-bold"
                  >
                    복호화 및 미리보기
                  </button>
                </div>
              )}

              {backupModalMode === 'importPreview' && importPreviewData && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                    <p className="font-bold">
                      {importPreviewData.isEncrypted ? '✓ SHA-256 무결성 검증 완료' : '⚠️ 구버전 평문 JSON'}
                    </p>
                    <p>질병 {importPreviewData.conditionsCount}건 · 기록 {importPreviewData.logsCount}건 · 일기 {importPreviewData.diaryCount}건</p>
                  </div>
                  {backupError && <p className="text-xs font-bold text-rose-500">{backupError}</p>}
                  <button
                    type="button"
                    onClick={confirmRestoreBackup}
                    className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold"
                  >
                    복원 확정
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* TOTP 2FA Setup Modal (Google Authenticator + Aegis compatible) */}
      {totpModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setTotpModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-teal-600" />
                  <h3 className="font-bold text-sm">2단계 인증 (OTP 2FA) 설정</h3>
                </div>
                <button type="button" onClick={() => setTotpModalOpen(false)} className="text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <p>1. Google Authenticator 또는 Aegis 등 OTP 앱에 키를 등록하세요.</p>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-100 break-all flex items-center justify-between gap-2">
                  <span>{totpSecret}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(buildOtpAuthUri(totpSecret));
                      showToast('OTP 등록 URI가 복사되었습니다.');
                    }}
                    className="shrink-0 px-2 py-1 rounded bg-teal-700 text-white text-[10px] font-bold flex items-center gap-1"
                  >
                    <Copy size={11} /> 복사
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  2. 일회용 복구 코드 보관
                </p>
                <div className="grid grid-cols-2 gap-1.5 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 font-mono text-[11px]">
                  {totpRecoveryCodes.map((code) => (
                    <div key={code}>{code}</div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpVerifyCode}
                  onChange={(e) => {
                    setTotpVerifyCode(e.target.value);
                    setTotpSetupError('');
                  }}
                  placeholder="인증 앱 6자리 코드 입력"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-mono text-sm font-bold tracking-widest"
                />
                {totpSetupError && (
                  <p className="text-xs font-bold text-rose-500 flex items-center gap-1">
                    <AlertCircle size={13} /> {totpSetupError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={confirmEnableTotp}
                className="w-full py-2.5 rounded-xl bg-teal-700 text-white font-bold text-xs"
              >
                2단계 인증 활성화
              </button>
            </div>
          </div>,
          document.body
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
                : pendingSecurityAction === 'disableTotp'
                ? '2단계 인증 해제를 위한 본인 확인'
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
              } else if (pendingSecurityAction === 'disableTotp') {
                await disableTotp();
                setPendingSecurityAction(null);
                setPinModalMode(null);
                showToast('2단계 인증이 해제되었습니다.');
              } else if (pendingSecurityAction === 'toggleBiometric') {
                const targetState = !isBiometricEnabled;
                setPendingSecurityAction(null);
                setPinModalMode(null);
                const success = await toggleBiometric(targetState);
                showToast(
                  success
                    ? targetState
                      ? '생체인증이 활성화되었습니다.'
                      : '생체인증이 비활성화되었습니다.'
                    : '생체인증 설정이 취소되었거나 지원되지 않습니다.'
                );
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

      {showDisclaimerModal && (
        <DisclaimerModal
          mode="view"
          acceptedAt={settings.disclaimerAcceptedAt}
          onClose={() => setShowDisclaimerModal(false)}
        />
      )}

      <div className="text-center pt-2 space-y-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setShowDisclaimerModal(true);
          }}
          className="text-[11px] font-bold text-slate-500 hover:text-teal-600 dark:text-slate-400 underline underline-offset-2"
        >
          면책조항 및 이용 안내 보기
        </button>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
            <Shield size={12} className="text-teal-600" />
            Body Signal Mobile v1.2.1 (Encrypted)
          </span>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
