import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  getDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Clock,
  Pill,
  Stethoscope,
  Building2,
  FileCheck2,
  ArrowRight,
} from 'lucide-react';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';
import { parseLocalDate, toLocalYmd } from '../utils/dateUtils';

import { UNASSIGNED_CONDITION_ID } from '../types/health';
import CalendarHeatmap from '../components/CalendarHeatmap';

export const CalendarPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logs, conditions, diagnosticRecords, diaryEntries, saveDiaryEntry } = useHealth();
  const { settings, t } = useSettings();
  const isEn = settings.language === 'en';

  const initialNavDate = parseLocalDate(
    (location.state as { selectedDate?: string } | null)?.selectedDate
  );

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => initialNavDate || new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialNavDate || new Date());

  useEffect(() => {
    const targetDate = parseLocalDate(
      (location.state as { selectedDate?: string } | null)?.selectedDate
    );
    if (targetDate) {
      setAnchorDate(targetDate);
      setSelectedDate(targetDate);
    }
  }, [location.state]);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Diary entry text state
  const storedEntry = diaryEntries.find((e) => e.date === selectedDateStr);
  const [diaryText, setDiaryText] = useState(storedEntry?.text || '');

  useEffect(() => {
    setDiaryText(storedEntry?.text || '');
  }, [selectedDateStr, storedEntry?.text]);

  const handleDiaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setDiaryText(next);
    saveDiaryEntry(selectedDateStr, next);
  };

  // Calendar Grid Days (Month or Week)
  const { days, startPad, headerLabel } = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(anchorDate);
      const end = endOfWeek(anchorDate);
      return {
        days: eachDayOfInterval({ start, end }),
        startPad: [] as null[],
        headerLabel: isEn
          ? `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
          : `${format(start, 'yyyy.M.d')} – ${format(end, 'M.d')}`,
      };
    }

    const start = startOfMonth(anchorDate);
    const end = endOfMonth(anchorDate);
    return {
      days: eachDayOfInterval({ start, end }),
      startPad: Array(getDay(start)).fill(null),
      headerLabel: format(anchorDate, isEn ? 'MMM yyyy' : 'yyyy년 M월'),
    };
  }, [anchorDate, viewMode, isEn]);

  // Get logs for a given date
  const getLogsForDate = (date: Date) => {
    const targetStr = format(date, 'yyyy-MM-dd');
    return logs
      .filter((l) => toLocalYmd(l.date) === targetStr)
      .map((l) => {
        const cond = conditions.find((c) => c.id === l.conditionId);
        return {
          ...l,
          conditionLabel:
            l.conditionId === UNASSIGNED_CONDITION_ID
              ? isEn
                ? 'Unassigned'
                : '원인 미상'
              : cond?.label || (isEn ? 'Unspecified' : '미지정'),
          bodyPart: l.bodyPartOverride || cond?.bodyPart || '',
        };
      });
  };

  // Get clinic / diagnostic records for a given date
  const getDiagnosticsForDate = (date: Date) => {
    const targetStr = format(date, 'yyyy-MM-dd');
    return diagnosticRecords
      .filter((d) => toLocalYmd(d.diagnosisDate) === targetStr)
      .map((d) => {
        const cond = conditions.find((c) => c.id === d.conditionId);
        return {
          ...d,
          conditionLabel: cond?.label || '',
        };
      });
  };

  const getDayColor = (date: Date) => {
    const dayLogs = getLogsForDate(date);
    const dayDiagnostics = getDiagnosticsForDate(date);
    if (dayLogs.length === 0) {
      return dayDiagnostics.length > 0
        ? 'bg-teal-50/70 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 font-bold'
        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300';
    }

    const maxInt = Math.max(...dayLogs.map((l) => l.intensity));
    if (maxInt >= 8) return 'bg-rose-100 dark:bg-rose-950/70 border-rose-300 text-rose-700 dark:text-rose-300 font-bold';
    if (maxInt >= 5) return 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 text-amber-700 dark:text-amber-300 font-bold';
    return 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 text-emerald-700 dark:text-emerald-300 font-bold';
  };

  const selectedDateLogs = getLogsForDate(selectedDate);
  const selectedDateDiagnostics = getDiagnosticsForDate(selectedDate);

  const handleNavigateRange = (direction: -1 | 1) => {
    triggerHaptic();
    if (viewMode === 'week') {
      setAnchorDate((prev) => (direction < 0 ? subWeeks(prev, 1) : addWeeks(prev, 1)));
    } else {
      setAnchorDate((prev) => (direction < 0 ? subMonths(prev, 1) : addMonths(prev, 1)));
    }
  };

  const handleSwitchViewMode = (mode: 'month' | 'week') => {
    triggerHaptic();
    setViewMode(mode);
    setAnchorDate(selectedDate);
  };

  return (
    <div className={embedded ? 'space-y-4' : 'min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-5'}>
      {/* Calendar Navigator & Month/Week Toggle Header */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        {!embedded && <h1 className="text-xl font-bold">{t('calendarTitle')}</h1>}
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
          <button
            type="button"
            aria-label={isEn ? 'Previous range' : '이전 기간'}
            onClick={() => handleNavigateRange(-1)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-bold text-xs min-w-[112px] px-1 text-center">
            {headerLabel}
          </span>
          <button
            type="button"
            aria-label={isEn ? 'Next range' : '다음 기간'}
            onClick={() => handleNavigateRange(1)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 text-[11px] font-bold shadow-sm">
          <button
            type="button"
            onClick={() => handleSwitchViewMode('month')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              viewMode === 'month'
                ? 'bg-teal-700 text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {isEn ? 'Month' : '월간'}
          </button>
          <button
            type="button"
            onClick={() => handleSwitchViewMode('week')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              viewMode === 'week'
                ? 'bg-teal-700 text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {isEn ? 'Week' : '주간'}
          </button>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          {(isEn ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['일', '월', '화', '수', '목', '금', '토']).map((d, idx) => (
            <div
              key={d}
              className={`py-2 text-center text-[11px] font-bold uppercase ${
                idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-slate-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {startPad.map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square bg-slate-50/40 dark:bg-slate-900/40" />
          ))}

          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const dayLogs = getLogsForDate(day);
            const dayDiagnostics = getDiagnosticsForDate(day);
            const maxIntensity = dayLogs.length > 0 ? Math.max(...dayLogs.map((l) => l.intensity)) : null;

            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  triggerHaptic();
                  setSelectedDate(day);
                }}
                className={`${
                  viewMode === 'week' ? 'min-h-[88px] p-1.5' : 'aspect-square p-1'
                } border border-slate-100 dark:border-slate-800/60 relative cursor-pointer transition-all flex flex-col justify-between ${getDayColor(
                  day
                )} ${isSelected ? 'ring-2 ring-emerald-500 z-10 scale-95 shadow-sm rounded-lg' : ''}`}
              >
                <div className="flex items-start justify-between gap-0.5">
                  <span className="text-[11px] font-bold leading-none">{format(day, 'd')}</span>
                  {dayDiagnostics.length > 0 && (
                    <span
                      title={dayDiagnostics.map((d) => d.diagnosisName).join(', ')}
                      className="inline-flex items-center justify-center rounded-full bg-teal-600 text-white px-1 py-0.5 leading-none"
                    >
                      <Stethoscope size={8} />
                    </span>
                  )}
                </div>

                {viewMode === 'week' ? (
                  <div className="space-y-1 mt-1">
                    {maxIntensity !== null && (
                      <div className="text-[10px] font-black leading-tight">
                        NRS {maxIntensity}
                        <span className="font-semibold opacity-70 ml-0.5">({dayLogs.length})</span>
                      </div>
                    )}
                    {dayDiagnostics.length > 0 && (
                      <div className="rounded px-1 py-0.5 bg-teal-700/90 text-white text-[9px] font-bold truncate leading-tight">
                        {dayDiagnostics[0].diagnosisName}
                      </div>
                    )}
                  </div>
                ) : (
                  dayLogs.length > 0 && (
                    <div className="flex gap-0.5 justify-end">
                      {dayLogs.slice(0, 3).map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details */}
      <div className="space-y-4 animate-in fade-in">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-slate-700 dark:text-slate-200">
            {format(selectedDate, isEn ? 'MMM d, yyyy (EEE)' : 'yyyy년 M월 d일 (EEEE)')}
          </h2>
          <span className="text-xs font-bold text-slate-400">
            {isEn
              ? `${selectedDateLogs.length} logs${selectedDateDiagnostics.length ? ` · ${selectedDateDiagnostics.length} dx` : ''}`
              : `증상 ${selectedDateLogs.length}건${selectedDateDiagnostics.length ? ` · 진단 ${selectedDateDiagnostics.length}건` : ''}`}
          </span>
        </div>

        {/* Linked Clinic / Diagnosis Records on Selected Day */}
        {selectedDateDiagnostics.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-teal-700 dark:text-teal-300">
                <FileCheck2 size={14} />
                {isEn ? 'Diagnoses & Clinic Visits' : '이 날의 진료 · 진단 기록'}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  navigate('/history?tab=diagnostics');
                }}
                className="text-[11px] font-bold text-teal-600 dark:text-teal-400 flex items-center gap-0.5"
              >
                {isEn ? 'Vault' : '진단·실손함'} <ArrowRight size={11} />
              </button>
            </div>
            {selectedDateDiagnostics.map((rec) => (
              <div
                key={rec.id}
                className="rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/30 p-3.5 shadow-sm flex items-center justify-between gap-2"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-teal-950 dark:text-teal-100">
                      {rec.diagnosisName}
                    </span>
                    {rec.conditionId && rec.conditionLabel && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          navigate(`/condition/${rec.conditionId}`);
                        }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700"
                      >
                        {rec.conditionLabel}
                      </button>
                    )}
                  </div>
                  {(rec.hospitalName || rec.department) && (
                    <p className="flex items-center gap-1 text-[11px] text-teal-800/80 dark:text-teal-300/80 font-medium">
                      <Building2 size={11} />
                      <span>
                        {rec.hospitalName}
                        {rec.department ? ` (${rec.department})` : ''}
                      </span>
                    </p>
                  )}
                  {rec.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 italic">&ldquo;{rec.notes}&rdquo;</p>
                  )}
                </div>
                {rec.amountKrw !== undefined && (
                  <span className="shrink-0 text-xs font-extrabold text-teal-800 dark:text-teal-200">
                    {rec.amountKrw.toLocaleString()}
                    {isEn ? ' KRW' : '원'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Daily Journal Card (Debounced) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm relative space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              <BookOpen size={14} className="text-emerald-500" />
              {t('dailyJournal')}
            </span>
            <span className="text-[10px] text-slate-400">{t('journalSavedNotice')}</span>
          </div>
          <textarea
            rows={3}
            value={diaryText}
            onChange={handleDiaryChange}
            placeholder={t('dailyJournalPlaceholder')}
            className="w-full text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {/* Symptoms on selected day */}
        <div className="space-y-2">
          {selectedDateLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-xs text-slate-400">
              {t('noSymptomsForDay')}
            </div>
          ) : (
            selectedDateLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-10 rounded-full ${
                      log.intensity >= 8
                        ? 'bg-rose-500'
                        : log.intensity >= 5
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{log.conditionLabel}</span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {log.bodyPart}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <Clock size={12} />
                      <span>{format(new Date(log.date), 'a h:mm')}</span>
                      {log.medication && (
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
                          <Pill size={11} /> {log.medication}
                        </span>
                      )}
                    </div>
                    {log.notes && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic">
                        "{log.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xl font-black ${
                      log.intensity >= 8
                        ? 'text-rose-500'
                        : log.intensity >= 5
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    }`}
                  >
                    {log.intensity}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-bold">NRS</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Overall Pain Heatmap (Secondary Overview at Bottom) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase">{t('overallPainHeatmap')}</h3>
        <CalendarHeatmap
          logs={logs}
          diagnosticRecords={diagnosticRecords}
          onDateClick={({ date }) => {
            triggerHaptic();
            setAnchorDate(date);
            setSelectedDate(date);
          }}
        />
      </div>
    </div>
  );
};

export default CalendarPage;
