import React, { useState, useMemo, useEffect } from 'react';
import { Plus, AlertCircle, TrendingDown, ArrowRight, ChevronDown, ChevronUp, CheckCircle, Save, Calendar } from 'lucide-react';
import ProgressHeatmap from '../components/ProgressHeatmap';
import CalendarHeatmap from '../components/CalendarHeatmap';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { getLinkedGoogleAccount } from '../utils/googleSync';


const DetailedConditionCard = ({ condition, logs, onUpdateCondition, onSave }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Inline Form State
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
    const [newIntensity, setNewIntensity] = useState(5);
    const [medication, setMedication] = useState('');
    const [notes, setNotes] = useState('');
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [editedLabel, setEditedLabel] = useState(condition.label);
    const [syncToGoogle, setSyncToGoogle] = useState(false);
    const [googleAccount, setGoogleAccount] = useState(null);

    useEffect(() => {
        const account = getLinkedGoogleAccount();
        setGoogleAccount(account);
        setSyncToGoogle(!!account);
    }, []);

    const conditionLogs = logs.filter(l => l.conditionId === condition.id).sort((a,b) => new Date(a.date) - new Date(b.date));
    const lastLog = conditionLogs[conditionLogs.length - 1];
    
    const avgIntensity = conditionLogs.length 
        ? (conditionLogs.reduce((a, b) => a + b.intensity, 0) / conditionLogs.length).toFixed(1) 
        : 0;

    const chartData = conditionLogs.map(l => ({
        date: l.date,
        value: l.intensity
    })).slice(-10);

    const handleSaveLog = (e) => {
        e.preventDefault();
        onSave({
            isNewCondition: false,
            conditionData: { id: condition.id },
            logData: {
                date: new Date(date).toISOString(),
                intensity: parseInt(newIntensity),
                medication,
                notes
            },
            syncToGoogle // pass this flag up
        });
        // Reset local form state
        setDate(new Date().toISOString().slice(0, 16));
        setNewIntensity(5);
        setMedication('');
        setNotes('');
        setIsExpanded(false); // Optionally collapse after save
    };

    const handleLabelChange = (e) => {
        setEditLabel(e.target.value);
    };

    const handleLabelBlur = () => {
        if(editLabel !== condition.label && editLabel.trim() !== '') {
            onUpdateCondition(condition.id, { label: editLabel });
        }
    };

    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all overflow-hidden ${isExpanded ? 'col-span-full shadow-md border-primary/30' : 'hover:shadow-md'}`}>
            {/* Header */}
            <div 
                className="p-4 border-b border-slate-50 flex justify-between items-start cursor-pointer group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex-1">
                    {isExpanded ? (
                        <input 
                            value={editLabel}
                            onChange={handleLabelChange}
                            onBlur={handleLabelBlur}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-slate-800 text-lg w-full bg-slate-50 px-2 py-1 rounded border border-slate-200 focus:outline-none focus:border-primary"
                        />
                    ) : (
                        <h3 className="font-bold text-slate-800 text-lg group-hover:text-primary transition-colors">{condition.label}</h3>
                    )}
                    <p className="text-slate-500 text-xs uppercase font-medium tracking-wide mt-1">{condition.bodyPart}</p>
                </div>
                <div className="flex items-center gap-4 text-right ml-4">
                    {lastLog && !isExpanded && (
                        <div>
                            <div className={`text-2xl font-black ${lastLog.intensity > 5 ? 'text-worsened' : 'text-improved'}`}>
                                {lastLog.intensity}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase">Current</div>
                        </div>
                    )}
                     <div className="text-slate-400 group-hover:text-primary transition-colors ml-2">
                        {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>
                </div>
            </div>
            
            {/* Viz Section Always Visible but maybe taller if expanded */}
            <div className="p-4 space-y-4">
                <div>
                     <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Recovery Progress</div>
                     <ProgressHeatmap logs={conditionLogs} />
                </div>

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
            
            {!isExpanded && (
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
            )}

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-6 animate-in fade-in">
                    
                    {/* Actions */}
                    <div className="flex justify-between items-center">
                         <div className="text-xs text-slate-500 font-bold">
                            Avg: {avgIntensity}
                         </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateCondition(condition.id, { isArchived: true }); }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold hover:bg-green-200 transition-colors"
                        >
                            <CheckCircle size={16} /> Mark as Cured
                        </button>
                    </div>

                    {/* Inline Form */}
                    <form onSubmit={handleSaveLog} className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-2">Log New Entry for {condition.label}</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                                <input 
                                    required
                                    type="datetime-local" 
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Intensity: <span className="text-primary text-lg">{newIntensity}</span></label>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    value={newIntensity}
                                    onChange={(e) => setNewIntensity(e.target.value)}
                                    className="w-full accent-primary mt-2"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Medication</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Ibuprofen"
                                value={medication}
                                onChange={(e) => setMedication(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes</label>
                            <textarea 
                                rows={2}
                                placeholder="Description..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-primary resize-none"
                            />
                        </div>

                            {googleAccount && (
                                <div className="flex items-center gap-2 mt-4 px-1 py-2 bg-blue-50/50 rounded border border-blue-100/50">
                                    <input 
                                       type="checkbox" 
                                       id={`sync-${condition.id}`}
                                       className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                                       checked={syncToGoogle}
                                       onChange={(e) => setSyncToGoogle(e.target.checked)}
                                    />
                                    <label htmlFor={`sync-${condition.id}`} className="text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer">
                                        <Calendar size={12} className="text-blue-500" />
                                        Save to Google Calendar <span className="text-slate-400 font-normal">({googleAccount.email})</span>
                                    </label>
                                </div>
                            )}

                        <button 
                            type="submit"
                            className="w-full py-2 bg-primary text-white font-bold rounded shadow-sm hover:shadow-md transition-all flex justify-center items-center gap-2"
                        >
                            <Save size={16} /> Save New Entry
                        </button>
                    </form>

                </div>
            )}
        </div>
    );
};

const AddLogCard = ({ onClick }) => (
    <div 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-white hover:border-primary/50 cursor-pointer transition-all group min-h-[200px]"
    >
        <div className="p-4 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
            <Plus size={32} className="text-primary" />
        </div>
        <h3 className="font-bold text-slate-700">Log New Symptom</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-[150px] text-center">
            Record a new issue
        </p>
    </div>
);

const Dashboard = ({ conditions, logs, onUpdateCondition, onSave }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');

  const activeConditions = conditions.filter(c => !c.isArchived);
  const recentLogs = logs.filter(l => {
      const d = new Date(l.date);
      const now = new Date();
      return (now - d) < (7 * 24 * 60 * 60 * 1000);
  });
  
  const weeklyAvg = recentLogs.length 
    ? (recentLogs.reduce((a,b) => a + b.intensity, 0) / recentLogs.length).toFixed(1)
    : 0;

  const filteredConditions = activeConditions.filter(c => {
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

            <div className="grid grid-cols-3 gap-3 mb-6">
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

            {/* Overall General Heatmap at Top levels */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Overall Pain Heatmap</h3>
                <CalendarHeatmap logs={logs} />
            </div>
        </header>

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

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <AddLogCard onClick={() => navigate('/entry')} />

             {filteredConditions.map(c => (
                 <DetailedConditionCard 
                    key={c.id} 
                    condition={c} 
                    logs={logs} 
                    onUpdateCondition={onUpdateCondition}
                    onSave={onSave}
                 />
             ))}
        </section>

    </div>
  );
};

export default Dashboard;
