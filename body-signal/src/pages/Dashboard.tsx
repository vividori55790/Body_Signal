import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Pill,
  Zap,
  FolderPlus,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { Condition, PainLog, UNASSIGNED_CONDITION_ID } from '../types/health';
import { triggerHaptic } from '../utils/native';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import CalendarHeatmap from '../components/CalendarHeatmap';
import QuickPainLogger from '../components/QuickPainLogger';
import TrustBadge from '../components/TrustBadge';
import { useAcutePain } from '../context/AcutePainContext';

const DetailedConditionCard: React.FC<{
  condition: Condition;
  logs: PainLog[];
  isArchived?: boolean;
}> = ({ condition, logs, isArchived = false }) => {
  const navigate = useNavigate();
  const { updateCondition } = useHealth();
  const { t } = useSettings();
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
      <div
        className="p-3.5 flex justify-between items-center cursor-pointer select-none"
        onClick={() => {
          triggerHaptic();
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{condition.label}</h3>
            {isArchived && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold shrink-0">
                종료
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {condition.bodyPart} · {conditionLogs.length}건 · 평균 {avgIntensity}
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-right shrink-0">
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
        </div>
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
            <span className="text-slate-500 font-semibold">최근 기록</span>
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
                      {new Date(log.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
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
              <Plus size={14} /> 증상 추가
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                navigate(`/condition/${condition.id}`);
              }}
              className="py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1"
            >
              질병 상세 <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { conditions, logs, updateLog, assignLogsToCondition } = useHealth();
  const { openAcute } = useAcutePain();
  const { t } = useSettings();

  const [filter, setFilter] = useState<'All' | 'Critical' | 'Improved'>('All');
  const [showArchived, setShowArchived] = useState(false);
  const [showQuickLogger, setShowQuickLogger] = useState(false);
  const [dismissedMedId, setDismissedMedId] = useState<string | null>(null);
  const [medRatingSaved, setMedRatingSaved] = useState<boolean>(false);
  const [selectedSideEffects, setSelectedSideEffects] = useState<string[]>([]);

  // Unassigned symptoms grouping modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<string[]>([]);
  const [groupTargetMode, setGroupTargetMode] = useState<'existing' | 'new'>('new');
  const [groupTargetCondId, setGroupTargetCondId] = useState('');
  const [groupNewLabel, setGroupNewLabel] = useState('');
  const [groupNewBodyPart, setGroupNewBodyPart] = useState('');
  const [groupError, setGroupError] = useState('');

  useEffect(() => {
    if (!groupModalOpen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [groupModalOpen]);

  const activeConditions = conditions.filter((c) => !c.isArchived);
  const archivedConditions = conditions.filter((c) => c.isArchived);
  const unassignedLogs = logs.filter((l) => l.conditionId === UNASSIGNED_CONDITION_ID);

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
  const elapsedBadge =
    elapsedMinutes < 60
      ? `${elapsedMinutes}분 경과`
      : `${Math.floor(elapsedMinutes / 60)}시간 ${elapsedMinutes % 60}분 경과`;

  const QUICK_SIDE_EFFECTS = ['속쓰림', '어지러움', '구역감', '졸림', '두드러기'];

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
    setSelectedUnassignedIds(unassignedLogs.map((l) => l.id));
    setGroupTargetMode(activeConditions.length > 0 ? 'existing' : 'new');
    setGroupTargetCondId(activeConditions[0]?.id || '');
    const inferredParts = Array.from(
      new Set(unassignedLogs.map((l) => l.bodyPartOverride).filter(Boolean))
    ).join(', ');
    setGroupNewBodyPart(inferredParts || '허리/요통');
    setGroupNewLabel('');
    setGroupError('');
    setGroupModalOpen(true);
  };

  const handleConfirmGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUnassignedIds.length === 0) {
      setGroupError('묶을 증상 기록을 1개 이상 선택하세요.');
      return;
    }
    if (groupTargetMode === 'new' && (!groupNewLabel.trim() || !groupNewBodyPart.trim())) {
      setGroupError('확정된 질병명과 부위를 입력하세요.');
      return;
    }
    if (groupTargetMode === 'existing' && !groupTargetCondId) {
      setGroupError('연결할 질병을 선택하세요.');
      return;
    }

    const resultId = await assignLogsToCondition(
      selectedUnassignedIds,
      groupTargetMode === 'existing'
        ? { existingConditionId: groupTargetCondId }
        : { newCondition: { label: groupNewLabel.trim(), bodyPart: groupNewBodyPart.trim() } }
    );
    if (resultId) {
      triggerHaptic();
      setGroupModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-24 text-slate-800 dark:text-slate-100 space-y-4">
      {/* 1. Compact Header + Trust Pill + Weekly Summary */}
      <header className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('dashTitle')}</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              추적 질병 {activeConditions.length}개 · 누적 {logs.length}건 · 7일 평균{' '}
              <strong className="text-slate-700 dark:text-slate-200">{weeklyAvg}</strong>
            </p>
          </div>
          <TrustBadge compact />
        </div>

        {/* Unified Action Row (Calm Medical Styling) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              openAcute();
            }}
            aria-label="🚨 지금 너무 아파요 (1초 급성 통증 기록)"
            className="py-2.5 px-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
          >
            <Zap size={14} /> 1초 급성 기록
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              navigate('/entry');
            }}
            className="py-2.5 px-3 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
          >
            <Plus size={15} /> 상세 기록
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setShowQuickLogger(!showQuickLogger);
          }}
          className="w-full py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 hover:text-teal-600"
        >
          {showQuickLogger ? '빠른 기록 접기 ▲' : '홈에서 바로 3초 기록 펼치기 ▼'}
        </button>

        {showQuickLogger && <QuickPainLogger onSaved={() => setShowQuickLogger(false)} />}
      </header>

      {/* 2. Medication Follow-up Card (Only when pending within 24h) */}
      {recentMedLog && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill size={16} className="text-blue-600 dark:text-blue-400" />
              <div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block">
                  약효 확인 및 재평가 · {elapsedBadge}
                </span>
                <h3 className="font-bold text-xs">방금 드신 약의 효과가 나타났나요?</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedMedId(recentMedLog.id)}
              className="text-[11px] text-slate-400"
            >
              닫기
            </button>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
            <span>
              {recentMedLog.medication}
              {recentMedCondition ? ` (${recentMedCondition.label})` : ''}
            </span>
            <span>복용 시 NRS {recentMedLog.intensity}</span>
          </div>

          {medRatingSaved ? (
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs text-center">
              약효 반응이 저장되었습니다
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
                  { label: '훨씬 편해요', val: Math.max(0, recentMedLog.intensity - 3), cls: 'bg-emerald-600 text-white' },
                  { label: '덜 아파요', val: Math.max(0, recentMedLog.intensity - 1), cls: 'bg-teal-600 text-white' },
                  { label: '비슷해요', val: recentMedLog.intensity, cls: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200' },
                  { label: '더 아파요', val: Math.min(10, recentMedLog.intensity + 1), cls: 'bg-rose-700 text-white' },
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

      {/* 3. Overall Pain Heatmap */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase">{t('overallPainHeatmap')}</h3>
        <CalendarHeatmap logs={logs} />
      </div>

      {/* 4. Unassigned (Unknown Cause) Symptoms Grouping Card */}
      {unassignedLogs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
              원인 미상 증상 {unassignedLogs.length}건
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              진단명이 확인되면 질병으로 묶어 추적하세요
            </p>
          </div>
          <button
            type="button"
            onClick={openGroupModal}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1"
          >
            <FolderPlus size={14} /> 질병으로 묶기
          </button>
        </div>
      )}

      {/* 5. Tracked Diseases List */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase">추적 중인 질병</h2>
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
            <p className="text-xs text-slate-400">상단 버튼으로 통증이나 원인 미상 증상을 먼저 기록해 보세요.</p>
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

      {/* Unassigned-to-Disease Grouping Modal */}
      {groupModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setGroupModalOpen(false)}
            className="fixed inset-0 z-[9998] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <form
              onSubmit={handleConfirmGroup}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-3.5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">원인 미상 증상을 질병으로 묶기</h3>
                <button type="button" onClick={() => setGroupModalOpen(false)} className="text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl p-2">
                {unassignedLogs.map((l) => {
                  const checked = selectedUnassignedIds.includes(l.id);
                  return (
                    <label key={l.id} className="flex items-center gap-2 text-xs p-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedUnassignedIds((prev) =>
                            checked ? prev.filter((id) => id !== l.id) : [...prev, l.id]
                          )
                        }
                        className="accent-teal-600"
                      />
                      <span className="font-bold">NRS {l.intensity}</span>
                      <span className="text-slate-500 truncate">
                        {l.bodyPartOverride || '미지정'} · {new Date(l.date).toLocaleDateString('ko-KR')}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
                <button
                  type="button"
                  disabled={activeConditions.length === 0}
                  onClick={() => setGroupTargetMode('existing')}
                  className={`py-1.5 rounded-lg ${
                    groupTargetMode === 'existing'
                      ? 'bg-white dark:bg-slate-900 shadow-sm'
                      : 'text-slate-500 disabled:opacity-40'
                  }`}
                >
                  기존 질병에 연결
                </button>
                <button
                  type="button"
                  onClick={() => setGroupTargetMode('new')}
                  className={`py-1.5 rounded-lg ${
                    groupTargetMode === 'new' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  새 확정 질병 생성
                </button>
              </div>

              {groupTargetMode === 'existing' ? (
                <select
                  value={groupTargetCondId}
                  onChange={(e) => setGroupTargetCondId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  {activeConditions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.bodyPart})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="확정된 질병명 (예: 요추 추간판 탈출증)"
                    value={groupNewLabel}
                    onChange={(e) => setGroupNewLabel(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="부위 (예: 허리/요통)"
                    value={groupNewBodyPart}
                    onChange={(e) => setGroupNewBodyPart(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              )}

              {groupError && <p className="text-xs font-bold text-rose-500">{groupError}</p>}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-teal-700 text-white font-bold text-xs"
              >
                선택한 증상 묶기 ({selectedUnassignedIds.length}건)
              </button>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DashboardPage;
