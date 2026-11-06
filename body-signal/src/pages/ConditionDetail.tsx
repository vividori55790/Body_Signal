import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Edit3, PlusCircle, X, Save, Pill } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';

export const ConditionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { conditions, logs, updateCondition } = useHealth();
  const { t } = useSettings();

  const condition = conditions.find((c) => c.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editBodyPart, setEditBodyPart] = useState('');
  const [editError, setEditError] = useState('');

  const conditionLogs = useMemo(() => {
    return logs
      .filter((l) => l.conditionId === id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, id]);

  const chartData = useMemo(() => {
    return [...conditionLogs].reverse().map((l) => ({
      date: format(new Date(l.date), 'M/d'),
      intensity: l.intensity,
      note: l.notes || '',
    }));
  }, [conditionLogs]);

  if (!condition) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-500">
        <p>해당 질환 정보를 찾을 수 없습니다.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 text-emerald-600 font-bold text-sm"
        >
          홈으로 이동
        </button>
      </div>
    );
  }

  const lastLog = conditionLogs[0];
  const avgIntensity = conditionLogs.length
    ? (conditionLogs.reduce((a, b) => a + b.intensity, 0) / conditionLogs.length).toFixed(1)
    : '0';

  const handleSaveEdit = async () => {
    if (!editLabel.trim() || !editBodyPart.trim()) {
      setEditError('질환명과 부위를 모두 입력해 주세요.');
      return;
    }
    triggerHaptic();
    const success = await updateCondition(condition.id, {
      label: editLabel.trim(),
      bodyPart: editBodyPart.trim(),
    });
    if (success) {
      setIsEditing(false);
      setEditError('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="p-1 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="text-center">
          <h1 className="font-bold text-base">{condition.label}</h1>
          <p className="text-[11px] font-medium text-slate-400 uppercase">{condition.bodyPart}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setEditLabel(condition.label);
            setEditBodyPart(condition.bodyPart);
            setIsEditing(true);
          }}
          className="p-1 text-slate-400 hover:text-emerald-500"
        >
          <Edit3 size={18} />
        </button>
      </header>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">질환 정보 수정</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase">질환/증상명</label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase">발생 부위</label>
                <input
                  type="text"
                  value={editBodyPart}
                  onChange={(e) => setEditBodyPart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-bold"
                />
              </div>
              {editError && <p className="text-rose-500 font-bold">{editError}</p>}
            </div>

            <button
              type="button"
              onClick={handleSaveEdit}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Save size={14} /> 저장 완료
            </button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-5">
        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">현재 통증 강도</span>
            <div
              className={`mt-1 text-3xl font-black ${
                (lastLog?.intensity ?? 0) >= 8
                  ? 'text-rose-500'
                  : (lastLog?.intensity ?? 0) >= 5
                  ? 'text-amber-500'
                  : 'text-emerald-500'
              }`}
            >
              {lastLog ? lastLog.intensity : '-'}
              <span className="text-xs font-normal text-slate-400">/10</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">누적 평균 통증</span>
            <div className="mt-1 text-3xl font-black text-slate-700 dark:text-slate-200">
              {avgIntensity}
            </div>
          </div>
        </div>

        {/* 30-Day Line Chart */}
        {chartData.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Activity size={16} className="text-emerald-500" />
                통증 강도 추이
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold">
                최근 30일
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={20} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      backgroundColor: '#1e293b',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="intensity"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-400">
            표시할 통증 기록이 없습니다.
          </div>
        )}

        {/* Quick Log Action & Logs List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">최근 증상 기록</h3>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                navigate('/entry', { state: { selectedConditionId: condition.id } });
              }}
              className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm active:scale-95"
            >
              <PlusCircle size={14} /> 빠른 기록
            </button>
          </div>

          <div className="space-y-2">
            {conditionLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center justify-between"
              >
                <div className="flex-1 mr-3 space-y-1">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {format(new Date(log.date), 'yyyy-MM-dd a h:mm')}
                  </div>
                  {log.medication && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      <Pill size={12} /> {log.medication}
                    </div>
                  )}
                  {log.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{log.notes}"</p>
                  )}
                </div>

                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl font-black text-lg shrink-0 ${
                    log.intensity >= 8
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                      : log.intensity >= 5
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                  }`}
                >
                  {log.intensity}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConditionDetailPage;
