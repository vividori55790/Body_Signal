import React, { useMemo } from 'react';
import { format, subDays, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const CalendarHeatmap = ({ logs = [], onDateClick }) => {
    // Determine detailed color based on intensity (0-10)
    // 0: empty
    // 1-3: Low
    // 4-6: Moderate
    // 7-8: High
    // 9-10: Extreme
    const getColor = (intensity) => {
        if (!intensity) return 'bg-white/5 border border-white/5';
        if (intensity <= 3) return 'bg-yellow-900/40 border border-yellow-500/20'; // Pain Low
        if (intensity <= 6) return 'bg-orange-600/60 border border-orange-500/30'; 
        if (intensity <= 8) return 'bg-red-600/80 border border-red-500/40';
        return 'bg-neon-red shadow-[0_0_8px_rgba(220,38,38,0.6)] border border-red-400';
    };

    // Prepare calendar data (Last 12 weeks roughly for mobile view, ~84 days)
    // GitHub style usually behaves: Columns = Weeks, Rows = Days (Sun-Sat)
    const calendarData = useMemo(() => {
        const today = new Date();
        // Start 12 weeks ago, aligned to start of week
        const startDate = startOfWeek(subDays(today, 84)); 
        
        const days = [];
        let currentDate = startDate;

        // Generate 12 weeks * 7 days
        for (let i = 0; i < 7 * 13; i++) {
            days.push(currentDate);
            currentDate = addDays(currentDate, 1);
        }

        // Aggregate logs by day to find max/avg intensity per day
        const dataMap = logs.reduce((acc, log) => {
            const dateStr = log.date.split('T')[0]; // Simple ISO split
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(log.intensity);
            return acc;
        }, {});

        return days.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dailyLogs = dataMap[dateStr] || [];
            // Use max intensity for the day to represent severity
            const intensity = dailyLogs.length > 0 ? Math.max(...dailyLogs) : 0;
            return {
                date,
                intensity,
                count: dailyLogs.length
            };
        });
    }, [logs]);

    return (
        <div className="w-full overflow-x-auto pb-2">
            <div className="flex gap-1 min-w-max">
                {/* We render column by column (Weeks) */}
                {/* 13 Columns */}
                {Array.from({ length: 13 }).map((_, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-1">
                        {/* 7 Days per column */}
                        {Array.from({ length: 7 }).map((_, dayIndex) => {
                            const dataIndex = weekIndex * 7 + dayIndex;
                            const dayData = calendarData[dataIndex];
                            
                            // Safety check
                            if (!dayData) return null;

                            return (
                                <div 
                                    key={dayData.date.toISOString()}
                                    onClick={() => onDateClick && onDateClick(dayData)}
                                    title={`${format(dayData.date, 'MMM d')}: Intensity ${dayData.intensity}`}
                                    className={cn(
                                        "w-3 h-3 sm:w-4 sm:h-4 rounded-sm transition-transform hover:scale-125 cursor-pointer",
                                        getColor(dayData.intensity)
                                    )}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2 px-1">
                <span>3 Months ago</span>
                <div className="flex items-center gap-1">
                    <span>Low</span>
                    <div className="w-2 h-2 rounded-sm bg-yellow-900/40" />
                    <div className="w-2 h-2 rounded-sm bg-orange-600/60" />
                    <div className="w-2 h-2 rounded-sm bg-red-600/80" />
                    <span>High</span>
                </div>
                <span>Today</span>
            </div>
        </div>
    );
};

export default CalendarHeatmap;
