import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, isToday, isYesterday, startOfWeek, endOfWeek } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar as CalendarIcon,
  List as ListIcon,
  FileCheck2,
  Trash2,
  Edit3,
  Save,
  X,
  Pill,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  BarChart3,
  // Stethoscope, // 진료 브리핑은 질병 추적·관리 집중을 위해 일시 비활성화
  ArrowRight,
} from 'lucide-react';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { PainLog, Condition, UNASSIGNED_CONDITION_ID } from '../types/health';
import { triggerHaptic } from '../utils/native';
import { getPqrstLabel } from '../utils/clinicalTaxonomy';
import { toLocalDateTimeInput } from '../utils/dateUtils';
import CalendarPage from './CalendarPage';
import DiagnosticsPage from './DiagnosticsPage';
import StatsPage from './StatsPage';
import { useAuthorizedDelete } from '../components/DeleteAuthModal';
// import ClinicalBriefingPage from './ClinicalBriefing'; // 일시 주석 처리

interface HistoryItemProps {
  log: PainLog;
  previousLog?: PainLog;
  condition?: Condition;
  showFullDate?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onDelete: (id: string) => Promise<boolean> | Promise<void> | void;
  onUpdate: (id: string, updates: Partial<PainLog>) => Promise<boolean>;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  log,
  previousLog,
  condition,
  showFullDate = false,
  selectable = false,
  selected = false,
  onToggleSelect,
  onDelete,
  onUpdate,
}) => {
  const navigate = useNavigate();
  const { resolvedLanguage, t } = useSettings();
  const isEn = resolvedLanguage === 'en';
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

  const handlePrimaryRowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    if (selectable) {
      onToggleSelect?.(log.id);
      return;
    }
    if (condition?.id) {
      navigate(`/condition/${condition.id}`);
    } else {
      setExpanded(!expanded);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    setExpanded(!expanded);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    await onDelete(log.id);
  };

  const beginEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditDate(toLocalDateTimeInput(log.date));
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

  const hasQuality = Boolean(log.painQuality && log.painQuality.length > 0);
  const hasTriggers = Boolean(log.triggers && log.triggers.length > 0);
  const hasRelief = Boolean(log.reliefFactors && log.reliefFactors.length > 0);
  const hasRedFlags = Boolean(log.redFlags && log.redFlags.length > 0);

  return (
    <div
      className={`rounded-2xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all ${
        selectable && selected
          ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className={`flex justify-between items-stretch ${expanded ? 'bg-slate-50 dark:bg-slate-800/40' : ''}`}>
        <div
          onClick={handlePrimaryRowClick}
          className="flex-1 min-w-0 p-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
        >
          {selectable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic();
                onToggleSelect?.(log.id);
              }}
              aria-label={
                selected
                  ? isEn
                    ? 'Deselect'
                    : '선택 해제'
                  : isEn
                  ? 'Select for grouping'
                  : '질병 묶기 선택'
              }
              className={`mt-1 shrink-0 transition-colors ${
                selected ? 'text-teal-600 dark:text-teal-400' : 'text-slate-300 dark:text-slate-600'
              }`}
            >
              {selected ? <CheckSquare size={20} /> : <Square size={20} />}
            </button>
          ) : (
            <div className={`p-2 rounded-full border shrink-0 mt-0.5 ${statusColor}`}>
              <StatusIcon size={16} strokeWidth={2.5} />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {log.conditionId === UNASSIGNED_CONDITION_ID
                  ? isEn
                    ? 'Unassigned Symptom'
                    : '원인 미상 증상'
                  : condition?.label || (isEn ? 'Unspecified' : '미지정')}
              </h3>
              {isNewType && (
                <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                  {t('firstOccurrence')}
                </span>
              )}
              {log.postMedIntensity !== undefined && (
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-extrabold border border-emerald-300 dark:border-emerald-800">
                  {isEn
                    ? `Med Effect: ${log.intensity}→${log.postMedIntensity}`
                    : `복약 효과: ${log.intensity}→${log.postMedIntensity}`}
                </span>
              )}
              {hasRedFlags && (
                <span className="inline-flex items-center gap-0.5 text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold">
                  <AlertCircle size={10} /> {isEn ? 'Red Flag' : '위험징후'}
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400">
              {log.bodyPartOverride || condition?.bodyPart || (isEn ? 'Unspecified' : '미지정')} •{' '}
              {format(
                new Date(log.date),
                isEn
                  ? showFullDate
                    ? 'yyyy-MM-dd h:mm a'
                    : 'h:mm a'
                  : showFullDate
                  ? 'yyyy.M.d a h:mm'
                  : 'a h:mm'
              )}
            </div>

            {/* Inline summary so user clearly identifies what was recorded even before expanding */}
            {(hasQuality || log.medication || hasTriggers || log.notes) && (
              <div className="pt-0.5 space-y-1">
                {(hasQuality || log.medication || hasTriggers) && (
                  <div className="flex flex-wrap items-center gap-1">
                    {log.painQuality?.slice(0, 3).map((q) => (
                      <span
                        key={q}
                        className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                      >
                        {getPqrstLabel('quality', q, resolvedLanguage)}
                      </span>
                    ))}
                    {log.medication && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                        <Pill size={10} /> {log.medication}
                      </span>
                    )}
                    {log.triggers?.slice(0, 2).map((tr) => {
                      const trLabel = getPqrstLabel('triggers', tr, resolvedLanguage);
                      return (
                        <span
                          key={tr}
                          className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                        >
                          {isEn ? `Trigger: ${trLabel}` : `유발: ${trLabel}`}
                        </span>
                      );
                    })}
                  </div>
                )}
                {log.notes && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug">
                    “{log.notes}”
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          onClick={handleToggle}
          className="flex items-center gap-3 p-3.5 pl-2 cursor-pointer border-l border-slate-100 dark:border-slate-800 shrink-0"
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
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    {isEn ? 'Date & Time' : '일시'}
                  </label>
                  <input
                    type="datetime-local"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    {isEn ? `Intensity: ${editIntensity}` : `강도: ${editIntensity}`}
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
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  {isEn ? 'Medication' : '복용 약물'}
                </label>
                <input
                  type="text"
                  value={editMedication}
                  onChange={(e) => setEditMedication(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  {isEn ? 'Notes' : '메모'}
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 resize-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic();
                    navigate('/entry', { state: { editLogId: log.id } });
                  }}
                  className="text-[11px] font-bold text-teal-600 dark:text-teal-400 underline underline-offset-2"
                >
                  {t('editFullRecordHint')}
                </button>
                <div className="flex justify-end gap-2">
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

          {(hasQuality || hasTriggers || hasRelief || log.radiation || hasRedFlags) && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900 p-2.5 space-y-1.5 text-[11px]">
              {hasQuality && (
                <div>
                  <span className="font-bold text-slate-500 mr-1.5">{isEn ? 'Quality:' : '양상:'}</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {log.painQuality?.map((q) => getPqrstLabel('quality', q, resolvedLanguage)).join(', ')}
                  </span>
                </div>
              )}
              {log.radiation && (
                <div>
                  <span className="font-bold text-slate-500 mr-1.5">{isEn ? 'Radiation:' : '방사통:'}</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {getPqrstLabel('radiation', log.radiation, resolvedLanguage)}
                  </span>
                </div>
              )}
              {hasTriggers && (
                <div>
                  <span className="font-bold text-amber-600 dark:text-amber-400 mr-1.5">
                    {isEn ? 'Triggers:' : '악화/유발:'}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {log.triggers?.map((tr) => getPqrstLabel('triggers', tr, resolvedLanguage)).join(', ')}
                  </span>
                </div>
              )}
              {hasRelief && (
                <div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-1.5">
                    {isEn ? 'Relief:' : '완화 요인:'}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {log.reliefFactors?.map((rf) => getPqrstLabel('reliefFactors', rf, resolvedLanguage)).join(', ')}
                  </span>
                </div>
              )}
              {hasRedFlags && (
                <div>
                  <span className="font-bold text-rose-600 dark:text-rose-400 mr-1.5">
                    {isEn ? 'Red Flags:' : '위험 징후:'}
                  </span>
                  <span className="text-rose-700 dark:text-rose-300 font-semibold">
                    {log.redFlags?.map((flag) => getPqrstLabel('redFlags', flag, resolvedLanguage)).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {log.medication && (
            <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900">
              <Pill size={15} className="text-blue-500 shrink-0" />
              <span className="font-bold">{t('treatment')}:</span>
              <span>{log.medication}</span>
            </div>
          )}

          {log.postMedIntensity !== undefined && (
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white text-[10px]">💊</span>
                <span>
                  {isEn
                    ? `Med Effect: NRS ${log.intensity} → ${log.postMedIntensity}`
                    : `복약 효과: NRS ${log.intensity} → ${log.postMedIntensity}`}
                </span>
                <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  ({log.intensity > log.postMedIntensity
                    ? isEn
                      ? `-${log.intensity - log.postMedIntensity} improved`
                      : `${log.intensity - log.postMedIntensity}점 완화`
                    : log.intensity === log.postMedIntensity
                    ? isEn
                      ? 'no change'
                      : '변화 없음'
                    : isEn
                    ? `+${log.postMedIntensity - log.intensity} worse`
                    : `${log.postMedIntensity - log.intensity}점 악화`})
                </span>
              </div>
              {log.postMedEvaluatedAt && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {format(new Date(log.postMedEvaluatedAt), 'HH:mm')} {isEn ? 'evaluated' : '평가'}
                </span>
              )}
            </div>
          )}

          {log.postMedSideEffects && log.postMedSideEffects.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200">
              <span className="font-bold text-[11px] text-amber-800 dark:text-amber-300">
                {isEn ? 'Reported Side Effects:' : '보고된 부작용:'}
              </span>
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
              &ldquo;{log.notes}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const HistoryPage: React.FC<{ initialTab?: 'list' | 'calendar' | 'diagnostics' | 'stats' }> = ({
  initialTab = 'list',
}) => {
  const navigate = useNavigate();
  const { logs, conditions, deleteLog, updateLog, assignLogsToCondition } = useHealth();
  const { resolvedLanguage, t } = useSettings();
  const { requestAuthorizedDelete, authModal: deleteAuthModal } = useAuthorizedDelete();
  const isEn = resolvedLanguage === 'en';
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const paramGroup = searchParams.get('group');
  const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'diagnostics' | 'stats'>(
    paramTab === 'calendar' || paramTab === 'diagnostics' || paramTab === 'stats'
      ? paramTab
      : initialTab
  );
  const [listViewMode, setListViewMode] = useState<'day' | 'week' | 'month' | 'condition'>('day');

  // Disease-grouping selection mode inside History screen
  const [selectionMode, setSelectionMode] = useState(
    paramGroup === 'unassigned' || paramGroup === 'all'
  );
  const [groupFilter, setGroupFilter] = useState<'unassigned' | 'all'>(
    paramGroup === 'unassigned' ? 'unassigned' : 'all'
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    paramGroup === 'unassigned'
      ? logs.filter((l) => l.conditionId === UNASSIGNED_CONDITION_ID).map((l) => l.id)
      : []
  );

  // Target disease picker dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('new');
  const [targetCondId, setTargetCondId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newBodyPart, setNewBodyPart] = useState('');
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const activeConditions = useMemo(() => conditions.filter((c) => !c.isArchived), [conditions]);
  const unassignedLogs = useMemo(
    () => logs.filter((l) => l.conditionId === UNASSIGNED_CONDITION_ID),
    [logs]
  );

  useEffect(() => {
    if (paramGroup === 'unassigned') {
      setActiveTab('list');
      setSelectionMode(true);
      setGroupFilter('unassigned');
      setSelectedIds(logs.filter((l) => l.conditionId === UNASSIGNED_CONDITION_ID).map((l) => l.id));
    } else if (paramGroup === 'all') {
      setActiveTab('list');
      setSelectionMode(true);
      setGroupFilter('all');
    } else if (
      paramTab === 'calendar' ||
      paramTab === 'diagnostics' ||
      paramTab === 'stats' ||
      // paramTab === 'briefing' ||
      paramTab === 'list'
    ) {
      setActiveTab(paramTab);
    } else {
      setActiveTab(initialTab);
    }
  }, [paramTab, paramGroup, initialTab, logs]);

  useEffect(() => {
    if (!assignDialogOpen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [assignDialogOpen]);

  const handleTabSwitch = (tab: 'list' | 'calendar' | 'diagnostics' | 'stats') => {
    triggerHaptic();
    setActiveTab(tab);
    setSelectionMode(false);
    setSearchParams(tab === 'list' ? {} : { tab }, { replace: true });
  };

  const startGroupingMode = (mode: 'unassigned' | 'all') => {
    triggerHaptic();
    setActiveTab('list');
    setSelectionMode(true);
    setGroupFilter(mode);
    if (mode === 'unassigned') {
      setSelectedIds(unassignedLogs.map((l) => l.id));
    } else {
      setSelectedIds([]);
    }
    setSearchParams({ group: mode }, { replace: true });
  };

  const exitGroupingMode = () => {
    triggerHaptic();
    setSelectionMode(false);
    setSelectedIds([]);
    setAssignDialogOpen(false);
    setSearchParams({}, { replace: true });
  };

  const visibleLogs = useMemo(() => {
    const base =
      selectionMode && groupFilter === 'unassigned'
        ? logs.filter((l) => l.conditionId === UNASSIGNED_CONDITION_ID)
        : logs;
    return [...base].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, selectionMode, groupFilter]);

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

  interface GroupedLogSection {
    key: string;
    title: string;
    subtitle?: string;
    conditionId?: string;
    avgIntensity?: string;
    logs: PainLog[];
  }

  const groupedSections = useMemo((): GroupedLogSection[] => {
    if (listViewMode === 'condition') {
      const byCond = new Map<string, PainLog[]>();
      visibleLogs.forEach((log) => {
        const cid = log.conditionId || UNASSIGNED_CONDITION_ID;
        const arr = byCond.get(cid) || [];
        arr.push(log);
        byCond.set(cid, arr);
      });

      return Array.from(byCond.entries()).map(([cid, condLogs]) => {
        const cond = conditions.find((c) => c.id === cid);
        const avg = (condLogs.reduce((acc, l) => acc + l.intensity, 0) / condLogs.length).toFixed(1);
        return {
          key: cid,
          title:
            cid === UNASSIGNED_CONDITION_ID
              ? isEn
                ? 'Unassigned Symptom'
                : '원인 미상 증상'
              : cond?.label || (isEn ? 'Unspecified' : '미지정'),
          subtitle: cond?.bodyPart,
          conditionId: cid !== UNASSIGNED_CONDITION_ID && cond ? cid : undefined,
          avgIntensity: avg,
          logs: condLogs,
        };
      });
    }

    const groups: Record<string, PainLog[]> = {};
    visibleLogs.forEach((log) => {
      const date = new Date(log.date);
      let key = '';

      if (listViewMode === 'day') {
        if (isToday(date)) key = isEn ? 'Today' : '오늘';
        else if (isYesterday(date)) key = isEn ? 'Yesterday' : '어제';
        else key = format(date, isEn ? 'MMM d, yyyy (EEE)' : 'yyyy년 M월 d일 (EEEE)');
      } else if (listViewMode === 'week') {
        const start = startOfWeek(date);
        const end = endOfWeek(date);
        key = isEn
          ? `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
          : `${format(start, 'M월 d일')} ~ ${format(end, 'M월 d일')}`;
      } else {
        key = format(date, isEn ? 'MMMM yyyy' : 'yyyy년 M월');
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });
    return Object.entries(groups).map(([title, items]) => ({
      key: title,
      title,
      logs: items,
    }));
  }, [visibleLogs, listViewMode, conditions, isEn]);

  const toggleSelectLog = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allVisibleSelected =
    visibleLogs.length > 0 && visibleLogs.every((l) => selectedIds.includes(l.id));

  const toggleSelectAllVisible = () => {
    triggerHaptic();
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleLogs.map((l) => l.id));
    }
  };

  const openAssignDialog = () => {
    if (selectedIds.length === 0) return;
    triggerHaptic();
    const chosenLogs = logs.filter((l) => selectedIds.includes(l.id));
    const inferredParts = Array.from(
      new Set(
        chosenLogs.map((l) => {
          if (l.bodyPartOverride) return l.bodyPartOverride;
          const c = conditions.find((cond) => cond.id === l.conditionId);
          return c?.bodyPart;
        }).filter(Boolean)
      )
    ).join(', ');
    setTargetMode(activeConditions.length > 0 ? 'existing' : 'new');
    setTargetCondId(activeConditions[0]?.id || '');
    setNewBodyPart(inferredParts || (isEn ? 'Lower Back' : '허리/요통'));
    setNewLabel('');
    setOverwriteConfirmed(false);
    setAssignError('');
    setAssignDialogOpen(true);
  };

  const overwriteTargets = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return logs.filter((l) => {
      if (!selectedSet.has(l.id)) return false;
      if (l.conditionId === UNASSIGNED_CONDITION_ID) return false;
      if (!conditions.some((c) => c.id === l.conditionId)) return false;
      if (targetMode === 'existing' && targetCondId && l.conditionId === targetCondId) return false;
      return true;
    });
  }, [logs, selectedIds, conditions, targetMode, targetCondId]);

  const overwriteConditionNames = useMemo(() => {
    const names = overwriteTargets
      .map((l) => conditions.find((c) => c.id === l.conditionId)?.label)
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(names));
  }, [overwriteTargets, conditions]);

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setAssignError(isEn ? 'Select at least 1 log to group.' : '묶을 기록을 1개 이상 선택하세요.');
      return;
    }
    if (targetMode === 'new' && (!newLabel.trim() || !newBodyPart.trim())) {
      setAssignError(
        isEn ? 'Enter the condition name and body part.' : '확정된 질병명과 부위를 입력하세요.'
      );
      return;
    }
    if (targetMode === 'existing' && !targetCondId) {
      setAssignError(isEn ? 'Select a target condition.' : '연결할 질병을 선택하세요.');
      return;
    }
    if (overwriteTargets.length > 0 && !overwriteConfirmed) {
      setAssignError(
        isEn
          ? `Please confirm overwriting ${overwriteTargets.length} already-assigned log(s).`
          : `이미 다른 질병에 연결된 기록 ${overwriteTargets.length}건을 덮어쓸지 먼저 체크해 주세요.`
      );
      return;
    }

    const resultId = await assignLogsToCondition(
      selectedIds,
      targetMode === 'existing'
        ? { existingConditionId: targetCondId }
        : { newCondition: { label: newLabel.trim(), bodyPart: newBodyPart.trim() } }
    );
    if (resultId) {
      const count = selectedIds.length;
      triggerHaptic();
      setAssignDialogOpen(false);
      setSelectionMode(false);
      setSelectedIds([]);
      setSearchParams({}, { replace: true });
      setToastMsg(
        isEn ? `Grouped ${count} logs under condition.` : `${count}건의 기록을 질병으로 묶었습니다.`
      );
      window.setTimeout(() => setToastMsg(''), 3000);
    }
  };

  return (
    <div
      className={`min-h-screen bg-slate-50 dark:bg-slate-950 p-4 text-slate-800 dark:text-slate-100 space-y-4 ${
        selectionMode ? 'pb-40' : 'pb-28'
      }`}
    >
      <header className="flex flex-col gap-2.5">
        <h1 className="text-xl font-bold">
          {activeTab === 'list'
            ? selectionMode
              ? isEn
                ? 'Select Logs to Group'
                : '질병으로 묶을 기록 선택'
              : t('historyTitle')
            : activeTab === 'calendar'
            ? t('calendarTitle')
            : activeTab === 'stats'
            ? isEn
              ? 'Usage & Treatment Stats'
              : '사용 · 치료 통계'
            : isEn
            ? 'Claims & Vault'
            : '진단·실손'}
        </h1>

        {!selectionMode && (
          <div className="grid grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 text-xs shadow-sm">
            <button
              type="button"
              onClick={() => handleTabSwitch('list')}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                activeTab === 'list' ? 'bg-teal-700 text-white' : 'text-slate-500'
              }`}
            >
              <ListIcon size={13} /> {isEn ? 'List' : '목록'}
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('calendar')}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                activeTab === 'calendar' ? 'bg-teal-700 text-white' : 'text-slate-500'
              }`}
            >
              <CalendarIcon size={13} /> {isEn ? 'Calendar' : '캘린더'}
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('stats')}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                activeTab === 'stats' ? 'bg-teal-700 text-white' : 'text-slate-500'
              }`}
            >
              <BarChart3 size={13} /> {isEn ? 'Stats' : '통계'}
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('diagnostics')}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                activeTab === 'diagnostics' ? 'bg-teal-700 text-white' : 'text-slate-500'
              }`}
            >
              <FileCheck2 size={13} /> {isEn ? 'Vault' : '진단·실손'}
            </button>
            {/* 진료 브리핑은 질병별 상세 화면의 '의료진 요약'으로 이동하고, 일시 주석 처리함
            <button
              type="button"
              onClick={() => handleTabSwitch('briefing')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                activeTab === 'briefing' ? 'bg-teal-700 text-white' : 'text-slate-500'
              }`}
            >
              <Stethoscope size={13} /> 브리핑
            </button>
            */}
          </div>
        )}
      </header>

      {toastMsg && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3.5 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check size={14} />
          <span>{toastMsg}</span>
        </div>
      )}

      {activeTab === 'calendar' ? (
        <CalendarPage embedded />
      ) : activeTab === 'stats' ? (
        <StatsPage embedded />
      ) : activeTab === 'diagnostics' ? (
        <DiagnosticsPage embedded />
      /* ) : activeTab === 'briefing' ? (
        <ClinicalBriefingPage embedded /> */
      ) : (
        <>
          {/* Selection Mode Guide Banner OR Unassigned Prompt */}
          {selectionMode ? (
            <div className="rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/30 p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold text-teal-900 dark:text-teal-200">
                    {isEn
                      ? 'Review log details and choose entries to group'
                      : '기록 상세를 확인하며 질병으로 묶을 항목을 고르세요'}
                  </p>
                  <p className="text-[11px] text-teal-700 dark:text-teal-400">
                    {isEn
                      ? 'Tap a card to select, or tap › to expand full symptoms & notes'
                      : '카드를 누르면 선택/해제되고, 오른쪽 화살표(›)로 전체 메모와 증상을 펼쳐 볼 수 있습니다'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exitGroupingMode}
                  className="shrink-0 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                >
                  {t('cancel')}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex rounded-lg bg-white/80 dark:bg-slate-900 p-0.5 border border-teal-200/80 dark:border-teal-800/60 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setGroupFilter('unassigned');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      groupFilter === 'unassigned'
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isEn ? `Unassigned (${unassignedLogs.length})` : `원인 미상 (${unassignedLogs.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setGroupFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      groupFilter === 'all'
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isEn ? `All Logs (${logs.length})` : `전체 기록 (${logs.length})`}
                  </button>
                </div>

                {visibleLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                  >
                    {allVisibleSelected
                      ? isEn
                        ? 'Deselect All'
                        : '전체 해제'
                      : isEn
                      ? 'Select All Visible'
                      : '현재 목록 전체 선택'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            unassignedLogs.length > 0 && (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/25 p-3.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    {isEn
                      ? `${unassignedLogs.length} unassigned logs`
                      : `원인 미상 증상 ${unassignedLogs.length}건`}
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    {isEn
                      ? 'Select logs to group them under a diagnosed condition'
                      : '기록 내역을 보며 체크해서 하나의 질병으로 묶을 수 있습니다'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startGroupingMode('unassigned')}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1"
                >
                  <FolderPlus size={14} /> {isEn ? 'Group' : '질병으로 묶기'}
                </button>
              </div>
            )
          )}

          {/* Controls row (hidden in selection mode for cleaner focus) */}
          {!selectionMode && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {logs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => startGroupingMode(unassignedLogs.length > 0 ? 'unassigned' : 'all')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-teal-700 dark:text-teal-400 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <FolderPlus size={14} /> {isEn ? 'Select & Group' : '선택해서 질병 묶기'}
                </button>
              ) : (
                <div />
              )}

              <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 text-xs shadow-sm">
                {(
                  [
                    { id: 'day', label: isEn ? 'Day' : '일별' },
                    { id: 'week', label: isEn ? 'Week' : '주별' },
                    { id: 'month', label: isEn ? 'Month' : '월별' },
                    { id: 'condition', label: isEn ? 'Issue' : '질병별' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setListViewMode(mode.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      listViewMode === mode.id
                        ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                        : 'text-slate-400'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grouped Logs List */}
          <div className="space-y-4">
            {groupedSections.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2 text-xs text-slate-400">
                <p>
                  {selectionMode && groupFilter === 'unassigned'
                    ? isEn
                      ? 'No unassigned symptom logs to group.'
                      : '묶을 원인 미상 증상 기록이 없습니다.'
                    : isEn
                    ? 'No pain logs recorded yet.'
                    : '기록된 통증 내역이 없습니다.'}
                </p>
                {selectionMode && groupFilter === 'unassigned' && logs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGroupFilter('all')}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    {isEn ? 'Choose from All Logs' : '전체 기록에서 고르기'}
                  </button>
                )}
              </div>
            ) : (
              groupedSections.map((section) => (
                <div key={section.key} className="space-y-2">
                  <div className="flex items-center justify-between px-1 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                        {section.title}
                      </span>
                      {section.subtitle && (
                        <span className="text-[10px] font-semibold text-slate-400 truncate">
                          ({section.subtitle})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {section.avgIntensity && (
                        <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full">
                          {isEn ? `Avg ${section.avgIntensity}` : `평균 ${section.avgIntensity}`}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {isEn ? `${section.logs.length}` : `${section.logs.length}건`}
                      </span>
                      {section.conditionId && !selectionMode && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            navigate(`/condition/${section.conditionId}`);
                          }}
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-400 hover:underline"
                        >
                          {isEn ? 'Trend' : '추이'} <ArrowRight size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {section.logs.map((log) => {
                      const cond = conditions.find((c) => c.id === log.conditionId);
                      return (
                        <HistoryItem
                          key={log.id}
                          log={log}
                          previousLog={logHistoryMap[log.id]}
                          condition={cond}
                          showFullDate={listViewMode === 'condition' || listViewMode !== 'day'}
                          selectable={selectionMode}
                          selected={selectedIds.includes(log.id)}
                          onToggleSelect={toggleSelectLog}
                          onDelete={async (logId) => {
                            requestAuthorizedDelete({
                              title: isEn ? 'Delete Health Record' : '건강 기록 삭제',
                              description: isEn
                                ? 'Delete this health record? Once deleted, it cannot be recovered.'
                                : '이 건강 기록을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.',
                              onAuthorized: async () => {
                                await deleteLog(logId);
                              },
                            });
                          }}
                          onUpdate={updateLog}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Floating Bottom Selection Action Bar */}
      {activeTab === 'list' && selectionMode && (
        <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto">
          <div className="rounded-2xl border border-teal-500/30 bg-slate-900/95 dark:bg-slate-900/95 text-white px-4 py-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-emerald-300">
                {isEn ? `${selectedIds.length} selected` : `${selectedIds.length}건 선택됨`}
              </p>
              <p className="text-[10px] text-slate-300">
                {isEn ? 'Group into a shared condition timeline' : '같은 질병 경과로 묶어 추적합니다'}
              </p>
            </div>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={openAssignDialog}
              className="shrink-0 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-400 text-xs font-extrabold flex items-center gap-1.5 transition-colors"
            >
              <FolderPlus size={14} />{' '}
              {isEn ? `Group (${selectedIds.length})` : `질병으로 묶기 (${selectedIds.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Target Disease Assignment Modal */}
      {assignDialogOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setAssignDialogOpen(false)}
            className="fixed inset-0 z-[9998] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <form
              onSubmit={handleConfirmAssign}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">
                  {isEn
                    ? `Group ${selectedIds.length} Selected Logs`
                    : `선택한 ${selectedIds.length}건의 기록을 질병으로 묶기`}
                </h3>
                <button
                  type="button"
                  onClick={() => setAssignDialogOpen(false)}
                  className="text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
                <button
                  type="button"
                  disabled={activeConditions.length === 0}
                  onClick={() => setTargetMode('existing')}
                  className={`py-1.5 rounded-lg ${
                    targetMode === 'existing'
                      ? 'bg-white dark:bg-slate-900 shadow-sm'
                      : 'text-slate-500 disabled:opacity-40'
                  }`}
                >
                  {isEn ? 'Existing Condition' : '기존 질병에 연결'}
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('new')}
                  className={`py-1.5 rounded-lg ${
                    targetMode === 'new' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {isEn ? 'New Condition' : '새 확정 질병 생성'}
                </button>
              </div>

              {targetMode === 'existing' ? (
                <select
                  value={targetCondId}
                  onChange={(e) => setTargetCondId(e.target.value)}
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
                    placeholder={isEn ? 'Condition name (e.g., Lumbar Disc)' : '확정된 질병명 (예: 요추 추간판 탈출증)'}
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  <input
                    type="text"
                    placeholder={isEn ? 'Body part (e.g., Lower Back)' : '부위 (예: 허리/요통)'}
                    value={newBodyPart}
                    onChange={(e) => setNewBodyPart(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              )}

              {assignError && <p className="text-xs font-bold text-rose-500">{assignError}</p>}

              {overwriteTargets.length > 0 && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 p-3 space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200 font-bold">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>
                      {isEn
                        ? `${overwriteTargets.length} selected logs already belong to: ${overwriteConditionNames.join(', ')}.`
                        : `기존 질병(${overwriteConditionNames.join(', ')})에 이미 기록된 ${overwriteTargets.length}건이 포함되어 있습니다.`}
                    </span>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    <input
                      type="checkbox"
                      checked={overwriteConfirmed}
                      onChange={(e) => {
                        triggerHaptic();
                        setOverwriteConfirmed(e.target.checked);
                        setAssignError('');
                      }}
                      className="mt-0.5 h-4 w-4 accent-amber-600 shrink-0"
                    />
                    <span>
                      {isEn
                        ? 'I confirm moving these logs and overwriting their existing condition link.'
                        : '기존 질병 연결을 덮어쓰고 선택한 질병으로 이동하는 데 동의합니다.'}
                    </span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={overwriteTargets.length > 0 && !overwriteConfirmed}
                className="w-full py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs transition-colors"
              >
                {isEn
                  ? `Confirm Grouping (${selectedIds.length})`
                  : `질병으로 묶기 완료 (${selectedIds.length}건)`}
              </button>
            </form>
          </div>,
          document.body
        )}

      {deleteAuthModal}
    </div>
  );
};

export default HistoryPage;
