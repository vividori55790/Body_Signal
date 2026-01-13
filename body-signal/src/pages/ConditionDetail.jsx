import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Activity, TrendingUp, AlertCircle, Clock, Edit3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

const ConditionDetailPage = ({ conditions, logs }) => {
    const { id } = useParams();
    const navigate = useNavigate();

    const condition = conditions.find(c => c.id === id);
    
    // Sort logs descending for history list, ascending for chart
    const conditionLogs = useMemo(() => {
        return logs.filter(l => l.conditionId === id).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [logs, id]);

    const chartData = useMemo(() => {
        return [...conditionLogs].reverse().map(l => ({
            date: format(new Date(l.date), 'MMM d'),
            fullDate: format(new Date(l.date), 'PPP p'),
            intensity: l.intensity,
            note: l.notes || ''
        }));
    }, [conditionLogs]);

    if (!condition) {
        return (
            <div className="p-8 text-center bg-slate-50 min-h-screen">
                <p className="text-slate-500">Condition not found.</p>
                <button onClick={() => navigate('/')} className="mt-4 text-primary font-bold">Go Home</button>
            </div>
        );
    }

    const lastLog = conditionLogs[0];
    const avgIntensity = conditionLogs.length 
        ? (conditionLogs.reduce((a, b) => a + b.intensity, 0) / conditionLogs.length).toFixed(1)
        : 0;
    
    // Determine trend color
    let trendColor = 'text-slate-500';
    if (conditionLogs.length >= 2) {
        const diff = conditionLogs[0].intensity - conditionLogs[1].intensity;
        if (diff > 0) trendColor = 'text-rose-500'; // Worsened
        else if (diff < 0) trendColor = 'text-emerald-500'; // Improved
    }

    return (
        <div className="min-h-screen bg-bg pb-24">
            {/* Header */}
            <div className="bg-white p-4 sticky top-0 z-10 border-b border-slate-100 shadow-sm flex items-center justify-between">
                <button onClick={() => navigate('/')} className="p-2 -ml-2 hover:bg-slate-50 rounded-full text-slate-600">
                    <ArrowLeft size={24} />
                </button>
                <div className="text-center">
                    <h1 className="font-bold text-slate-800">{condition.label}</h1>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{condition.bodyPart}</p>
                </div>
                <button className="p-2 -mr-2 text-slate-400 hover:text-primary rounded-full">
                    <Edit3 size={20} />
                </button>
            </div>

            <div className="p-4 space-y-6">
                {/* Key Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-6">
                        <div className={`text-3xl font-black mb-1 ${
                            lastLog?.intensity >= 8 ? 'text-rose-500' : 
                            lastLog?.intensity >= 5 ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                            {lastLog ? lastLog.intensity : '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Level</div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-6">
                        <div className={`text-3xl font-black mb-1 ${trendColor}`}>
                            {conditionLogs.length >= 2 
                                ? (conditionLogs[0].intensity - conditionLogs[1].intensity > 0 ? '+' : '') + (conditionLogs[0].intensity - conditionLogs[1].intensity)
                                : '-'
                            }
                        </div>
                         <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            Since Last
                         </div>
                    </div>
                </div>

                {/* Main Inteval Chart */}
                {chartData.length > 0 ? (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Activity size={18} className="text-primary" />
                                Review History
                            </h3>
                            <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">Last 30 Days</span>
                        </div>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fill: '#94a3b8'}} 
                                        dy={10}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis 
                                        domain={[0, 10]} 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fill: '#94a3b8'}} 
                                        width={20}
                                    />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                        itemStyle={{color: '#334155', fontWeight: 'bold'}}
                                        labelStyle={{color: '#94a3b8', fontSize: '12px', marginBottom: '4px'}}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="intensity" 
                                        stroke="#3b82f6" 
                                        strokeWidth={3} 
                                        dot={{fill: 'white', stroke: '#3b82f6', strokeWidth: 2, r: 4}}
                                        activeDot={{r: 6, fill: '#3b82f6'}}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-50 rounded-2xl p-8 text-center border border-dashed border-slate-300">
                        <p className="text-slate-400 text-sm">No data to display yet.</p>
                    </div>
                )}

                {/* Additional Info / Stats */}
                <div className="grid grid-cols-2 gap-3">
                     <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                         <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total Logs</div>
                         <div className="text-lg font-bold text-slate-700">{conditionLogs.length}</div>
                     </div>
                     <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                         <div className="text-xs text-slate-400 font-bold uppercase mb-1">Avg Intensity</div>
                         <div className="text-lg font-bold text-slate-700">{avgIntensity}</div>
                     </div>
                     <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                         <div className="text-xs text-slate-400 font-bold uppercase mb-1">Onset Date</div>
                         <div className="text-lg font-bold text-slate-700">{condition.onsetDate || 'Unknown'}</div>
                     </div>
                     <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                         <div className="text-xs text-slate-400 font-bold uppercase mb-1">Last Log</div>
                         <div className="text-lg font-bold text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">
                            {lastLog ? format(new Date(lastLog.date), 'MMM d') : '-'}
                         </div>
                     </div>
                </div>

                {/* Recent Logs List (Detailed) */}
                <div>
                    <h3 className="font-bold text-slate-700 mb-3 px-1">Recent Logs</h3>
                    <div className="space-y-3">
                        {conditionLogs.slice(0, 5).map(log => (
                            <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                                <div>
                                    <div className="text-sm font-bold text-slate-700">{format(new Date(log.date), 'PPP')}</div>
                                    <div className="text-xs text-slate-400">{format(new Date(log.date), 'p')}</div>
                                    {log.notes && (
                                        <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                                            "{log.notes}"
                                        </div>
                                    )}
                                </div>
                                <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg ${
                                    log.intensity >= 8 ? 'bg-rose-100 text-rose-600' :
                                    log.intensity >= 5 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                    <span className="font-black text-lg">{log.intensity}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConditionDetailPage;
