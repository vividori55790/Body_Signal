import React, { useMemo } from 'react';
import { format, subDays, startOfWeek, addDays, isSameDay } from 'date-fns';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const ProgressHeatmap = ({ logs = [], onDateClick }) => {
    // Logic: Calculate Delta per day
    // We need to map logs to days, but also know the "previous day's" (or previous entry's) value to calculate delta.
    
    // 1. Sort logs by date ascending
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));

    // 2. Map Date -> { intensity, delta, count }
    const dateMap = {};
    let previousIntensity = null;

    sortedLogs.forEach(log => {
        const dateStr = log.date.split('T')[0];
        
        let delta = 0;
        if (previousIntensity !== null) {
            delta = log.intensity - previousIntensity;
        }
        
        dateMap[dateStr] = {
            intensity: log.intensity,
            delta: delta,
            hasData: true
        };

        previousIntensity = log.intensity;
    });

    const getCellColor = (dayData) => {
        if (!dayData || !dayData.hasData) return 'bg-slate-100 border border-slate-200'; // No Data (Grey/White)
        
        const { delta } = dayData;

        // Improved (Intensity went DOWN -> Delta is negative)
        if (delta < 0) {
            // Stronger improvement = Darker Green
            if (delta <= -3) return 'bg-emerald-600 border border-emerald-700';
            return 'bg-improved border border-emerald-600';
        }
        
        // Worsened (Intensity went UP -> Delta is positive)
        if (delta > 0) {
            if (delta >= 3) return 'bg-rose-600 border border-rose-700';
            return 'bg-worsened border border-rose-600';
        }

        // No Change (Delta 0)
        return 'bg-stable border border-slate-400';
    };

    // Render Last 12 Weeks (GitHub Style)
    const calendarGrid = useMemo(() => {
        const today = new Date();
        const startDate = startOfWeek(subDays(today, 84)); // 12 weeks ago
        
        const weeks = [];
        let currentDay = startDate;

        for (let w = 0; w < 13; w++) {
            const days = [];
            for (let d = 0; d < 7; d++) {
                const dateStr = format(currentDay, 'yyyy-MM-dd');
                const data = dateMap[dateStr];
                days.push({
                    date: currentDay,
                    data: data
                });
                currentDay = addDays(currentDay, 1);
            }
            weeks.push(days);
        }
        return weeks;
    }, [logs]);

    return (
        <div className="w-full overflow-x-auto">
            <div className="flex gap-1 min-w-max">
                {calendarGrid.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1">
                        {week.map((day, dIdx) => (
                            <div 
                                key={dIdx}
                                onClick={() => onDateClick && day.data && onDateClick(day)}
                                className={cn(
                                    "w-3 h-3 sm:w-4 sm:h-4 rounded-[2px] transition-all",
                                    getCellColor(day.data),
                                    day.data && "cursor-pointer hover:scale-125 hover:z-10 hover:shadow-sm"
                                )}
                                title={day.data ? `Delta: ${day.data.delta}, Int: ${day.data.intensity}` : format(day.date, 'MMM d')}
                            />
                        ))}
                    </div>
                ))}
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-secondary mt-3 font-medium">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-[2px] bg-improved border border-emerald-600" />
                    <span>Improved</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-[2px] bg-stable border border-slate-400" />
                    <span>Stable</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-[2px] bg-worsened border border-rose-600" />
                    <span>Worsened</span>
                </div>
            </div>
        </div>
    );
};

export default ProgressHeatmap;
