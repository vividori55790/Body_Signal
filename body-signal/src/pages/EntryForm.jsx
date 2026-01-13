import React, { useState } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const EntryForm = ({ activeConditions, onSave }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [selectedConditionId, setSelectedConditionId] = useState(location.state?.selectedConditionId || '');
  
  // New Condition Fields
  const [newLabel, setNewLabel] = useState('');
  const [newBodyPart, setNewBodyPart] = useState('');
  const [newOnsetDate, setNewOnsetDate] = useState(new Date().toISOString().split('T')[0]);

  // Common Log Fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16)); // DateTime local format
  const [intensity, setIntensity] = useState(5);
  const [medication, setMedication] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Construct Payload
    const payload = {
       isNewCondition: mode === 'new',
       conditionData: mode === 'new' ? {
           label: newLabel,
           bodyPart: newBodyPart,
           onsetDate: newOnsetDate
       } : { id: selectedConditionId },
       logData: {
           date: new Date(date).toISOString(),
           intensity: parseInt(intensity),
           medication,
           notes
       }
    };

    onSave(payload);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-bg text-primary pb-20">
      {/* Header */}
      <header className="bg-surface border-b border-border px-4 py-4 sticky top-0 z-20 flex items-center gap-4 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondary hover:text-primary">
            <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg">New Clinical Entry</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 max-w-lg mx-auto space-y-8">
        
        {/* SECTION 1: Condition Context */}
        <section className="bg-surface p-5 rounded-lg border border-border shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">Condition Context</h2>
            
            {/* Toggle Mode */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                   type="button"
                   onClick={() => setMode('existing')}
                   className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'existing' ? 'bg-white shadow text-primary' : 'text-secondary'}`}
                >
                    Follow-up
                </button>
                <button 
                   type="button"
                   onClick={() => setMode('new')}
                   className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'new' ? 'bg-white shadow text-primary' : 'text-secondary'}`}
                >
                    New Diagnosis
                </button>
            </div>

            {mode === 'existing' ? (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Select Condition</label>
                    <select 
                        required 
                        value={selectedConditionId}
                        onChange={(e) => setSelectedConditionId(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-border rounded-md focus:ring-2 focus:ring-slate-400 outline-none"
                    >
                        <option value="" disabled>-- Choose Active Condition --</option>
                        {activeConditions.map(c => (
                            <option key={c.id} value={c.id}>{c.label} ({c.bodyPart})</option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="block text-sm font-medium mb-1">Condition Label</label>
                        <input 
                            required
                            type="text" 
                            placeholder="e.g. Acute Migraine"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            className="w-full p-3 bg-white border border-border rounded-md focus:border-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Body Part</label>
                        <input 
                            required
                            type="text" 
                            placeholder="e.g. Left Temple"
                            value={newBodyPart}
                            onChange={(e) => setNewBodyPart(e.target.value)}
                            className="w-full p-3 bg-white border border-border rounded-md focus:border-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Onset Date</label>
                        <input 
                            required
                            type="date" 
                            value={newOnsetDate}
                            onChange={(e) => setNewOnsetDate(e.target.value)}
                            className="w-full p-3 bg-white border border-border rounded-md focus:border-primary outline-none"
                        />
                    </div>
                </div>
            )}
        </section>

        {/* SECTION 2: Clinical Data */}
        <section className="bg-surface p-5 rounded-lg border border-border shadow-sm space-y-6">
            <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">Clinical Observation</h2>
            
            <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium mb-1">Timestamp</label>
                    <input 
                        required
                        type="datetime-local" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full p-3 bg-white border border-border rounded-md text-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium mb-1">Pain Rating (1-10)</label>
                    <div className="flex items-center gap-3">
                        <input 
                            type="number" 
                            min="1" 
                            max="10" 
                            value={intensity}
                            onChange={(e) => setIntensity(e.target.value)}
                            className="w-20 p-3 text-center font-bold bg-white border border-border rounded-md"
                        />
                        <span className="text-xs text-secondary">
                             1: Mild<br/>10: Extreme
                        </span>
                    </div>
                 </div>
            </div>

            {/* Slider Visual */}
            <input 
                type="range" 
                min="1" 
                max="10" 
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className="w-full accent-slate-600"
            />

            <div>
                <label className="block text-sm font-medium mb-1">Medication / Treatment</label>
                <input 
                    type="text" 
                    placeholder="e.g. 200mg Ibuprofen, Physical Therapy"
                    value={medication}
                    onChange={(e) => setMedication(e.target.value)}
                    className="w-full p-3 bg-white border border-border rounded-md focus:border-primary outline-none"
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium mb-1">Detailed Notes</label>
                <textarea 
                    rows={3}
                    placeholder="Describe symptoms, triggers, or doctor's advice..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-3 bg-white border border-border rounded-md focus:border-primary outline-none resize-none"
                />
            </div>
        </section>
        
        <button 
            type="submit"
            className="w-full py-4 bg-primary text-white font-bold rounded-lg shadow-md active:scale-[0.98] transition-all"
        >
            Save Record
        </button>

      </form>
    </div>
  );
};

export default EntryForm;
