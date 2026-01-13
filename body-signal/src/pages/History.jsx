import React, { useMemo, useState } from 'react';
import { format, isToday, isYesterday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addMonths, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Pill, ChevronDown, ChevronRight, ChevronLeft, Activity, ArrowUpRight, ArrowDownRight, Minus, Calendar as CalendarIcon, List as ListIcon } from 'lucide-react';

const HistoryItem = ({ log, previousLog, condition }) => {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);
    const isNewType = !previousLog; 
    let statusColor = 'bg-slate-100 text-slate-600';
    let StatusIcon = Minus;

    if (isNewType) {
        statusColor = 'bg-blue-100 text-blue-700 border-blue-200';
        StatusIcon = Activity;
    } else {
        const delta = log.intensity - previousLog.intensity;
        if (delta > 0) {
            statusColor = 'bg-rose-100 text-rose-700 border-rose-200';
            StatusIcon = ArrowUpRight;
        } else if (delta < 0) {
            statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
            StatusIcon = ArrowDownRight;
        }
    }

    const handleNavigate = (e) => {
        e.stopPropagation();
        if (condition?.id) {
            navigate(`/condition/${condition.id}`);
        }
    };

    const handleToggle = (e) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all">
            <div className={`flex justify-between items-stretch ${expanded ? 'bg-slate-50' : ''}`}>
                <div onClick={handleNavigate} className="flex-1 p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                    <div className={`p-2 rounded-full border ${statusColor}`}><StatusIcon size={16} strokeWidth={3} /></div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800">{condition?.label || 'Unknown'}</h3>
                            {isNewType && <span className="text-[10px] bg-blue-600 text-white px-1.5 rounded font-bold uppercase">New</span>}
                        </div>
                        <div className="text-xs text-slate-500">{condition?.bodyPart} • {format(new Date(log.date), 'h:mm a')}</div>
                    </div>
                </div>
                <div onClick={handleToggle} className="flex items-center gap-4 p-4 pl-2 cursor-pointer hover:bg-slate-100 transition-colors border-l border-transparent hover:border-slate-100">
                     <div className="text-right"><div className="font-black text-lg text-slate-700">{log.intensity}</div><div className="text-[10px] text-slate-400 uppercase">Level</div></div>
                     {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
            </div>
            {expanded && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                    <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                        <div><span className="block text-slate-400 font-bold uppercase mb-1">Previous</span><span className="text-slate-700 font-mono text-lg">{previousLog ? previousLog.intensity : '--'}</span></div>
                        <div><span className="block text-slate-400 font-bold uppercase mb-1">Trend</span><span className="text-slate-700 font-medium">{isNewType ? "First Occurrence" : (log.intensity === previousLog.intensity ? "No Change" : (log.intensity > previousLog.intensity ? `Worsened (+${log.intensity - previousLog.intensity})` : `Improved (${log.intensity - previousLog.intensity})`))}</span></div>
                    </div>
                    {(log.medication || log.notes) && (
                        <div className="mt-4 pt-3 border-t border-slate-200 grid gap-2">
                             {log.medication && (<div className="flex items-start gap-2"><Pill size={14} className="text-blue-500 mt-0.5" /><div><span className="font-bold text-slate-700 block text-xs">Treatment:</span><span className="text-slate-600 text-sm">{log.medication}</span></div></div>)}
                            {log.notes && (<div className="bg-white p-3 rounded border border-slate-200 mt-1"><p className="text-slate-500 italic text-sm">"{log.notes}"</p></div>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const HistoryGroup = ({ title, logs, conditions, logHistoryMap }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-slate-50/80 border-b border-slate-100 hover:bg-slate-100 transition-colors"
            >
                <span className="font-bold text-slate-700 text-sm">{title}</span>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">{logs.length}</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>
            {isOpen && (
                <div className="p-3 space-y-3">
                     {logs.map(log => {
                        const condition = conditions.find(c => c.id === log.conditionId);
                        if (!condition) return null;
                        return (
                             <HistoryItem 
                                key={log.id} 
                                log={log} 
                                previousLog={logHistoryMap[log.id]} 
                                condition={condition} 
                            />
                        );
                     })}
                </div>
            )}
        </div>
    );
};

const HistoryCalendarView = ({ logs, conditions, logHistoryMap }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [metric, setMetric] = useState('intensity'); // 'intensity' | 'trend'

    const days = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const startPad = Array(getDay(startOfMonth(currentMonth))).fill(null);

    const getDayData = (date) => {
        const dayLogs = logs.filter(l => isSameDay(new Date(l.date), date));
        if (dayLogs.length === 0) return { color: 'bg-slate-50', text: 'text-slate-400' };

        if (metric === 'intensity') {
            const maxInt = Math.max(...dayLogs.map(l => l.intensity));
            if (maxInt >= 8) return { color: 'bg-rose-500 text-white', text: 'text-white' }; // Severe
            if (maxInt >= 5) return { color: 'bg-amber-400 text-white', text: 'text-white' }; // Moderate
            return { color: 'bg-emerald-400 text-white', text: 'text-white' }; // Mild
        } else {
            // Trend Calculation
            let totalDelta = 0;
            let count = 0;
            
            dayLogs.forEach(log => {
                const prev = logHistoryMap[log.id];
                if (prev) {
                    totalDelta += (log.intensity - prev.intensity);
                    count++;
                }
            });

            if (count === 0) return { color: 'bg-blue-100 text-blue-700', text: 'text-blue-700' }; // New/No Prev

            const avgDelta = totalDelta / count;
            
            if (avgDelta >= 1) return { color: 'bg-rose-500 text-white', text: 'text-white' }; // Worsening
            if (avgDelta <= -1) return { color: 'bg-emerald-500 text-white', text: 'text-white' }; // Improving
            return { color: 'bg-slate-200 text-slate-600', text: 'text-slate-600' }; // Stable
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200">
                    <button 
                        onClick={() => setMetric('intensity')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${metric === 'intensity' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Intensity
                    </button>
                    <button 
                        onClick={() => setMetric('trend')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${metric === 'trend' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Trend
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-slate-200 rounded"><ChevronLeft size={16}/></button>
                    <span className="text-sm font-bold text-slate-700 w-24 text-center">{format(currentMonth, 'MMM yyyy')}</span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-slate-200 rounded"><ChevronRight size={16}/></button>
                </div>
            </div>
            
            <div className="p-4">
                <div className="grid grid-cols-7 mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-slate-300">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {startPad.map((_, i) => <div key={`pad-${i}`} />)}
                    {days.map(day => {
                        const { color, text } = getDayData(day);
                        return (
                            <div key={day.toString()} className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${color} ${text}`}>
                                {format(day, 'd')}
                            </div>
                        );
                    })}
                </div>
                <div className="mt-4 flex flex-wrap gap-4 justify-center">
                    {metric === 'intensity' ? (
                        <>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-400"></div><span className="text-[10px] text-slate-500 font-medium">Mild (1-4)</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-400"></div><span className="text-[10px] text-slate-500 font-medium">Mod (5-7)</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-rose-500"></div><span className="text-[10px] text-slate-500 font-medium">Severe (8+)</span></div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500"></div><span className="text-[10px] text-slate-500 font-medium">Improving</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-200"></div><span className="text-[10px] text-slate-500 font-medium">Stable</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-rose-500"></div><span className="text-[10px] text-slate-500 font-medium">Worsening</span></div>
                             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div><span className="text-[10px] text-slate-500 font-medium">New</span></div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const HistoryPage = ({ logs, conditions }) => {
    const [displayMode, setDisplayMode] = useState('list'); // 'list' | 'calendar'
    const [listViewMode, setListViewMode] = useState('day'); // 'day' | 'week' | 'month'



    const sortedLogs = useMemo(() => {
        return [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [logs]);

    const logHistoryMap = useMemo(() => {
        const map = {};
        conditions.forEach(condition => {
            const conditionLogs = logs
                .filter(l => l.conditionId === condition.id)
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            
            conditionLogs.forEach((log, index) => {
                if (index > 0) {
                    map[log.id] = conditionLogs[index - 1];
                }
            });
        });
        return map;
    }, [logs, conditions]);

    const groupedLogs = useMemo(() => {
        const groups = {};
        sortedLogs.forEach(log => {
            const date = new Date(log.date);
            let key = '';
            
            if (listViewMode === 'day') {
                if (isToday(date)) key = 'Today';
                else if (isYesterday(date)) key = 'Yesterday';
                else key = format(date, 'EEEE, MMMM do');
            } else if (listViewMode === 'week') {
                const start = startOfWeek(date);
                const end = endOfWeek(date);
                key = `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
            } else if (listViewMode === 'month') {
                key = format(date, 'MMMM yyyy');
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(log);
        });
        return groups;
    }, [sortedLogs, listViewMode]);

    return (
        <div className="p-4 space-y-4 pb-24">
             <header className="mb-4">
                <div className="flex justify-between items-end">
                     <div>
                        <h1 className="text-2xl font-bold text-slate-800">History</h1>
                        <p className="text-slate-500 text-sm">Review your past logs and trends</p>
                    </div>
                </div>
                
                {/* Main View Toggle */}
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1.5 rounded-xl mb-4">
                     <button
                        onClick={() => setDisplayMode('list')}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                            displayMode === 'list' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <ListIcon size={18} />
                        List View
                    </button>
                    <button
                        onClick={() => setDisplayMode('calendar')}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                            displayMode === 'calendar' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <CalendarIcon size={18} />
                        Calendar Heatmap
                    </button>
                </div>

                {displayMode === 'list' && (
                    <div className="flex bg-slate-100 p-1 rounded-lg w-max mb-4">
                        {['Day', 'Week', 'Month'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setListViewMode(mode.toLowerCase())}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                    listViewMode === mode.toLowerCase() 
                                    ? 'bg-white text-slate-800 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                )}
            </header>
            
            {displayMode === 'list' ? (
                <div className="space-y-4">
                    {Object.keys(groupedLogs).length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <p>No history records found.</p>
                        </div>
                    )}

                    {Object.entries(groupedLogs).map(([groupTitle, groupLogs]) => (
                        <HistoryGroup 
                            key={groupTitle}
                            title={groupTitle} 
                            logs={groupLogs} 
                            conditions={conditions} 
                            logHistoryMap={logHistoryMap}
                        />
                    ))}
                </div>
            ) : (
                <HistoryCalendarView 
                    logs={logs} 
                    conditions={conditions} 
                    logHistoryMap={logHistoryMap} 
                />
            )}
        </div>
    );
};

export default HistoryPage;
