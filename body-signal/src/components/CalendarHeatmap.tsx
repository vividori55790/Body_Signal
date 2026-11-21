import React, { useContext, useMemo } from 'react';
import { format, subDays, startOfWeek, addDays } from 'date-fns';
import { DiagnosticRecord, PainLog } from '../types/health';
import { SettingsContext } from '../context/SettingsContext';
import { toLocalYmd } from '../utils/dateUtils';

const CLINICAL_SHADER_STYLE: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.56) 0px, rgba(255, 255, 255, 0.56) 1.5px, rgba(15, 23, 42, 0.24) 1.5px, rgba(15, 23, 42, 0.24) 3px)',
};

interface CalendarHeatmapProps {
  logs?: PainLog[];
  diagnosticRecords?: DiagnosticRecord[];
  onDateClick?: (dayData: {
    date: Date;
    intensity: number;
    count: number;
    diagnosticCount: number;
  }) => void;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  logs = [],
  diagnosticRecords = [],
  onDateClick,
}) => {
  const settingsCtx = useContext(SettingsContext);
  const isEn = settingsCtx?.resolvedLanguage === 'en';
  const getColor = (intensity: number, hasDiagnostic: boolean) => {
    const diagRing = hasDiagnostic
      ? 'ring-1 ring-inset ring-teal-700/80 dark:ring-cyan-300/90'
      : '';
    if (!intensity) {
      return hasDiagnostic
        ? `bg-teal-50 dark:bg-teal-950/70 border border-teal-400 dark:border-teal-500 ${diagRing}`
        : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-800';
    }
    if (intensity <= 3) return `bg-emerald-300 dark:bg-emerald-600 border border-emerald-400 ${diagRing}`;
    if (intensity <= 6) return `bg-amber-400 dark:bg-amber-600 border border-amber-500 ${diagRing}`;
    if (intensity <= 8) return `bg-rose-500 dark:bg-rose-600 border border-rose-600 ${diagRing}`;
    return `bg-rose-700 dark:bg-rose-800 shadow-[0_0_8px_rgba(225,29,72,0.6)] border border-rose-600 ${diagRing}`;
  };

  const WEEKS = 20;

  const calendarData = useMemo(() => {
    const today = new Date();
    const startDate = startOfWeek(subDays(today, (WEEKS - 1) * 7));

    const days: Date[] = [];
    let currentDate = startDate;

    for (let i = 0; i < 7 * WEEKS; i++) {
      days.push(currentDate);
      currentDate = addDays(currentDate, 1);
    }

    const dataMap: Record<string, number[]> = {};
    logs.forEach((log) => {
      const dateStr = toLocalYmd(log.date);
      if (!dateStr) return;
      if (!dataMap[dateStr]) dataMap[dateStr] = [];
      dataMap[dateStr].push(log.intensity);
    });

    const diagMap: Record<string, DiagnosticRecord[]> = {};
    diagnosticRecords.forEach((rec) => {
      const dateStr = toLocalYmd(rec.diagnosisDate);
      if (!dateStr) return;
      if (!diagMap[dateStr]) diagMap[dateStr] = [];
      diagMap[dateStr].push(rec);
    });

    return days.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dailyLogs = dataMap[dateStr] || [];
      const dailyDiagnostics = diagMap[dateStr] || [];
      const intensity = dailyLogs.length > 0 ? Math.max(...dailyLogs) : 0;
      return {
        date,
        intensity,
        count: dailyLogs.length,
        diagnosticCount: dailyDiagnostics.length,
        diagnosticTitles: dailyDiagnostics.map((d) =>
          d.hospitalName ? `${d.diagnosisName} (${d.hospitalName})` : d.diagnosisName
        ),
      };
    });
  }, [logs, diagnosticRecords]);

  return (
    <div className="w-full pb-1">
      <div
        className="grid gap-[3px] w-full"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: WEEKS }).map((_, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, dayIndex) => {
              const dataIndex = weekIndex * 7 + dayIndex;
              const dayData = calendarData[dataIndex];
              if (!dayData) return null;

              const hasDiag = dayData.diagnosticCount > 0;
              const dateLabel = format(dayData.date, 'yyyy-MM-dd');
              const baseTitle = isEn
                ? `${dateLabel}: Peak NRS ${dayData.intensity}`
                : `${dateLabel}: 최고 통증 NRS ${dayData.intensity}`;
              const diagTitle = hasDiag
                ? isEn
                  ? ` · Visit/Dx: ${dayData.diagnosticTitles.join(', ')}`
                  : ` · 진료·검사: ${dayData.diagnosticTitles.join(', ')}`
                : '';

              return (
                <div
                  key={dayData.date.toISOString()}
                  onClick={() => onDateClick && onDateClick(dayData)}
                  title={`${baseTitle}${diagTitle}`}
                  data-has-diagnostic={hasDiag ? 'true' : undefined}
                  className={`relative overflow-hidden w-full aspect-square rounded-[2px] transition-transform hover:scale-110 cursor-pointer ${getColor(
                    dayData.intensity,
                    hasDiag
                  )}`}
                >
                  {hasDiag && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 pointer-events-none"
                      style={CLINICAL_SHADER_STYLE}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-between items-center gap-y-1 text-[10px] text-slate-400 mt-2.5 px-0.5">
        <span>{isEn ? '5 mo ago' : '5개월 전'}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span>{isEn ? 'Mild' : '경미함'}</span>
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span>{isEn ? 'Severe' : '극심함'}</span>
          <span className="inline-flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-200 dark:border-slate-700">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-sm bg-teal-100 dark:bg-teal-900 border border-teal-500 dark:border-cyan-400 inline-block relative overflow-hidden"
              style={CLINICAL_SHADER_STYLE}
            />
            <span className="text-teal-700 dark:text-cyan-300 font-semibold">
              {isEn ? 'Clinic / Exam' : '진료·검사일'}
            </span>
          </span>
        </div>
        <span>{isEn ? 'Today' : '오늘'}</span>
      </div>
    </div>
  );
};

export default CalendarHeatmap;
