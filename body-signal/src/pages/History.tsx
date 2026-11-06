import React, { useMemo, useState } from 'react';
import { format, isToday, isYesterday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addMonths, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar as CalendarIcon,
  List as ListIcon,
  Trash2,
  Edit3,
  Save,
  X,
  Pill,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { PainLog, Condition } from '../types/health';
import { triggerHaptic } from '../utils/native';

interface HistoryItemProps {
  log: PainLog;
  previousLog?: PainLog;
  condition?: Condition;
  onDelete: (id: string) => Promise<boolean>;
  onUpdate: (id: string, updates: Partial<PainLog>) => Promise<boolean>;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ log, previousLog, condition, onDelete, onUpdate }) => {
  const navigate = useNavigate();
  const { t } = useSettings();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editIntensity, setEditIntensity] = useState(log.intensity);
  const [editMedication, setEditMedication] = useState(log.medication || '');
  const [editNotes, setEditNotes] = useState(log.notes || '');

  const isNewType = !previousLog;
  let statusColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  let StatusIcon = Minus;

  if (isNewType) {
    statusColor = 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900';
    StatusIcon = Activity;
  } else {
    const delta = log.intensity - previousLog.intensity;
    if (delta > 0) {
      statusColor = 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900';
      StatusIcon = ArrowUpRight;
    } else if (delta < 0) {
      statusColor = 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
      StatusIcon = ArrowDownRight;
    }
  }

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (condition?.id) {
      navigate(`/condition/${condition.id}`);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    setExpanded(!expanded);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('이 건강 기록을 삭제하시겠습니까?')) {
      triggerHaptic();
      await onDelete(log.id);
    }
  };

  const beginEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditDate(new Date(log.date).toISOString().slice(0, 16));
    setEditIntensity(log.intensity);
    setEditMedication(log.medication || '');
    setEditNotes(log.notes || '');
    setEditing(true);
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    const success = await onUpdate(log.id, {
      date: new Date(editDate).toISOString(),
      intensity: editIntensity,
      medication: editMedication,
      notes: editNotes,
    });
    if (success) {
      setEditing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all">
      <div className={`flex justify-between items-stretch ${expanded ? 'bg-slate-50 dark:bg-slate-800/40' : ''}`}>
        <div
          onClick={handleNavigate}
          className="flex-1 p-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <div className={`p-2 rounded-full border ${statusColor}`}>
            <StatusIcon size={16} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{condition?.label || '미지정'}</h3>
              {isNewType && (
                <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                  {t('firstOccurrence')}
                </span>
              )}
              {log.postMedIntensity !== undefined && (
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-extrabold border border-emerald-300 dark:border-emerald-800">
                  복약 효과: {log.intensity}→{log.postMedIntensity}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {condition?.bodyPart} • {format(new Date(log.date), 'a h:mm')}
            </div>
          </div>
        </div>

        <div
          onClick={handleToggle}
          className="flex items-center gap-3 p-3.5 pl-2 cursor-pointer border-l border-slate-100 dark:border-slate-800"
        >
          <div className="text-right">
            <div
              className={`font-black text-lg ${
                log.intensity >= 8
                  ? 'text-rose-500'
                  : log.intensity >= 5
                  ? 'text-amber-500'
                  : 'text-emerald-500'
              }`}
            >
              {log.intensity}
            </div>
            <div className="text-[9px] text-slate-400 uppercase font-bold">NRS</div>
          </div>
          <div className="text-slate-400">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 space-y-3 animate-in fade-in">
          {editing ? (
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">일시</label>
                  <input
                    type="datetime-local"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    강도: {editIntensity}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={editIntensity}
                    onChange={(e) => setEditIntensity(Number(e.target.value))}
                    className="w-full accent-emerald-500 mt-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">복용 약물</label>
                <input
                  type="text"
                  value={editMedication}
                  onChange={(e) => setEditMedication(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">메모</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 font-bold"
                >
                  <X size={14} className="inline mr-1" />
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                >
                  <Save size={14} className="inline mr-1" />
                  {t('save')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={beginEdit}
                className="flex items-center gap-1 font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                <Edit3 size={13} /> {t('editRecord')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1 font-bold text-rose-500 hover:text-rose-600"
              >
                <Trash2 size={13} /> {t('deleteRecord')}
              </button>
            </div>
          )}

          {log.medication && (
            <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900">
              <Pill size={15} className="text-blue-500 shrink-0" />
              <span className="font-bold">{t('treatment')}:</span>
              <span>{log.medication}</span>
            </div>
          )}

          {/* Medication Response Badge */}
          {log.postMedIntensity !== undefined && (
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white text-[10px]">💊</span>
                <span>복약 효과: NRS {log.intensity} → {log.postMedIntensity}</span>
                <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  ({log.intensity > log.postMedIntensity
                    ? `${log.intensity - log.postMedIntensity}점 완화`
                    : log.intensity === log.postMedIntensity
                    ? '변화 없음'
                    : `${log.postMedIntensity - log.intensity}점 악화`})
                </span>
              </div>
              {log.postMedEvaluatedAt && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {format(new Date(log.postMedEvaluatedAt), 'HH:mm')} 평가
                </span>
              )}
            </div>
          )}

          {/* Reported Side Effects Chips */}
          {log.postMedSideEffects && log.postMedSideEffects.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200">
              <span className="font-bold text-[11px] text-amber-800 dark:text-amber-300">보고된 부작용:</span>
              <div className="flex flex-wrap gap-1">
                {log.postMedSideEffects.map((se) => (
                  <span
                    key={se}
                    className="px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 text-[10px] font-bold"
                  >
                    {se}
                  </span>
                ))}
              </div>
            </div>
          )}

          {log.notes && (
            <div className="text-xs text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed">
              "{log.notes}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const HistoryPage: React.FC = () => {
  const { logs, conditions, deleteLog, updateLog } = useHealth();
  const { t } = useSettings();
  const [listViewMode, setListViewMode] = useState<'day' | 'week' | 'month'>('day');

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs]);

  const logHistoryMap = useMemo(() => {
    const map: Record<string, PainLog> = {};
    conditions.forEach((condition) => {
      const conditionLogs = logs
        .filter((l) => l.conditionId === condition.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      conditionLogs.forEach((log, index) => {
        if (index > 0) {
          map[log.id] = conditionLogs[index - 1];
        }
      });
    });
    return map;
  }, [logs, conditions]);

  const groupedLogs = useMemo(() => {
    const groups: Record<string, PainLog[]> = {};
    sortedLogs.forEach((log) => {
      const date = new Date(log.date);
      let key = '';

      if (listViewMode === 'day') {
        if (isToday(date)) key = '오늘';
        else if (isYesterday(date)) key = '어제';
        else key = format(date, 'yyyy년 M월 d일 (EEEE)');
      } else if (listViewMode === 'week') {
        const start = startOfWeek(date);
        const end = endOfWeek(date);
        key = `${format(start, 'M월 d일')} ~ ${format(end, 'M월 d일')}`;
      } else {
        key = format(date, 'yyyy년 M월');
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });
    return groups;
  }, [sortedLogs, listViewMode]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('historyTitle')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('historySubtitle')}</p>
        </div>

        <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 text-xs shadow-sm">
          {(['day', 'week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                triggerHaptic();
                setListViewMode(mode);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                listViewMode === mode
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                  : 'text-slate-400'
              }`}
            >
              {mode === 'day' ? '일별' : mode === 'week' ? '주별' : '월별'}
            </button>
          ))}
        </div>
      </header>

      {/* Grouped Logs List */}
      <div className="space-y-4">
        {Object.keys(groupedLogs).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-400">
            기록된 통증 내역이 없습니다.
          </div>
        ) : (
          Object.entries(groupedLogs).map(([title, groupLogs]) => (
            <div key={title} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{title}</span>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  {groupLogs.length}건
                </span>
              </div>
              <div className="space-y-2">
                {groupLogs.map((log) => {
                  const cond = conditions.find((c) => c.id === log.conditionId);
                  return (
                    <HistoryItem
                      key={log.id}
                      log={log}
                      previousLog={logHistoryMap[log.id]}
                      condition={cond}
                      onDelete={deleteLog}
                      onUpdate={updateLog}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
