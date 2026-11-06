import React, { useState } from 'react';
import { Plus, AlertCircle, TrendingDown, ArrowRight, ChevronDown, ChevronUp, CheckCircle, Save, Clock, Pill, Stethoscope, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { Condition, PainLog } from '../types/health';
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
  const { updateCondition, saveEntry } = useHealth();
  const { t } = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);

  // Inline Quick Form State
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [intensity, setIntensity] = useState(5);
  const [medication, setMedication] = useState('');
  const [notes, setNotes] = useState('');

  const conditionLogs = logs
    .filter((l) => l.conditionId === condition.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const lastLog = conditionLogs[conditionLogs.length - 1];

  const avgIntensity = conditionLogs.length
    ? (conditionLogs.reduce((a, b) => a + b.intensity, 0) / conditionLogs.length).toFixed(1)
    : '0';

  const chartData = conditionLogs
    .map((l) => ({
      date: l.date,
      value: l.intensity,
    }))
    .slice(-10);

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    await saveEntry({
      isNewCondition: false,
      conditionData: { id: condition.id },
      logData: {
        date: new Date(date).toISOString(),
        intensity,
        medication,
        notes,
      },
    });

    // Reset
    setDate(new Date().toISOString().slice(0, 16));
    setMedication('');
    setNotes('');
    setIsExpanded(false);
  };

  const handleToggleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    await updateCondition(condition.id, { isArchived: !isArchived });
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all overflow-hidden ${
        isExpanded ? 'ring-2 ring-emerald-500/30 shadow-md' : 'hover:shadow-md'
      }`}
    >
      {/* Card Header */}
      <div
        className="p-4 flex justify-between items-center cursor-pointer select-none"
        onClick={() => {
          triggerHaptic();
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{condition.label}</h3>
            {isArchived && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                완치/보관
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 uppercase font-medium">{condition.bodyPart}</p>
        </div>

        <div className="flex items-center gap-3 text-right">
          {lastLog && (
            <div>
              <div
                className={`text-2xl font-black ${
                  lastLog.intensity >= 8
                    ? 'text-rose-500'
                    : lastLog.intensity >= 5
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                }`}
              >
                {lastLog.intensity}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">최근 NRS</div>
            </div>
          )}
          <div className="text-slate-400">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {/* Mini Trend Line Chart if available */}
      {chartData.length > 1 && !isExpanded && (
        <div className="h-10 px-4 opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <YAxis domain={[0, 10]} hide />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Card Footer Summary */}
      {!isExpanded && (
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <div>
            평균 통증: <span className="font-bold text-slate-700 dark:text-slate-200">{avgIntensity}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/condition/${condition.id}`);
            }}
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
          >
            상세 분석 <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Expanded Quick Form */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 space-y-4 animate-in fade-in">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-bold">
              누적 기록 {conditionLogs.length}건 (평균 NRS {avgIntensity})
            </span>
            <button
              type="button"
              onClick={handleToggleArchive}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <CheckCircle size={14} />
              {isArchived ? t('restoreCondition') : t('archiveCondition')}
            </button>
          </div>

          <form onSubmit={handleSaveLog} className="space-y-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">{condition.label} 빠른 기록</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">일시</label>
                <input
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  통증 강도: <span className="text-emerald-500 font-black text-sm">{intensity}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-full accent-emerald-500 mt-2"
                />
              </div>
            </div>

            <div>
              <input
                type="text"
                placeholder="복용 약물 (예: 타이레놀 500mg)"
                value={medication}
                onChange={(e) => setMedication(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
              />
            </div>

            <div>
              <textarea
                rows={2}
                placeholder="간단한 증상 메모..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Save size={14} /> 기록 저장
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { conditions, logs, updateLog } = useHealth();
  const { openAcute } = useAcutePain();
  const { t } = useSettings();
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Improved'>('All');
  const [showArchived, setShowArchived] = useState(false);
  const [dismissedMedId, setDismissedMedId] = useState<string | null>(null);
  const [medRatingSaved, setMedRatingSaved] = useState<boolean>(false);
  const [selectedSideEffects, setSelectedSideEffects] = useState<string[]>([]);

  const activeConditions = conditions.filter((c) => !c.isArchived);
  const archivedConditions = conditions.filter((c) => c.isArchived);

  // 7-day logs
  const recentLogs = logs.filter((l) => {
    const ageMs = Date.now() - new Date(l.date).getTime();
    return ageMs <= 7 * 24 * 60 * 60 * 1000;
  });

  const weeklyAvg = recentLogs.length
    ? (recentLogs.reduce((a, b) => a + b.intensity, 0) / recentLogs.length).toFixed(1)
    : '0';

  // Medication Follow-up: find most recent log with medication without postMedIntensity (within last 24h)
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

  const elapsedBadge = elapsedMinutes < 60
    ? `복용 ${elapsedMinutes}분 경과`
    : `복용 ${Math.floor(elapsedMinutes / 60)}시간 ${elapsedMinutes % 60}분 경과`;

  const QUICK_SIDE_EFFECTS = ['속쓰림', '어지러움', '구역/메스꺼움', '졸림', '두드러기'];

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
    }, 2500);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-5">
      {/* 🚨 Emergency 1-Sec Acute Pain Mode Trigger Button (Highest Usability) */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic();
          openAcute();
        }}
        className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black shadow-lg shadow-rose-600/30 flex items-center justify-between active:scale-98 transition-all border border-rose-400/40 select-none"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-white shrink-0 animate-pulse">
            <Zap size={24} className="fill-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full">
                1초 긴급 기록
              </span>
              <span className="flex h-2 w-2 rounded-full bg-white animate-ping" />
            </div>
            <h2 className="text-base font-black mt-0.5 tracking-tight">🚨 지금 너무 아파요 (1초 급성 통증 기록)</h2>
            <p className="text-[11px] text-rose-100 font-medium">참기 힘들 때 즉시 누르세요 • 거대 버튼 1-터치 저장</p>
          </div>
        </div>
        <ArrowRight size={20} className="text-white/90 shrink-0" />
      </button>

      {/* Medication Follow-up Card (Evaluate Drug Response) */}
      {recentMedLog && (
        <div className="rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-50 to-indigo-50/60 dark:from-blue-950/40 dark:to-indigo-950/20 p-4 shadow-sm space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
                <Pill size={16} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    약효 확인 및 재평가
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center gap-1 border border-blue-200 dark:border-blue-800/50">
                    <Clock size={11} /> {elapsedBadge}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  방금 드신 약의 효과가 나타났나요?
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedMedId(recentMedLog.id)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              나중에
            </button>
          </div>

          <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-2.5 text-xs text-slate-600 dark:text-slate-300 flex justify-between items-center border border-blue-100 dark:border-blue-900/40">
            <div>
              <span className="font-bold text-blue-700 dark:text-blue-300">
                💊 {recentMedLog.medication}
              </span>
              {recentMedCondition && (
                <span className="text-[11px] text-slate-400 ml-1.5">({recentMedCondition.label})</span>
              )}
            </div>
            <div className="text-right text-[11px]">
              복용 시 통증: <strong className="text-rose-500 font-black">NRS {recentMedLog.intensity}</strong>
            </div>
          </div>

          {medRatingSaved ? (
            <div className="p-3 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 animate-in fade-in">
              <CheckCircle size={16} /> 약효 반응 및 부작용이 저장되었습니다 (의료진 브리핑 자동 연동)
            </div>
          ) : (
            <div className="space-y-3">
              {/* Quick Side Effects Chips */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>약물 부작용 여부 (해당 시 1-탭 선택):</span>
                  {selectedSideEffects.length > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                      {selectedSideEffects.length}개 선택됨
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
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
                        className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-300'
                            : 'bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {se} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4 One-Tap Response Buttons */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  약 복용 후 현재 통증 변화 (1번 터치 시 즉시 저장):
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    {
                      label: '훨씬 편해요',
                      desc: '(-3점)',
                      val: Math.max(0, recentMedLog.intensity - 3),
                      bg: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20',
                    },
                    {
                      label: '덜 아파요',
                      desc: '(-1점)',
                      val: Math.max(0, recentMedLog.intensity - 1),
                      bg: 'bg-teal-600 text-white hover:bg-teal-500 shadow-teal-600/20',
                    },
                    {
                      label: '비슷해요',
                      desc: '(변화없음)',
                      val: recentMedLog.intensity,
                      bg: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700',
                    },
                    {
                      label: '더 아파요',
                      desc: '(악화)',
                      val: Math.min(10, recentMedLog.intensity + 1),
                      bg: 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/20',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => handleSelectMedResponse(opt.val)}
                      className={`min-h-[50px] py-2 px-1.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all shadow-sm active:scale-95 ${opt.bg}`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-[10px] opacity-80 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('dashTitle')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('dashSubtitle')}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{weeklyAvg}</div>
          <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {t('avg7Days')}
          </span>
        </div>
      </header>

      {/* Trust & Clinical Assurances Badge */}
      <TrustBadge />

      {/* 3-Second Instant Pain Logger (High Usability) */}
      <QuickPainLogger />

      {/* Clinical Briefing Shortcut Banner for Medical Staff */}
      <div
        onClick={() => {
          triggerHaptic();
          navigate('/briefing');
        }}
        className="cursor-pointer rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-700 p-3.5 text-white shadow-md active:scale-98 transition-all flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white shrink-0">
            <Stethoscope size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
              진료실 모드
            </span>
            <h3 className="font-bold text-sm mt-0.5">의사·간호사용 30초 진료 요약</h3>
            <p className="text-[11px] text-teal-100">EMR 원클릭 복사 및 PQRST 통증 차트 보기</p>
          </div>
        </div>
        <ArrowRight size={18} className="text-white/80 shrink-0" />
      </div>

      {/* Top Stat Badges */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('activeConditions')}</span>
          <span className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1 block">
            {activeConditions.length}
          </span>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('totalEntries')}</span>
          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
            {logs.length}
          </span>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('outlook')}</span>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-2 block flex items-center gap-1">
            <TrendingDown size={14} className="text-emerald-500" /> 데이터 추적 중
          </span>
        </div>
      </div>

      {/* Overall Heatmap */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase">{t('overallPainHeatmap')}</h3>
        <CalendarHeatmap logs={logs} />
      </div>

      {/* Action: Log New Symptom Button */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic();
          navigate('/entry');
        }}
        className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
      >
        <Plus size={18} />
        {t('createRecordBtn')}
      </button>

      {/* Filters */}
      <div className="flex gap-2">
        {(['All', 'Critical', 'Improved'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              triggerHaptic();
              setFilter(f);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              filter === f
                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
            }`}
          >
            {f === 'All' ? t('filterAll') : f === 'Critical' ? t('filterCritical') : t('filterImproved')}
          </button>
        ))}
      </div>

      {/* Conditions List */}
      <div className="space-y-3">
        {activeConditions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-2">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">{t('startFirstRecord')}</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">{t('startFirstRecordDesc')}</p>
          </div>
        )}

        {filteredConditions.map((c) => (
          <DetailedConditionCard key={c.id} condition={c} logs={logs} />
        ))}
      </div>

      {/* Archived Conditions */}
      {archivedConditions.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="text-xs font-bold text-slate-400 underline"
          >
            {showArchived ? t('hideArchived') : t('showArchived')} ({archivedConditions.length})
          </button>

          {showArchived && (
            <div className="mt-3 space-y-3">
              {archivedConditions.map((c) => (
                <DetailedConditionCard key={c.id} condition={c} logs={logs} isArchived />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
