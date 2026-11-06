import React, { useState, useMemo, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  getDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, BookOpen, Clock, Pill } from 'lucide-react';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';

export const CalendarPage: React.FC = () => {
  const { logs, conditions, diaryEntries, saveDiaryEntry } = useHealth();
  const { t } = useSettings();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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

  // Calendar Grid Days
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startPad = Array(getDay(startOfMonth(currentMonth))).fill(null);

  // Get logs for a given date
  const getLogsForDate = (date: Date) => {
    return logs
      .filter((l) => isSameDay(new Date(l.date), date))
      .map((l) => {
        const cond = conditions.find((c) => c.id === l.conditionId);
        return {
          ...l,
          conditionLabel: cond?.label || '미지정',
          bodyPart: l.bodyPartOverride || cond?.bodyPart || '',
        };
      });
  };

  const getDayColor = (date: Date) => {
    const dayLogs = getLogsForDate(date);
    if (dayLogs.length === 0) return 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300';

    const maxInt = Math.max(...dayLogs.map((l) => l.intensity));
    if (maxInt >= 8) return 'bg-rose-100 dark:bg-rose-950/70 border-rose-300 text-rose-700 dark:text-rose-300 font-bold';
    if (maxInt >= 5) return 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 text-amber-700 dark:text-amber-300 font-bold';
    return 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 text-emerald-700 dark:text-emerald-300 font-bold';
  };

  const selectedDateLogs = getLogsForDate(selectedDate);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 pb-28 text-slate-800 dark:text-slate-100 space-y-5">
      {/* Month Navigator Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('calendarTitle')}</h1>
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setCurrentMonth(subMonths(currentMonth, 1));
            }}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-bold text-xs w-28 text-center">
            {format(currentMonth, 'yyyy년 M월')}
          </span>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setCurrentMonth(addMonths(currentMonth, 1));
            }}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, idx) => (
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

            return (
              <div
                key={day.toString()}
                onClick={() => {
                  triggerHaptic();
                  setSelectedDate(day);
                }}
                className={`aspect-square border border-slate-100 dark:border-slate-800/60 p-1 relative cursor-pointer transition-all flex flex-col justify-between ${getDayColor(
                  day
                )} ${isSelected ? 'ring-2 ring-emerald-500 z-10 scale-95 shadow-sm rounded-lg' : ''}`}
              >
                <span className="text-[11px] font-bold">{format(day, 'd')}</span>
                {dayLogs.length > 0 && (
                  <div className="flex gap-0.5 justify-end">
                    {dayLogs.slice(0, 3).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details */}
      <div className="space-y-4 animate-in fade-in">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-700 dark:text-slate-200">
            {format(selectedDate, 'yyyy년 M월 d일 (EEEE)')}
          </h2>
          <span className="text-xs font-bold text-slate-400">
            {selectedDateLogs.length}건의 기록
          </span>
        </div>

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
    </div>
  );
};

export default CalendarPage;
