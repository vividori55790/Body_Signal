import React, { useState } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for class merging
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Pre-defined simple tags
const PRESET_TAGS = [
  '#throbbing',
  '#sharp',
  '#stiff',
  '#aching',
  '#burning',
  '#numb',
];

const LogEntrySheet = ({ bodyPart, onClose, onSave }) => {
  const [intensity, setIntensity] = useState(5);
  const [tags, setTags] = useState([]);

  // Format body part ID to Title Case (e.g., 'leg-r-upper' -> 'Right Thigh')
  // This is a simple mapper for MVP
  const getLabel = (id) => {
    const map = {
      'head': 'Head',
      'neck': 'Neck',
      'chest': 'Chest',
      'stomach': 'Stomach',
      'pelvis': 'Pelvis',
      'arm-l': 'Left Arm',
      'arm-r': 'Right Arm',
      'leg-l-upper': 'Left Thigh',
      'leg-r-upper': 'Right Thigh',
      'leg-l-lower': 'Left Shin',
      'leg-r-lower': 'Right Shin',
    };
    return map[id] || id;
  };

  const toggleTag = (tag) => {
    if (tags.includes(tag)) {
        setTags(tags.filter(t => t !== tag));
    } else {
        setTags([...tags, tag]);
    }
  };

  const handleSave = () => {
    onSave({
        intensity,
        tags,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div className="relative w-full max-w-md bg-surface text-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border-t sm:border border-white/10 animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
            <div>
                <h2 className="text-2xl font-bold">{getLabel(bodyPart)}</h2>
                <p className="text-slate-400 text-sm">How does it feel right now?</p>
            </div>
            <button 
                onClick={onClose}
                className="p-2 bg-bg rounded-full text-slate-400 hover:text-white transition-colors"
            >
                <X size={20} />
            </button>
        </div>

        {/* Intensity Slider */}
        <div className="mb-8">
            <div className="flex justify-between items-end mb-4">
                <label className="text-sm font-semibold tracking-wider uppercase text-slate-400">Intensity</label>
                <span className={cn(
                    "text-4xl font-black",
                    intensity <= 3 ? "text-pain-low" :
                    intensity <= 7 ? "text-orange-500" :
                    "text-pain-high"
                )}>
                    {intensity}
                </span>
            </div>
            
            <input 
                type="range" 
                min="1" 
                max="10" 
                step="1"
                value={intensity}
                onChange={(e) => setIntensity(parseInt(e.target.value))}
                className="w-full h-4 bg-slate-700 rounded-full appearance-none cursor-pointer accent-primary"
                style={{
                    background: `linear-gradient(to right, #facc15 0%, #dc2626 100%)`
                }}
            />
            <div className="flex justify-between mt-2 text-xs text-slate-500 font-medium">
                <span>Mild</span>
                <span>Moderate</span>
                <span>Severe</span>
            </div>
        </div>

        {/* Tags */}
        <div className="mb-8">
            <label className="text-sm font-semibold tracking-wider uppercase text-slate-400 block mb-3">Symptom Tags</label>
            <div className="flex flex-wrap gap-2">
                {PRESET_TAGS.map(tag => (
                    <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                            tags.includes(tag) 
                                ? "bg-primary text-bg border-primary shadow-[0_0_10px_rgba(34,211,238,0.4)]" 
                                : "bg-bg text-slate-400 border-white/5 hover:border-white/20"
                        )}
                    >
                        {tag}
                    </button>
                ))}
            </div>
        </div>

        {/* Action Button */}
        <button
            onClick={handleSave}
            className="w-full py-4 rounded-xl font-bold text-lg text-bg transition-all active:scale-95 shadow-lg bg-primary hover:bg-cyan-300"
        >
            Save Record
        </button>

      </div>
    </div>
  );
};

export default LogEntrySheet;
