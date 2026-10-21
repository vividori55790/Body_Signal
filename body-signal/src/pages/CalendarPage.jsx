import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CalendarPage = ({ logs, conditions, diaryEntries, onSaveDiaryEntry }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const storedDiaryEntry = diaryEntries.find((entry) => (
        selectedDate && entry.date === format(selectedDate, 'yyyy-MM-dd')
    ));
    const [diaryEntry, setDiaryEntry] = useState('');

    React.useEffect(() => {
        setDiaryEntry(storedDiaryEntry?.text || '');
    }, [storedDiaryEntry?.date, storedDiaryEntry?.text]);

    // Calendar Grid Logic
    const days = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const startPad = Array(getDay(startOfMonth(currentMonth))).fill(null);

    // Logs for a specific day
    const getLogsForDate = (date) => {
        return logs.filter(l => isSameDay(new Date(l.date), date)).map(l => {
             const c = conditions.find(cond => cond.id === l.conditionId);
             return { ...l, conditionLabel: c?.label };
        });
    };

    // Max Intensity for color
    const getDayColor = (date) => {
        const dayLogs = getLogsForDate(date);
        if (dayLogs.length === 0) return 'bg-white';
        
        const maxInt = Math.max(...dayLogs.map(l => l.intensity));
        if (maxInt >= 8) return 'bg-rose-100 border-rose-200 text-rose-700 font-bold';
        if (maxInt >= 5) return 'bg-amber-50 border-amber-200 text-amber-700 font-bold';
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold';
    };

    return (
        <div className="min-h-screen bg-bg p-4 pb-24">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Health Calendar</h1>
                <div className="flex gap-2">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 bg-white rounded-lg border border-slate-200"><ChevronLeft size={20}/></button>
                    <span className="font-bold w-32 text-center py-2 bg-white rounded-lg border border-slate-200">
                        {format(currentMonth, 'MMMM yyyy')}
                    </span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 bg-white rounded-lg border border-slate-200"><ChevronRight size={20}/></button>
                </div>
            </header>

            {/* Calendar Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {startPad.map((_, i) => <div key={`pad-${i}`} className="aspect-square bg-slate-50/50" />)}
                    
                    {days.map(day => {
                        const dayLogs = getLogsForDate(day);
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        
                        return (
                            <div 
                                key={day.toString()}
                                onClick={() => setSelectedDate(day)}
                                className={`aspect-square border border-slate-50 p-1 relative cursor-pointer hover:z-10 transition-all ${getDayColor(day)} ${isSelected ? 'ring-2 ring-slate-800 z-10' : ''}`}
                            >
                                <span className="text-xs">{format(day, 'd')}</span>
                                {dayLogs.length > 0 && (
                                    <div className="absolute bottom-1 right-1 flex gap-0.5">
                                        {dayLogs.slice(0,3).map((_, i) => (
                                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selected Date Detail */}
            {selectedDate && (
                <div className="mt-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-lg text-slate-800">{format(selectedDate, 'EEEE, MMMM do')}</h2>
                        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400">
                            Insights coming soon
                        </span>
                    </div>

                    <div className="space-y-4">
                        {/* Diary */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Daily Journal</label>
                            <textarea
                                value={diaryEntry}
                                onChange={(e) => {
                                    const nextValue = e.target.value;
                                    setDiaryEntry(nextValue);
                                    onSaveDiaryEntry(selectedDate, nextValue);
                                }}
                                placeholder="How was your day? Any stress or triggers?"
                                className="w-full text-sm resize-none focus:outline-none text-slate-700 h-20 bg-transparent"
                            />
                            <div className="absolute top-4 right-4 text-xs text-slate-300 group-hover:text-slate-400 transition-colors">
                                Saved locally
                            </div>
                        </div>

                        {/* Logs List */}
                        {getLogsForDate(selectedDate).length === 0 ? (
                            <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm">
                                No symptoms logged for this day.
                            </div>
                        ) : (
                            getLogsForDate(selectedDate).map(log => (
                                <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-10 rounded-full ${log.intensity > 5 ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                                        <div>
                                            <div className="font-bold text-slate-800">{log.conditionLabel}</div>
                                            <div className="text-xs text-slate-500">{log.bodyPart}</div>
                                        </div>
                                    </div>
                                    <div className="text-xl font-bold text-slate-700">{log.intensity}<span className="text-xs text-slate-400 font-normal">/10</span></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

        </div>
    );
};

export default CalendarPage;
