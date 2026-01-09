import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter, AlertCircle, TrendingDown, ArrowRight } from 'lucide-react';
import ProgressHeatmap from '../components/ProgressHeatmap';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

const DetailedConditionCard = ({ condition, logs, onClick }) => {
    // Analytics
    const conditionLogs = logs.filter(l => l.conditionId === condition.id).sort((a,b) => new Date(a.date) - new Date(b.date));
    const lastLog = conditionLogs[conditionLogs.length - 1];
    
    const avgIntensity = conditionLogs.length 
        ? (conditionLogs.reduce((a, b) => a + b.intensity, 0) / conditionLogs.length).toFixed(1) 
        : 0;

    // Chart Data (Last 10 points)
    const chartData = conditionLogs.map(l => ({
        date: l.date,
        value: l.intensity
    })).slice(-10);

    return (
        <div onClick={onClick} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group">
            {/* Header */}
            <div className="p-4 border-b border-slate-50 flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-primary transition-colors">{condition.label}</h3>
                    <p className="text-slate-500 text-xs uppercase font-medium tracking-wide mt-1">{condition.bodyPart}</p>
                </div>
                {lastLog && (
                    <div className="text-right">
                        <div className={`text-2xl font-black ${lastLog.intensity > 5 ? 'text-worsened' : 'text-improved'}`}>
                            {lastLog.intensity}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase">Current</div>
                    </div>
                )}
            </div>
            
            {/* Viz Section */}
            <div className="p-4 space-y-4">
                {/* 1. Heatmap (Delta) */}
                <div>
                     <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Recovery Progress</div>
                     <ProgressHeatmap logs={conditionLogs} />
                </div>

                {/* 2. Micro Line Chart (Absolute) */}
                {chartData.length > 1 && (
                    <div className="h-16 w-full opacity-60">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <YAxis domain={[0, 10]} hide />
                                <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#64748b" 
                                    strokeWidth={2} 
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
            
            {/* Footer Stats */}
            <div className="px-4 py-3 bg-slate-50 text-xs flex justify-between items-center text-slate-500 font-medium">
                <div>
                    Avg Intensity: <span className="text-slate-700 font-bold">{avgIntensity}</span>
                </div>
                {lastLog?.medication && (
                    <div className="flex items-center gap-1 max-w-[150px] truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        {lastLog.medication}
                    </div>
                )}
            </div>
        </div>
    );
};

const AddLogCard = ({ onClick }) => (
    <div 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-white hover:border-primary/50 cursor-pointer transition-all group min-h-[250px]"
    >
        <div className="p-4 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
            <Plus size={32} className="text-primary" />
        </div>
        <h3 className="font-bold text-slate-700">Log New Symptom</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-[150px] text-center">
            Record a new issue or update current status
        </p>
    </div>
);

const Dashboard = ({ conditions, logs }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All'); // All, Critical, Improved

  // 1. Calculate Global Stats
  const activeConditions = conditions.filter(c => !c.isArchived);
  const recentLogs = logs.filter(l => {
      const d = new Date(l.date);
      const now = new Date();
      return (now - d) < (7 * 24 * 60 * 60 * 1000); // Last 7 days
  });
  
  const weeklyAvg = recentLogs.length 
    ? (recentLogs.reduce((a,b) => a + b.intensity, 0) / recentLogs.length).toFixed(1)
    : 0;

  // 2. Filter Logic
  const filteredConditions = conditions.filter(c => {
      if (filter === 'All') return true;
      const cLogs = logs.filter(l => l.conditionId === c.id);
      if (!cLogs.length) return false;
      
      const last = cLogs[cLogs.length - 1];
      const prev = cLogs[cLogs.length - 2];
      
      if (filter === 'Critical') return last.intensity >= 7;
      if (filter === 'Improved') return prev && (last.intensity < prev.intensity);
      return false;
  });

  return (
    <div className="min-h-screen bg-bg p-4 pb-24 space-y-8">
        
        {/* Header & Stats */}
        <header>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
                    <p className="text-slate-500 text-sm">Your clinical summary</p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-black text-slate-700">{weeklyAvg}</div>
                    <div className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-bold uppercase tracking-wider">7-Day Avg</div>
                </div>
            </div>

            {/* Quick Stats Rail */}
            <div className="grid grid-cols-3 gap-3 mb-2">
                 <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                     <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Active</div>
                     <div className="flex items-center gap-2">
                         <AlertCircle size={16} className="text-slate-600" />
                         <span className="text-xl font-bold text-slate-700">{activeConditions.length}</span>
                     </div>
                 </div>
                 <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                     <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Entries</div>
                     <div className="flex items-center gap-2">
                         <ArrowRight size={16} className="text-primary" />
                         <span className="text-xl font-bold text-slate-700">{recentLogs.length}</span>
                     </div>
                 </div>
                 <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                     <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Outlook</div>
                     <div className="flex items-center gap-2">
                         <TrendingDown size={16} className="text-improved" />
                         <span className="text-xl font-bold text-improved">Good</span>
                     </div>
                 </div>
            </div>
        </header>

        {/* Filters */}
        <section>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['All', 'Critical', 'Improved'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                            filter === f 
                            ? 'bg-primary text-white shadow-md' 
                            : 'bg-white text-slate-500 border border-slate-200'
                        }`}
                    >
                        {f}
                    </button>
                ))}
            </div>
        </section>

        {/* Main Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {/* Fixed Add Card - Always First */}
             <AddLogCard onClick={() => navigate('/entry')} />

             {/* Dynamic Cards */}
             {filteredConditions.map(c => (
                 <DetailedConditionCard 
                    key={c.id} 
                    condition={c} 
                    logs={logs} 
                    onClick={() => navigate('/entry')} 
                 />
             ))}
        </section>

    </div>
  );
};

export default Dashboard;
