import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import {
  Stethoscope,
  Copy,
  Check,
  TrendingDown,
  TrendingUp,
  Minus,
  Pill,
  ShieldCheck,
  Printer,
  Calendar,
  Activity,
  AlertTriangle,
  Bot,
  Sparkles,
  FileText,
  Clock,
  RefreshCw,
  Send,
  MessageSquare,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import BodyMap from '../components/BodyMap';
import TrustBadge from '../components/TrustBadge';
import { format } from 'date-fns';
import { triggerHaptic } from '../utils/native';
import {
  categorizeByDepartment,
  DEPARTMENT_KEYS,
  DepartmentType,
  DepartmentBriefingGroup,
  generateDepartmentSummaryText,
} from '../utils/clinicalDepartments';
import {
  generateClinicalAiAnalysisStream,
  askClinicalQuestionStream,
  ChatMessage,
  LocalLlmOfflineError,
  testLocalLlmConnection,
  isOnDeviceLlmEndpoint,
} from '../utils/localLlm';

export const ClinicalBriefingPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { conditions, logs, getClinicalBriefing, generateEMRSummaryText } = useHealth();
  const { settings, resolvedLanguage, t } = useSettings();
  const isEn = resolvedLanguage === 'en';

  // Selected Department Filter ('all' or specific DepartmentType)
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Local AI State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiOfflineError, setAiOfflineError] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<'doctor' | 'patient'>('doctor');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  // Expandable Panels
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showQaPanel, setShowQaPanel] = useState(false);
  const [showEmrExportModal, setShowEmrExportModal] = useState(false);

  // Interactive Clinical Q&A State
  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
  const [qaInput, setQaInput] = useState('');
  const [isQaStreaming, setIsQaStreaming] = useState(false);

  const briefing = getClinicalBriefing();

  // Categorize conditions and logs into 4 Medical Departments (F12)
  const departmentGroups = useMemo(() => {
    return categorizeByDepartment(conditions, logs);
  }, [conditions, logs]);

  // Active groups that have conditions or logs recorded
  const activeDeptGroups = useMemo(() => {
    return departmentGroups.filter((g) => g.logCount > 0 || g.activeConditions.length > 0);
  }, [departmentGroups]);

  // Filtered groups according to user selection
  const displayedGroups = useMemo(() => {
    if (selectedDeptFilter === 'all') {
      return activeDeptGroups;
    }
    return activeDeptGroups.filter((g) => g.departmentName === selectedDeptFilter);
  }, [activeDeptGroups, selectedDeptFilter]);

  const handleCopyText = async (text: string, formatKey: string) => {
    triggerHaptic();
    await navigator.clipboard.writeText(text);
    setCopiedFormat(formatKey);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  const handleCopyDeptSummary = async (group: DepartmentBriefingGroup) => {
    triggerHaptic();
    const text = generateDepartmentSummaryText([group]);
    await navigator.clipboard.writeText(text);
    setCopiedFormat(group.departmentName);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  // F11: Local AI Generation with Offline Guard
  const handleGenerateAiAnalysis = async (personaOverride?: 'doctor' | 'patient') => {
    const personaToUse = personaOverride || activePersona;
    triggerHaptic();
    setIsGeneratingAi(true);
    setAiOfflineError(null);
    setConnectionStatus(null);
    setAiAnalysis(null);

    const contextText = generateEMRSummaryText('standard');
    try {
      await generateClinicalAiAnalysisStream(
        settings.localLlm,
        contextText,
        (_delta, accumulated) => {
          setAiAnalysis(accumulated);
        },
        personaToUse
      );
      triggerHaptic();
    } catch (err: any) {
      setAiAnalysis(null);
      const message =
        err?.message ||
        (isEn
          ? '⚠️ Local AI is offline. Please start your on-device Ollama server.'
          : '⚠️ 로컬 AI 미연결 상태입니다. Ollama 서버를 실행해 주세요.');
      setAiOfflineError(message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // F11: In-place Zero-Reload Connection Retry
  const handleRetryConnection = async () => {
    triggerHaptic();
    setIsTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await testLocalLlmConnection(settings.localLlm);
      if (res.success) {
        setAiOfflineError(null);
        setConnectionStatus(
          isEn
            ? '✓ Connected to Local AI server! Ready to generate summaries.'
            : '✓ 로컬 AI 서버 연결 성공! 이제 AI 소견 생성이 가능합니다.'
        );
      } else {
        setConnectionStatus(
          isEn ? `⚠️ Unable to connect: ${res.message}` : `⚠️ 연결 불가: ${res.message}`
        );
      }
    } catch (e: any) {
      setConnectionStatus(
        isEn ? `⚠️ Connection error: ${e.message}` : `⚠️ 연결 테스트 오류: ${e.message}`
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  // F11: Interactive Clinical Q&A with Offline Guard
  const handleSendQaMessage = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isQaStreaming) return;
    triggerHaptic();

    if (!settings.localLlm?.enabled) {
      const userMessage: ChatMessage = { role: 'user', content: trimmed };
      const offlineMsg: ChatMessage = {
        role: 'assistant',
        content: isEn
          ? '⚠️ [Local AI Disabled] Enable Local LLM in Settings → Labs first.'
          : '⚠️ [로컬 AI 미연결 상태] 로컬 AI 기능이 비활성화되어 있습니다. 설정에서 로컬 LLM을 활성화해 주세요.',
      };
      setQaMessages((prev) => [...prev, userMessage, offlineMsg]);
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const initialAssistantMessage: ChatMessage = { role: 'assistant', content: '' };
    const updatedMessages = [...qaMessages, userMessage, initialAssistantMessage];
    setQaMessages(updatedMessages);
    setQaInput('');
    setIsQaStreaming(true);

    const contextText = generateEMRSummaryText('standard');
    try {
      await askClinicalQuestionStream(
        settings.localLlm,
        trimmed,
        contextText,
        qaMessages,
        (_delta, accumulated) => {
          setQaMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
              next[lastIdx] = { ...next[lastIdx], content: accumulated };
            }
            return next;
          });
        }
      );
      triggerHaptic();
    } catch (err: any) {
      setQaMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
          next[lastIdx] = {
            ...next[lastIdx],
            content: `⚠️ [로컬 AI 미연결 상태] ${err?.message || '로컬 AI 서버에 연결할 수 없습니다. Ollama 서버를 실행한 후 다시 시도해 주세요.'}`,
          };
        }
        return next;
      });
    } finally {
      setIsQaStreaming(false);
    }
  };

  const handlePrint = () => {
    triggerHaptic();
    window.print();
  };

  if (conditions.length === 0 && logs.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
          <Stethoscope size={32} />
        </div>
        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">{t('briefingTitle')}</h2>
        <p className="text-xs text-slate-500 max-w-xs">{t('noClinicalData')}</p>
        <TrustBadge compact />
      </div>
    );
  }

  // Map body part distribution for BodyMap heatmap
  const bodyPartIntensityMap: Record<string, number> = {};
  Object.entries(briefing.bodyPartDistribution).forEach(([part, stats]) => {
    bodyPartIntensityMap[part] = stats.maxIntensity;
  });

  return (
    <div
      className={
        embedded
          ? 'space-y-4'
          : 'min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-4'
      }
    >
      {/* 1. Clinical Header with 30-Sec Doctor Mode & Secondary Actions */}
      <header className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Stethoscope size={20} />
            </span>
            {embedded ? (
              <h2 className="text-base font-black tracking-tight">{t('briefingTitle')}</h2>
            ) : (
              <h1 className="text-xl font-black tracking-tight">{t('briefingTitle')}</h1>
            )}
            <span className="text-[10px] font-extrabold uppercase bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-sm">
              {isEn ? '30s Brief' : '30초 요약'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'High-Contrast Specialty Clinical Summary' : '진료과별 고대비 임상 요약'}
          </p>
        </div>

        {/* Secondary Toolbar (Print & EMR Export) */}
        <div className="flex items-center gap-1.5 print:hidden">
          <button
            type="button"
            onClick={() => setShowEmrExportModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm active:scale-95 transition-all"
            title={isEn ? 'Export EMR Charting Text' : '병원 EMR 차팅 텍스트 내보내기'}
          >
            <FileText size={15} className="text-teal-600" />
            <span className="hidden sm:inline">{isEn ? 'EMR Copy' : 'EMR 복사'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm active:scale-95 transition-all"
            title={isEn ? 'Print Clinical Report' : '진료 리포트 인쇄'}
          >
            <Printer size={16} />
          </button>
        </div>
      </header>

      {/* 2. Red Flags Alert Banner (High-Priority Clinical Warning) */}
      {briefing.redFlagsDetected.length > 0 && (
        <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/60 p-4 shadow-md text-rose-900 dark:text-rose-100 space-y-1.5 animate-in fade-in">
          <div className="flex items-center gap-2 font-black text-sm text-rose-600 dark:text-rose-400">
            <AlertTriangle size={20} className="fill-rose-500 text-white shrink-0" />
            <span>
              {isEn ? '🚨 [Alert: Clinical Red Flags Detected]' : '🚨 [주의: 응급 위험 징후(Red Flags) 감지]'}
            </span>
          </div>
          <p className="text-xs font-semibold leading-relaxed">
            {isEn ? 'Detected urgent flags in patient logs: ' : '환자 기록 중 다음 위험 징후가 감지되었습니다: '}
            <strong className="underline text-rose-700 dark:text-rose-200">
              {briefing.redFlagsDetected.join(', ')}
            </strong>
          </p>
          <p className="text-[11px] text-rose-700 dark:text-rose-400">
            {isEn
              ? 'Prioritize neurologic, infectious, or acute differential evaluation during consultation.'
              : '단순 통증 외 신경근 압박, 척수병증, 급성 감염 여부의 우선 문진 및 감별 진단을 권고합니다.'}
          </p>
        </div>
      )}

      {/* 3. F11 Local AI Disconnection Guard Banner (Only shown when Local LLM is enabled and offline) */}
      {(settings.localLlm?.enabled && aiOfflineError) && (
        <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2.5 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {isEn
                ? '⚠️ Local AI Offline. Please start your local Ollama server.'
                : '⚠️ 로컬 AI 미연결 상태입니다. Ollama 서버를 실행해 주세요.'}
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {isEn
              ? 'Body Signal never sends health data to external clouds. AI summaries only run when an on-device loopback server is available.'
              : 'Bignal은 의료 데이터를 외부 클라우드로 전송하지 않고, 로컬 네트워크의 LLM 서버가 연결된 경우에만 분석을 생성합니다.'}
          </p>

          {/* Troubleshooting Recovery Guide */}
          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-200/60 dark:border-amber-900/60 text-[11px] space-y-1 font-mono">
            <div className="font-sans font-bold text-[10px] text-amber-900 dark:text-amber-300 uppercase">
              {isEn ? '🛠️ Connection Guide:' : '🛠️ 연결 복구 가이드:'}
            </div>
            <div className="text-slate-700 dark:text-slate-300">
              1. {isEn ? 'Start local server:' : '터미널에서 로컬 서버 실행:'}{' '}
              <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded font-bold">ollama run llama3.2</code>
            </div>
            <div className="text-slate-700 dark:text-slate-300">
              2. {isEn ? 'Check endpoint:' : '설정 엔드포인트 확인:'}{' '}
              <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">http://localhost:11434/v1</code>
            </div>
          </div>

          {/* Action buttons: Retry and Go to Settings */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isTestingConnection}
              onClick={handleRetryConnection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={isTestingConnection ? 'animate-spin' : ''} />
              {isTestingConnection
                ? isEn
                  ? 'Checking...'
                  : '연결 확인 중...'
                : isEn
                ? 'Retry Connection'
                : '서버 재연결 확인'}
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                navigate('/settings?sec=labs');
              }}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 font-bold text-xs text-amber-900 dark:text-amber-200 hover:bg-amber-50 active:scale-95 transition-all"
            >
              {isEn ? 'Lab Settings' : '실험실 설정'}
            </button>
          </div>

          {connectionStatus && (
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 pt-1">
              {connectionStatus}
            </div>
          )}
        </div>
      )}

      {/* 4. Patient High-level Triage Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            {isEn ? 'Conditions' : '관리 질환'}
          </span>
          <div className="mt-0.5 text-lg font-black text-slate-800 dark:text-slate-100">
            {briefing.patientSummary.activeConditionsCount}
            {isEn ? '' : '개'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            {isEn ? 'Total Logs' : '총 기록 건수'}
          </span>
          <div className="mt-0.5 text-lg font-black text-emerald-600 dark:text-emerald-400">
            {briefing.patientSummary.totalLogsRecorded}
            {isEn ? '' : '건'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-center shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            {isEn ? 'Days Tracked' : '추적 일수'}
          </span>
          <div className="mt-0.5 text-lg font-black text-blue-600 dark:text-blue-400">
            {briefing.patientSummary.daysTracked}
            {isEn ? 'd' : '일'}
          </div>
        </div>
      </div>

      {/* 5. Medical Department Filter Tabs (Specialty Filter) */}
      <div className="space-y-1.5 print:hidden">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {isEn ? 'Specialty Filter:' : '진료과별 즉시 포커스 (Specialty Filter):'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setSelectedDeptFilter('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDeptFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            {isEn ? `All (${activeDeptGroups.length})` : `전체 보기 (${activeDeptGroups.length})`}
          </button>
          {activeDeptGroups.map((g) => (
            <button
              key={g.departmentId}
              type="button"
              onClick={() => {
                triggerHaptic();
                setSelectedDeptFilter(g.departmentName);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedDeptFilter === g.departmentName
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              <span>{isEn ? g.meta.shortNameEn : g.meta.shortName}</span>
              <span className="text-[10px] opacity-75">({g.logCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 6. Structured Medical Department Cards (Core F12 Feature) */}
      <section className="space-y-4">
        {displayedGroups.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            {isEn ? 'No symptoms recorded for this specialty.' : '해당 진료과에 기록된 증상이 없습니다.'}
          </div>
        ) : (
          displayedGroups.map((group) => {
            return (
              <div
                key={group.departmentId}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5 transition-all"
              >
                {/* Department Card Header */}
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${group.meta.badgeColor}`}>
                        {isEn ? group.meta.nameEn : group.departmentName}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {isEn ? group.meta.descriptionEn : group.meta.description}
                      </span>
                    </div>
                    {/* Active Conditions Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {group.conditions.map((cond) => (
                        <span
                          key={cond.id}
                          className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-lg"
                        >
                          {cond.label} ({cond.bodyPart})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* One-touch Department Summary Copy */}
                  <button
                    type="button"
                    onClick={() => handleCopyDeptSummary(group)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all print:hidden"
                    title={isEn ? 'Copy department summary' : '해당 진료과 요약 클립보드 복사'}
                  >
                    {copiedFormat === group.departmentName ? <Check size={12} /> : <Copy size={12} />}
                    {copiedFormat === group.departmentName ? (isEn ? 'Copied' : '복사됨') : isEn ? 'Copy' : '과별 복사'}
                  </button>
                </div>

                {/* High-Contrast 4-Column Clinical Metrics Grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">
                      {isEn ? 'Peak' : '최고 통증'}
                    </span>
                    <span className="mt-0.5 block text-lg font-black text-rose-600 dark:text-rose-400">
                      {group.peakIntensity !== null ? `${group.peakIntensity}` : '-'}
                      <span className="text-[10px] font-normal text-slate-400">/10</span>
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">
                      {isEn ? '7d Avg' : '7일 평균'}
                    </span>
                    <span className="mt-0.5 block text-lg font-black text-slate-800 dark:text-slate-100">
                      {group.avgIntensity7Days !== null ? `${group.avgIntensity7Days}` : '-'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">
                      {isEn ? 'All Avg' : '전체 평균'}
                    </span>
                    <span className="mt-0.5 block text-lg font-black text-slate-800 dark:text-slate-100">
                      {group.avgIntensity !== null ? `${group.avgIntensity}` : '-'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">
                      {isEn ? 'Logs' : '기록 건수'}
                    </span>
                    <span className="mt-0.5 block text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {group.logCount}
                      {isEn ? '' : '건'}
                    </span>
                  </div>
                </div>

                {/* PQRST & Clinical Descriptors for Department */}
                {(group.frequentTriggers.length > 0 ||
                  group.painQualities.length > 0 ||
                  group.medications.length > 0 ||
                  group.redFlags.length > 0) && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">
                      {isEn ? 'Clinical Notes (PQRST & Meds)' : '임상 특징 (PQRST & 약물 반응)'}
                    </span>

                    {group.frequentTriggers.length > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-500 shrink-0">
                          {isEn ? 'Triggers:' : '악화 요인:'}
                        </strong>
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          {group.frequentTriggers.join(', ')}
                        </span>
                      </div>
                    )}

                    {group.painQualities.length > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-500 shrink-0">
                          {isEn ? 'Quality:' : '통증 양상:'}
                        </strong>
                        <span>{group.painQualities.join(', ')}</span>
                      </div>
                    )}

                    {group.medications.length > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-500 shrink-0">
                          {isEn ? 'Medications:' : '복용 약제:'}
                        </strong>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {group.medications.join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Department Specific Red Flags */}
                    {group.redFlags.length > 0 && (
                      <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 pt-0.5">
                        <strong className="shrink-0 font-bold">
                          {isEn ? '🚨 Red Flags:' : '🚨 위험 징후:'}
                        </strong>
                        <span className="font-bold underline">{group.redFlags.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Recent Observed Logs in Department (Top 2 logs) */}
                {group.logs.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {isEn ? 'Recent Timeline' : '최근 관찰 타임라인'}
                    </span>
                    {group.logs.slice(0, 2).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[10px] text-slate-400">
                            {format(new Date(log.date), 'MM/dd HH:mm')}
                          </span>
                          {log.medication && (
                            <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-1.5 py-0.5 rounded">
                              {log.medication}
                            </span>
                          )}
                          {log.notes && (
                            <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-[150px]">
                              "{log.notes}"
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 ml-2">
                          NRS {log.intensity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* 7. Topographical Body Map Distribution with Heatmap */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isEn ? 'BodyMap NRS Heatmap' : '환부 집중 분포 (바디맵 기반 NRS 히트맵)'}
          </h2>
          <span className="text-[10px] text-slate-400">
            {isEn ? 'Multi-region summary' : '다중 선택 환부 통합 표시'}
          </span>
        </div>
        <BodyMap readOnly intensityMap={bodyPartIntensityMap} />
      </section>

      {/* 8 & 9. Optional On-Demand Local AI Summary & Q&A (Only expanded in UI when enabled in Settings -> Labs) */}
      {settings.localLlm?.enabled ? (
        <>
          {/* 8. Optional On-Demand AI Clinical Summary (Collapsible Accordion) */}
          <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2.5 print:hidden">
        <button
          type="button"
          onClick={() => setShowAiPanel((prev) => !prev)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Bot size={15} />
            </span>
            <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
              {isEn ? 'Local AI Clinical Summary (SOAP)' : '로컬 AI 종합 임상 소견 (SOAP)'}
            </span>
          </div>
          {showAiPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAiPanel && (
          <div className="pt-2 space-y-3 border-t border-purple-100 dark:border-purple-900/40 text-xs">
            {/* Persona Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={() => {
                  triggerHaptic();
                  setActivePersona('doctor');
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activePersona === 'doctor'
                    ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200/50 dark:border-purple-800/50'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Stethoscope size={13} className={activePersona === 'doctor' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'} />
                {isEn ? 'Clinician SOAP View' : '의사용 전문 임상 요약 (SOAP)'}
              </button>
              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={() => {
                  triggerHaptic();
                  setActivePersona('patient');
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activePersona === 'patient'
                    ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200/50 dark:border-purple-800/50'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <User size={13} className={activePersona === 'patient' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'} />
                {isEn ? 'Patient Summary' : '환자용 쉬운 소견 요약'}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={() => handleGenerateAiAnalysis()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> {isEn ? 'Analyzing...' : '분석 중...'}
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> {isEn ? 'Generate AI Summary' : 'AI 소견 생성'}
                  </>
                )}
              </button>
            </div>

            {aiAnalysis && (
              <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 text-xs text-slate-700 dark:text-slate-200 space-y-2 leading-relaxed animate-in fade-in">
                <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-900 pb-1.5">
                  <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1">
                    <Sparkles size={13} />
                    {activePersona === 'doctor'
                      ? isEn
                        ? 'Local AI Clinician Summary (SOAP):'
                        : '로컬 AI 의사용 전문 임상 요약 (SOAP):'
                      : isEn
                      ? 'Local AI Patient Summary:'
                      : '로컬 AI 환자용 쉬운 소견 요약:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      navigator.clipboard.writeText(aiAnalysis);
                    }}
                    className="text-[10px] font-bold text-purple-700 dark:text-purple-300 underline"
                  >
                    {isEn ? 'Copy' : '소견 복사'}
                  </button>
                </div>
                <p className="whitespace-pre-line text-xs">{aiAnalysis}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 9. Interactive Clinical Q&A Assistant ("로컬 AI에게 내 증상 물어보기") */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 p-4 shadow-sm space-y-3.5 print:hidden">
        <button
          type="button"
          onClick={() => setShowQaPanel((prev) => !prev)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
              <MessageSquare size={16} />
            </span>
            <div>
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                {isEn ? 'Ask Local AI About My Symptoms' : '로컬 AI에게 내 증상 물어보기'}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  isOnDeviceLlmEndpoint(settings.localLlm)
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                }`}>
                  {isOnDeviceLlmEndpoint(settings.localLlm)
                    ? isEn
                      ? '100% Private Q&A'
                      : '100% 프라이빗 Q&A'
                    : isEn
                    ? 'External Host Blocked'
                    : '외부 엔드포인트 차단됨'}
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">
                {isOnDeviceLlmEndpoint(settings.localLlm)
                  ? isEn
                    ? 'Private Q&A from your logs (0% external upload)'
                    : '내 통증 기록 기반 실시간 맞춤 상담 (외부 유출 0%)'
                  : isEn
                  ? 'Security policy allows on-device (built-in / localhost) AI only'
                  : '보안 정책상 온디바이스(built-in / localhost) AI만 허용됩니다'}
              </p>
            </div>
          </div>
          {showQaPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showQaPanel && (
          <div className="pt-2 space-y-3 border-t border-indigo-100 dark:border-indigo-900/40 text-xs">
            {/* Suggested Quick Questions */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {isEn ? '💡 Suggested Questions:' : '💡 자주 묻는 질문 (원터치 선택):'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(isEn
                  ? [
                      '💊 What should I do if my medication feels less effective?',
                      '🩺 Key points to mention at my next doctor visit?',
                      '⚠️ How should I respond to detected red flags?',
                      '🏃‍♂️ Safe stretches and postures for this pain area?',
                    ]
                  : [
                      '💊 복용 중인 약 효과가 떨어질 때 어떻게 하나요?',
                      '🩺 의사 진료 시 꼭 전해야 할 핵심 포인트는?',
                      '⚠️ 감지된 위험 징후(Red Flags) 대처법은?',
                      '🏃‍♂️ 통증 부위에 좋은 스트레칭과 주의할 자세는?',
                    ]
                ).map((suggested) => (
                  <button
                    key={suggested}
                    type="button"
                    disabled={isQaStreaming}
                    onClick={() => handleSendQaMessage(suggested)}
                    className="text-[11px] font-medium bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700/60 active:scale-95 transition-all text-left disabled:opacity-50"
                  >
                    {suggested}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Message History */}
            {qaMessages.length > 0 && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                {qaMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <span className="text-[9px] font-bold text-slate-400 mb-0.5 px-1">
                      {msg.role === 'user' ? (isEn ? 'You' : '내 질문') : isEn ? '🤖 Local AI' : '🤖 로컬 AI 비서'}
                    </span>
                    <div
                      className={`p-3 rounded-2xl max-w-[90%] whitespace-pre-line leading-relaxed shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                      }`}
                    >
                      {msg.content || (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <RefreshCw size={12} className="animate-spin" /> {isEn ? 'Thinking...' : '생각 중...'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQaMessage(qaInput);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                disabled={isQaStreaming}
                placeholder={
                  isEn
                    ? 'Ask about your symptoms, meds, or visit prep...'
                    : '증상, 투약, 진료에 관해 궁금한 점을 물어보세요...'
                }
                className="flex-1 px-3 py-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!qaInput.trim() || isQaStreaming}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                {isQaStreaming ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {isEn ? 'Send' : '전송'}
              </button>
            </form>
          </div>
        )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/settings?sec=labs')}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 print:hidden"
        >
          <span className="flex items-center gap-2 font-medium">
            <Bot size={14} className="text-purple-500" />
            {isEn ? 'Local AI Clinical Summary & Q&A (Labs)' : '로컬 AI 임상 소견 · Q&A (실험실)'}
          </span>
          <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
            {isEn ? 'Enable →' : '켜기 →'}
          </span>
        </button>
      )}

      {/* 10. Secondary Convenience: EMR Export Modal */}
      {showEmrExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {isEn ? 'Export Clinical EMR Text' : '병원 EMR 차팅 텍스트 내보내기'}
              </h3>
              <button
                type="button"
                onClick={() => setShowEmrExportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {isEn
                ? 'Choose a format to copy to clipboard for clinical charting.'
                : '병원 진료실 차팅 프로그램에 붙여넣을 양식을 선택하여 클립보드로 복사합니다.'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCopyText(generateEMRSummaryText('standard'), 'modal-standard')}
                className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100 active:scale-95 transition-all"
              >
                {copiedFormat === 'modal-standard' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copiedFormat === 'modal-standard'
                  ? isEn
                    ? 'Copied!'
                    : '복사완료!'
                  : isEn
                  ? 'Standard EMR'
                  : '일반 EMR 양식'}
              </button>

              <button
                type="button"
                onClick={() => handleCopyText(generateEMRSummaryText('soap'), 'modal-soap')}
                className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100 active:scale-95 transition-all"
              >
                {copiedFormat === 'modal-soap' ? <Check size={14} className="text-emerald-500" /> : <FileText size={14} />}
                {copiedFormat === 'modal-soap'
                  ? isEn
                    ? 'SOAP Copied!'
                    : 'SOAP 복사완료!'
                  : isEn
                  ? 'SOAP Note'
                  : 'SOAP Note 양식'}
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowEmrExportModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold active:scale-95 transition-all"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trust & Privacy Notice */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 text-[11px]">
        <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
        <span>{t('privacyModeNotice')}</span>
      </div>
    </div>
  );
};

export default ClinicalBriefingPage;
