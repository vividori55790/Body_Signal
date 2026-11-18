import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Pill,
  // Zap,
  FolderPlus,
  BarChart3,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { Condition, PainLog, UNASSIGNED_CONDITION_ID } from '../types/health';
import { triggerHaptic } from '../utils/native';
import { computeTreatmentMetrics } from '../utils/treatmentMetrics';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import CalendarHeatmap from '../components/CalendarHeatmap';
import QuickPainLogger from '../components/QuickPainLogger';
import DefaultClosedSuggestion from '../components/DefaultClosedSuggestion';
import TrustBadge from '../components/TrustBadge';
// 1초 급성 통증 입력은 사용자 요청으로 일시 주석 처리함
// import { useAcutePain } from '../context/AcutePainContext';

const DetailedConditionCard: React.FC<{
  condition: Condition;
  logs: PainLog[];
  isArchived?: boolean;
}> = ({ condition, logs, isArchived = false }) => {
  const navigate = useNavigate();
  const { updateCondition } = useHealth();
  const { settings, t } = useSettings();
  const isEn = settings.language === 'en';
  const [isExpanded, setIsExpanded] = useState(false);

  const conditionLogs = logs
    .filter((l) => l.conditionId === condition.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const lastLog = conditionLogs[conditionLogs.length - 1];
  const recentThreeLogs = [...conditionLogs].reverse().slice(0, 3);

  const avgIntensity = conditionLogs.length
    ? (conditionLogs.reduce((a, b) => a + b.intensity, 0) / conditionLogs.length).toFixed(1)
    : '0';

  const chartData = conditionLogs
    .map((l) => ({
      date: l.date,
      value: l.intensity,
    }))
    .slice(-10);

  const handleToggleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    await updateCondition(condition.id, { isArchived: !isArchived });
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all overflow-hidden ${
        isExpanded ? 'ring-1 ring-teal-500/40' : ''
      }`}
    >
      <div className="p-3.5 flex justify-between items-center select-none">
        <div
          className="flex-1 min-w-0 pr-2 cursor-pointer hover:opacity-85 transition-opacity"
          onClick={() => {
            triggerHaptic();
            navigate(`/condition/${condition.id}`);
          }}
        >
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate underline-offset-2 hover:underline">
              {condition.label}
            </h3>
            {isArchived && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold shrink-0">
                {isEn ? 'Resolved' : '종료'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {condition.bodyPart} ·{' '}
            {isEn
              ? `${conditionLogs.length} logs · Avg ${avgIntensity}`
              : `${conditionLogs.length}건 · 평균 ${avgIntensity}`}
          </p>
        </div>

        <button
          type="button"
          aria-label={
            isExpanded
              ? isEn
                ? 'Collapse recent logs'
                : '최근 기록 접기'
              : isEn
              ? 'Expand recent logs'
              : '최근 기록 펼치기'
          }
          onClick={() => {
            triggerHaptic();
            setIsExpanded(!isExpanded);
          }}
          className="flex items-center gap-2.5 text-right shrink-0 p-1 -mr-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {lastLog && (
            <span
              className={`px-2 py-0.5 rounded-lg text-sm font-black ${
                lastLog.intensity >= 8
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : lastLog.intensity >= 5
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {lastLog.intensity}
            </span>
          )}
          <div className="text-slate-400">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>
      </div>

      {chartData.length > 1 && (
        <div className={`px-3.5 opacity-80 ${isExpanded ? 'h-14 py-1' : 'h-8'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <YAxis domain={[0, 10]} hide />
              <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} dot={isExpanded} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3.5 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-semibold">{isEn ? 'Recent Logs' : '최근 기록'}</span>
            <button
              type="button"
              onClick={handleToggleArchive}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <CheckCircle size={12} />
              {isArchived ? t('restoreCondition') : t('archiveCondition')}
            </button>
          </div>

          {recentThreeLogs.length > 0 && (
            <div className="space-y-1">
              {recentThreeLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-black text-[11px] text-slate-700 dark:text-slate-200">
                      NRS {log.intensity}
                    </span>
                    <span className="text-slate-400 text-[11px] shrink-0">
                      {new Date(log.date).toLocaleDateString(isEn ? 'en-US' : 'ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                    {log.medication && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 font-bold truncate">
                        {log.medication}
                      </span>
                    )}
                  </div>
                  {log.notes && (
                    <span className="text-[11px] text-slate-400 truncate max-w-[110px]">{log.notes}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-label="이 질환 상세 기록"
              onClick={() => {
                triggerHaptic();
                navigate('/entry', { state: { selectedConditionId: condition.id } });
              }}
              className="py-2 px-3 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1"
            >
              <Plus size={14} /> {isEn ? 'Add Symptom' : '증상 추가'}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                navigate(`/condition/${condition.id}`);
              }}
              className="py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1"
            >
              {isEn ? 'Details' : '질병 상세'} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { conditions, logs, diaryEntries, diagnosticRecords, updateLog } = useHealth();
  // const { openAcute } = useAcutePain();
  const {
    settings,
    t,
    setDefaultQuickLoggerOpen,
    recordCollapsibleDismissal,
  } = useSettings();

  const [filter, setFilter] = useState<'All' | 'Critical' | 'Improved'>('All');
  const [showArchived, setShowArchived] = useState(false);
  const [showQuickLogger, setShowQuickLogger] = useState(
    settings.defaultQuickLoggerOpen ?? true
  );
  const [usedQuickLogger, setUsedQuickLogger] = useState(false);
  const [showQuickLoggerPrompt, setShowQuickLoggerPrompt] = useState(false);

  useEffect(() => {
    setShowQuickLogger(settings.defaultQuickLoggerOpen ?? true);
  }, [settings.defaultQuickLoggerOpen]);

  const handleToggleQuickLogger = async () => {
    triggerHaptic();
    if (showQuickLogger) {
      setShowQuickLogger(false);
      const shouldAsk = await recordCollapsibleDismissal('quickLogger', usedQuickLogger);
      if (shouldAsk) {
        setShowQuickLoggerPrompt(true);
      }
    } else {
      setUsedQuickLogger(false);
      setShowQuickLoggerPrompt(false);
      setShowQuickLogger(true);
    }
  };
  const [dismissedMedId, setDismissedMedId] = useState<string | null>(null);
  const [medRatingSaved, setMedRatingSaved] = useState<boolean>(false);
  const [selectedSideEffects, setSelectedSideEffects] = useState<string[]>([]);

  const activeConditions = conditions.filter((c) => !c.isArchived);
  const archivedConditions = conditions.filter((c) => c.isArchived);
  const unassignedLogs = logs.filter((l) => l.conditionId === UNASSIGNED_CONDITION_ID);
  const metrics = useMemo(
    () => computeTreatmentMetrics(conditions, logs, diaryEntries, diagnosticRecords),
    [conditions, logs, diaryEntries, diagnosticRecords]
  );
  const unassignedPreviewParts = useMemo(
    () =>
      Array.from(new Set(unassignedLogs.map((l) => l.bodyPartOverride).filter(Boolean))).slice(0, 3),
    [unassignedLogs]
  );

  const recentLogs = logs.filter((l) => Date.now() - new Date(l.date).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const weeklyAvg = recentLogs.length
    ? (recentLogs.reduce((a, b) => a + b.intensity, 0) / recentLogs.length).toFixed(1)
    : '0';

  const recentMedLog = logs.find((l) => {
    if (!l.medication || l.medication.trim().length === 0) return false;
    if (l.postMedIntensity !== undefined && l.postMedIntensity !== null) return false;
    if (dismissedMedId === l.id) return false;
    const diffHours = (Date.now() - new Date(l.date).getTime()) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 24;
  });

  const recentMedCondition = recentMedLog
    ? conditions.find((c) => c.id === recentMedLog.conditionId)
    : null;

  const elapsedMinutes = recentMedLog
    ? Math.max(0, Math.floor((Date.now() - new Date(recentMedLog.date).getTime()) / (1000 * 60)))
    : 0;
  const isEn = settings.language === 'en';
  const elapsedBadge =
    elapsedMinutes < 60
      ? isEn
        ? `${elapsedMinutes}m ago`
        : `${elapsedMinutes}분 경과`
      : isEn
      ? `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m ago`
      : `${Math.floor(elapsedMinutes / 60)}시간 ${elapsedMinutes % 60}분 경과`;

  const QUICK_SIDE_EFFECTS = isEn
    ? ['Heartburn', 'Dizziness', 'Nausea', 'Drowsiness', 'Rash']
    : ['속쓰림', '어지러움', '구역감', '졸림', '두드러기'];

  const handleSelectMedResponse = async (targetIntensity: number) => {
    if (!recentMedLog) return;
    triggerHaptic();
    await updateLog(recentMedLog.id, {
      postMedIntensity: targetIntensity,
      postMedSideEffects: selectedSideEffects,
      postMedEvaluatedAt: new Date().toISOString(),
    });
    setMedRatingSaved(true);
    setTimeout(() => {
      setMedRatingSaved(false);
      setSelectedSideEffects([]);
    }, 2000);
  };

  const filteredConditions = activeConditions.filter((c) => {
    if (filter === 'All') return true;
    const cLogs = logs
      .filter((l) => l.conditionId === c.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!cLogs.length) return false;
    const last = cLogs[cLogs.length - 1];
    const prev = cLogs[cLogs.length - 2];
    if (filter === 'Critical') return last.intensity >= 7;
    if (filter === 'Improved') return prev && last.intensity < prev.intensity;
    return false;
  });

  const openGroupModal = () => {
    triggerHaptic();
    navigate('/history?group=unassigned');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-24 text-slate-800 dark:text-slate-100 space-y-4">
      {/* 1. Compact Header + Trust Pill + Weekly Summary */}
      <header className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('dashTitle')}</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
              <span>
                {isEn
                  ? `${activeConditions.length} tracked · ${logs.length} logs · 7d avg `
                  : `추적 질병 ${activeConditions.length}개 · 누적 ${logs.length}건 · 7일 평균 `}
                <strong className="text-slate-700 dark:text-slate-200">{weeklyAvg}</strong>
              </span>
              {unassignedLogs.length > 0 && (
                <button
                  type="button"
                  onClick={openGroupModal}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold border border-amber-300/70 dark:border-amber-800"
                >
                  {isEn ? `${unassignedLogs.length} unassigned` : `미분류 ${unassignedLogs.length}건`}
                </button>
              )}
            </p>
          </div>
          <TrustBadge compact />
        </div>

        {/* Primary Entry Row (1-Sec Acute Mode commented out per feedback; Full Entry + 3-Sec Quick Logger remain) */}
        <div className="grid grid-cols-1 gap-2">
          {/* 1초 급성 입력 일시 주석 처리
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              openAcute();
            }}
            aria-label="🚨 지금 너무 아파요 (1초 급성 통증 기록)"
            className="py-2.5 px-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
          >
            <Zap size={14} /> {isEn ? '1-Sec Acute Log' : '1초 급성 기록'}
          </button>
          */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              navigate('/entry');
            }}
            className="py-2.5 px-3 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
          >
            <Plus size={15} /> {isEn ? 'Full Entry' : '상세 기록'}
          </button>
        </div>

        <button
          type="button"
          onClick={handleToggleQuickLogger}
          className="w-full py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 hover:text-teal-600"
        >
          {showQuickLogger
            ? isEn
              ? 'Collapse Quick Logger ▲'
              : '빠른 기록 접기 ▲'
            : isEn
            ? 'Expand 3-Sec Quick Logger ▼'
            : '홈에서 바로 3초 기록 펼치기 ▼'}
        </button>

        {showQuickLoggerPrompt && (
          <DefaultClosedSuggestion
            featureName={isEn ? 'Quick Logger' : '홈 3초 기록'}
            onConfirmDefaultClosed={async () => {
              triggerHaptic();
              await setDefaultQuickLoggerOpen(false);
              setShowQuickLoggerPrompt(false);
            }}
            onKeepOpen={async () => {
              triggerHaptic();
              await recordCollapsibleDismissal('quickLogger', true);
              setShowQuickLoggerPrompt(false);
            }}
          />
        )}

        {showQuickLogger && (
          <QuickPainLogger
            onSaved={async () => {
              setUsedQuickLogger(true);
              setShowQuickLoggerPrompt(false);
              await recordCollapsibleDismissal('quickLogger', true);
            }}
          />
        )}
      </header>

      {/* 2. Medication Follow-up Card (Only when pending within 24h) */}
      {recentMedLog && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill size={16} className="text-blue-600 dark:text-blue-400" />
              <div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block">
                  {isEn ? 'Medication Follow-up' : '약효 확인 및 재평가'} · {elapsedBadge}
                </span>
                <h3 className="font-bold text-xs">
                  {isEn ? 'Did the medication help relieve your pain?' : '방금 드신 약의 효과가 나타났나요?'}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedMedId(recentMedLog.id)}
              className="text-[11px] text-slate-400"
            >
              {t('close')}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
            <span>
              {recentMedLog.medication}
              {recentMedCondition ? ` (${recentMedCondition.label})` : ''}
            </span>
            <span>
              {isEn ? `Initial NRS ${recentMedLog.intensity}` : `복용 시 NRS ${recentMedLog.intensity}`}
            </span>
          </div>

          {medRatingSaved ? (
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs text-center">
              {isEn ? 'Medication response saved' : '약효 반응이 저장되었습니다'}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {QUICK_SIDE_EFFECTS.map((se) => {
                  const isSelected = selectedSideEffects.includes(se);
                  return (
                    <button
                      key={se}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedSideEffects((prev) =>
                          prev.includes(se) ? prev.filter((s) => s !== se) : [...prev, se]
                        );
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        isSelected
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      {se}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  {
                    label: isEn ? 'Much Better' : '훨씬 편해요',
                    val: Math.max(0, recentMedLog.intensity - 3),
                    cls: 'bg-emerald-600 text-white',
                  },
                  {
                    label: isEn ? 'Better' : '덜 아파요',
                    val: Math.max(0, recentMedLog.intensity - 1),
                    cls: 'bg-teal-600 text-white',
                  },
                  {
                    label: isEn ? 'Same' : '비슷해요',
                    val: recentMedLog.intensity,
                    cls: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
                  },
                  {
                    label: isEn ? 'Worse' : '더 아파요',
                    val: Math.min(10, recentMedLog.intensity + 1),
                    cls: 'bg-rose-700 text-white',
                  },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleSelectMedResponse(opt.val)}
                    className={`py-2 px-1 rounded-xl font-bold text-[11px] ${opt.cls}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. Quantitative Treatment Summary (Shown once user has meaningful tracking activity) */}
      {metrics.hasEnoughUsage && (
        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/20 p-3.5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1.5">
              <BarChart3 size={14} className="text-emerald-600 dark:text-emerald-400" />
              {isEn ? 'Treatment & Pain Outcome Summary' : '질병 치료 · 통증 개선 요약'}
            </h3>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                navigate('/history?tab=stats');
              }}
              className="text-[11px] font-bold text-teal-700 dark:text-teal-400 flex items-center gap-0.5 hover:underline"
            >
              {isEn ? 'Full Stats' : '상세 통계'} <ArrowRight size={11} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 py-2 px-1">
              <span className="text-[10px] font-bold text-slate-400 block">
                {isEn ? 'Resolved' : '치료 완료'}
              </span>
              <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {metrics.archivedConditionsCount}
                <span className="text-[10px] font-normal text-slate-400">
                  /{metrics.totalConditions}
                  {isEn ? '' : '개'}
                </span>
              </strong>
            </div>

            <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 py-2 px-1">
              <span className="text-[10px] font-bold text-slate-400 block">
                {isEn ? 'Improved' : '개선된 질병'}
              </span>
              <strong className="text-sm font-black text-slate-800 dark:text-slate-100">
                {metrics.improvedConditionsCount}
                <span className="text-[10px] font-normal text-slate-400">
                  /{metrics.comparableConditionsCount}
                  {isEn ? '' : '개'}
                </span>
              </strong>
            </div>

            <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 py-2 px-1">
              <span className="text-[10px] font-bold text-slate-400 block">
                {isEn ? 'Pain Delta' : '통증 개선'}
              </span>
              <strong
                className={`text-sm font-black inline-flex items-center justify-center gap-0.5 ${
                  metrics.overallPainDelta !== null && metrics.overallPainDelta < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : metrics.overallPainDelta !== null && metrics.overallPainDelta > 0
                    ? 'text-rose-500'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {metrics.overallPainDelta !== null && metrics.overallPainDelta < 0 ? (
                  <>
                    <TrendingDown size={13} />
                    {metrics.overallImprovementPct !== null
                      ? `${metrics.overallImprovementPct}%`
                      : `${metrics.overallPainDelta}`}
                  </>
                ) : metrics.overallPainDelta !== null && metrics.overallPainDelta > 0 ? (
                  <>
                    <TrendingUp size={13} />+{metrics.overallPainDelta}
                  </>
                ) : isEn ? (
                  'Stable'
                ) : (
                  '유지'
                )}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 4. Overall Pain Heatmap */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase">{t('overallPainHeatmap')}</h3>
        <CalendarHeatmap logs={logs} />
      </div>

      {/* 5. Unassigned (Unknown Cause) Symptoms Grouping Signal Card */}
      {unassignedLogs.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/25 p-3.5 flex items-center justify-between gap-2 shadow-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <p className="text-xs font-extrabold text-amber-950 dark:text-amber-200">
                {isEn
                  ? `${unassignedLogs.length} unassigned logs need grouping`
                  : `질병 미분류 증상 ${unassignedLogs.length}건 · 분류가 필요해요`}
              </p>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-400 truncate mt-0.5">
              {unassignedPreviewParts.length > 0
                ? isEn
                  ? `Group ${unassignedPreviewParts.join(', ')} logs under a condition to track trends`
                  : `${unassignedPreviewParts.join(', ')} 기록을 질병으로 묶어 추이를 추적하세요`
                : isEn
                ? 'Once diagnosed, group logs under a condition to see trends & stats'
                : '진단명이 확인되면 질병으로 묶어 추이와 통계를 확인하세요'}
            </p>
          </div>
          <button
            type="button"
            onClick={openGroupModal}
            className="shrink-0 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold flex items-center gap-1 shadow-sm"
          >
            <FolderPlus size={14} /> {isEn ? 'Group' : '분류하기'}
          </button>
        </div>
      )}

      {/* 5. Tracked Diseases List */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase">
            {isEn ? 'Tracked Conditions' : '추적 중인 질병'}
          </h2>
          <div className="flex gap-1.5">
            {(['All', 'Critical', 'Improved'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setFilter(f);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  filter === f
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {f === 'All' ? t('filterAll') : f === 'Critical' ? t('filterCritical') : t('filterImproved')}
              </button>
            ))}
          </div>
        </div>

        {activeConditions.length === 0 && unassignedLogs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-1.5">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">{t('startFirstRecord')}</h3>
            <p className="text-xs text-slate-400">
              {isEn
                ? 'Use the buttons above to log pain or unassigned symptoms.'
                : '상단 버튼으로 통증이나 원인 미상 증상을 먼저 기록해 보세요.'}
            </p>
          </div>
        )}

        {filteredConditions.map((c) => (
          <DetailedConditionCard key={c.id} condition={c} logs={logs} />
        ))}

        {archivedConditions.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs font-bold text-slate-400 underline"
            >
              {showArchived ? t('hideArchived') : t('showArchived')} ({archivedConditions.length})
            </button>
            {showArchived && (
              <div className="mt-2 space-y-2">
                {archivedConditions.map((c) => (
                  <DetailedConditionCard key={c.id} condition={c} logs={logs} isArchived />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
