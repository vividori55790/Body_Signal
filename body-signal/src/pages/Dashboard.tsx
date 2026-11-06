import React, { useState } from 'react';
import { Plus, AlertCircle, TrendingDown, ArrowRight, ChevronDown, ChevronUp, CheckCircle, Save, Clock, Pill } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { Condition, PainLog } from '../types/health';
import { triggerHaptic } from '../utils/native';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import CalendarHeatmap from '../components/CalendarHeatmap';

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
  const { conditions, logs } = useHealth();
  const { t } = useSettings();
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Improved'>('All');
  const [showArchived, setShowArchived] = useState(false);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-6">
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
