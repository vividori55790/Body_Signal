import React, { useContext, useMemo } from 'react';
import { format, subDays, startOfWeek, addDays } from 'date-fns';
import { PainLog } from '../types/health';
import { SettingsContext } from '../context/SettingsContext';

interface CalendarHeatmapProps {
  logs?: PainLog[];
  onDateClick?: (dayData: { date: Date; intensity: number; count: number }) => void;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ logs = [], onDateClick }) => {
  const settingsCtx = useContext(SettingsContext);
  const isEn = settingsCtx?.settings.language === 'en';
  const getColor = (intensity: number) => {
    if (!intensity) return 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-800';
    if (intensity <= 3) return 'bg-emerald-300 dark:bg-emerald-600 border border-emerald-400';
    if (intensity <= 6) return 'bg-amber-400 dark:bg-amber-600 border border-amber-500';
    if (intensity <= 8) return 'bg-rose-500 dark:bg-rose-600 border border-rose-600';
    return 'bg-rose-700 dark:bg-rose-800 shadow-[0_0_8px_rgba(225,29,72,0.6)] border border-rose-600';
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
      const dateStr = log.date.split('T')[0];
      if (!dataMap[dateStr]) dataMap[dateStr] = [];
      dataMap[dateStr].push(log.intensity);
    });

    return days.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dailyLogs = dataMap[dateStr] || [];
      const intensity = dailyLogs.length > 0 ? Math.max(...dailyLogs) : 0;
      return {
        date,
        intensity,
        count: dailyLogs.length,
      };
    });
  }, [logs]);

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

              return (
                <div
                  key={dayData.date.toISOString()}
                  onClick={() => onDateClick && onDateClick(dayData)}
                  title={
                    isEn
                      ? `${format(dayData.date, 'yyyy-MM-dd')}: Peak NRS ${dayData.intensity}`
                      : `${format(dayData.date, 'yyyy-MM-dd')}: 최고 통증 NRS ${dayData.intensity}`
                  }
                  className={`w-full aspect-square rounded-[2px] transition-transform hover:scale-110 cursor-pointer ${getColor(
                    dayData.intensity
                  )}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2.5 px-0.5">
        <span>{isEn ? '5 mo ago' : '5개월 전'}</span>
        <div className="flex items-center gap-1.5">
          <span>{isEn ? 'Mild' : '경미함'}</span>
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span>{isEn ? 'Severe' : '극심함'}</span>
        </div>
        <span>{isEn ? 'Today' : '오늘'}</span>
      </div>
    </div>
  );
};

export default CalendarHeatmap;
