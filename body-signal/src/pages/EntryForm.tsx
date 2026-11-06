import React, { useState } from 'react';
import { ArrowLeft, Clock, Save, Sparkles, Plus, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import BodyMap from '../components/BodyMap';
import { triggerHaptic } from '../utils/native';

export const EntryFormPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { conditions, saveEntry } = useHealth();
  const { settings, t } = useSettings();

  const activeConditions = conditions.filter((c) => !c.isArchived);

  // Mode: existing vs new
  const [mode, setMode] = useState<'existing' | 'new'>(
    activeConditions.length === 0 ? 'new' : 'existing'
  );
  const [selectedConditionId, setSelectedConditionId] = useState<string>(
    location.state?.selectedConditionId || activeConditions[0]?.id || ''
  );

  // New Condition Fields
  const [newLabel, setNewLabel] = useState('');
  const [newBodyPart, setNewBodyPart] = useState('');
  const [newOnsetDate, setNewOnsetDate] = useState(new Date().toISOString().split('T')[0]);
  const [showBodyMap, setShowBodyMap] = useState(false);

  // Clinical Observation Fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [intensity, setIntensity] = useState<number>(5);
  const [medication, setMedication] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Quick Date Helpers
  const setQuickTime = (type: 'now' | '1h' | 'yesterday') => {
    triggerHaptic();
    const d = new Date();
    if (type === '1h') {
      d.setHours(d.getHours() - 1);
    } else if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    setDate(d.toISOString().slice(0, 16));
  };

  const handleIntensityClick = (num: number) => {
    triggerHaptic();
    setIntensity(num);
  };

  const handleAddMedPreset = (name: string) => {
    triggerHaptic();
    setMedication((prev) => (prev ? `${prev}, ${name}` : name));
  };

  const handleAddSymptomPreset = (phrase: string) => {
    triggerHaptic();
    setNotes((prev) => (prev ? `${prev} ${phrase}` : phrase));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'new') {
      if (!newLabel.trim() || !newBodyPart.trim()) {
        setError('질환/증상 이름과 신체 부위를 모두 입력해 주세요.');
        return;
      }
    } else if (!selectedConditionId) {
      setError('추적할 질환을 선택해 주세요.');
      return;
    }

    const payload = {
      isNewCondition: mode === 'new',
      conditionData:
        mode === 'new'
          ? {
              label: newLabel,
              bodyPart: newBodyPart,
              onsetDate: newOnsetDate,
            }
          : { id: selectedConditionId },
      logData: {
        date: new Date(date).toISOString(),
        intensity,
        medication,
        notes,
      },
    };

    const success = await saveEntry(payload);
    if (success) {
      triggerHaptic();
      navigate('/');
    } else {
      setError('기록 저장에 실패했습니다. 입력값을 확인해 주세요.');
    }
  };

  const getIntensityColor = (num: number) => {
    if (num >= 8) return 'bg-rose-500 text-white border-rose-600 shadow-rose-200';
    if (num >= 5) return 'bg-amber-500 text-white border-amber-600 shadow-amber-200';
    return 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200';
  };

  const getIntensityDescription = (num: number) => {
    if (num <= 3) return '가벼운 불편감 (Mild)';
    if (num <= 6) return '일상생활에 지장 있는 통증 (Moderate)';
    if (num <= 8) return '매우 심한 통증 (Severe)';
    return '극심하여 참을 수 없음 (Worst Possible)';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold">{t('entryTitle')}</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs font-bold text-rose-600 dark:text-rose-400">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Section 1: Condition Mode & Selector */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('conditionContext')}
            </h2>
          </div>

          {/* Toggle Mode */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              disabled={activeConditions.length === 0}
              onClick={() => {
                triggerHaptic();
                setMode('existing');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'existing'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 disabled:opacity-40'
              }`}
            >
              {t('followUpMode')} ({activeConditions.length})
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setMode('new');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'new'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {t('newConditionMode')}
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {t('selectCondition')}
              </label>
              <select
                required
                value={selectedConditionId}
                onChange={(e) => setSelectedConditionId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 p-3 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {activeConditions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.bodyPart})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {t('conditionLabel')}
                </label>
                <input
                  required
                  type="text"
                  placeholder={t('conditionLabelPlaceholder')}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t('bodyPart')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBodyMap(!showBodyMap)}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 underline"
                  >
                    {showBodyMap ? '바디맵 닫기' : '인체 바디맵 열기'}
                  </button>
                </div>
                <input
                  required
                  type="text"
                  placeholder={t('bodyPartPlaceholder')}
                  value={newBodyPart}
                  onChange={(e) => setNewBodyPart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {showBodyMap && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 animate-in fade-in">
                  <BodyMap
                    selectedPart={newBodyPart}
                    onSelectPart={(part) => {
                      setNewBodyPart(part);
                    }}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {t('onsetDate')}
                </label>
                <input
                  required
                  type="date"
                  value={newOnsetDate}
                  onChange={(e) => setNewOnsetDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Pain Intensity (1-10 Touch Grid) */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('painRating')}
            </h2>
            <span className="text-xs font-bold text-slate-500">
              선택: <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{intensity}</span> / 10
            </span>
          </div>

          {/* Large Touch Grid 1-10 */}
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isSelected = intensity === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleIntensityClick(num)}
                  className={`h-13 rounded-xl font-black text-lg transition-all flex flex-col items-center justify-center border ${
                    isSelected
                      ? `${getIntensityColor(num)} scale-105 shadow-md`
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 active:scale-95'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            {getIntensityDescription(intensity)}
          </p>

          {/* Date & Time with Quick Buttons */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {t('timestamp')}
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickTime('now')}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500"
                >
                  지금
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTime('1h')}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500"
                >
                  1시간 전
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTime('yesterday')}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500"
                >
                  어제
                </button>
              </div>
            </div>
            <input
              required
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </section>

        {/* Section 3: Medication & Treatment */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {t('medicationLabel')}
          </label>

          {/* Quick Medication Chips */}
          {settings.medicationPresets.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {t('quickMedPresets')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {settings.medicationPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAddMedPreset(preset.name)}
                    className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 active:scale-95 transition-all"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <input
            type="text"
            placeholder={t('medicationPlaceholder')}
            value={medication}
            onChange={(e) => setMedication(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </section>

        {/* Section 4: Detailed Notes */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {t('notesLabel')}
          </label>

          {/* Quick Symptom Descriptors Chips */}
          {settings.symptomPresets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {settings.symptomPresets.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => handleAddSymptomPreset(phrase)}
                  className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 active:scale-95"
                >
                  #{phrase}
                </button>
              ))}
            </div>
          )}

          <textarea
            rows={3}
            placeholder={t('notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </section>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-600/30 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <Save size={18} />
          {t('saveRecordBtn')}
        </button>
      </form>
    </div>
  );
};

export default EntryFormPage;
