import React, { useMemo, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ClipboardList, Pill, ChevronDown, ChevronRight, Activity, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const HistoryItem = ({ log, previousLog, condition }) => {
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

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all">
            <div onClick={() => setExpanded(!expanded)} className={`p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 ${expanded ? 'bg-slate-50' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full border ${statusColor}`}><StatusIcon size={16} strokeWidth={3} /></div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800">{condition?.label || 'Unknown'}</h3>
                            {isNewType && <span className="text-[10px] bg-blue-600 text-white px-1.5 rounded font-bold uppercase">New</span>}
                        </div>
                        <div className="text-xs text-slate-500">{condition?.bodyPart} • {format(new Date(log.date), 'h:mm a')}</div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
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

const HistoryPage = ({ logs, conditions }) => {
  return <div className="p-4">Loading History...</div>;
};

export default HistoryPage;
