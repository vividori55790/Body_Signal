import React, { useState } from 'react';
import { ArrowLeft, Clock, Save, Sparkles, Plus, AlertCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import BodyMap from '../components/BodyMap';
import { triggerHaptic } from '../utils/native';

const PAIN_QUALITIES = [
  '욱신거림',
  '찌르는 듯함',
  '타는 듯함',
  '뻐근/묵직함',
  '조이는 느낌',
  '저림/전기',
  '쥐남/경련',
];

const RADIATIONS = ['하지(다리) 방사', '상지(팔) 방사', '등/견갑골 방사', '골반으로 뻗침'];

const TRIGGERS = ['보행 시', '오래 앉을 때', '아침 기상 시', '기침/재채기', '스트레스', '날씨/추위'];

const RELIEF_FACTORS = ['누워서 휴식', '온찜질', '냉찜질', '스트레칭', '약 복용 후'];

const RED_FLAGS = [
  '마비/감각 저하',
  '다리/팔 근력 약화',
  '38도 이상 고열 동반',
  '대소변 장애',
];

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

  // Clinical PQRST & Red Flag States
  const [selectedQualities, setSelectedQualities] = useState<string[]>([]);
  const [selectedRadiation, setSelectedRadiation] = useState<string>('');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [selectedReliefs, setSelectedReliefs] = useState<string[]>([]);
  const [selectedRedFlags, setSelectedRedFlags] = useState<string[]>([]);

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

  const handleToggleQuality = (q: string) => {
    triggerHaptic();
    setSelectedQualities((prev) =>
      prev.includes(q) ? prev.filter((item) => item !== q) : [...prev, q]
    );
  };

  const handleToggleRadiation = (rad: string) => {
    triggerHaptic();
    setSelectedRadiation((prev) => (prev === rad ? '' : rad));
  };

  const handleToggleTrigger = (tr: string) => {
    triggerHaptic();
    setSelectedTriggers((prev) =>
      prev.includes(tr) ? prev.filter((item) => item !== tr) : [...prev, tr]
    );
  };

  const handleToggleRelief = (rel: string) => {
    triggerHaptic();
    setSelectedReliefs((prev) =>
      prev.includes(rel) ? prev.filter((item) => item !== rel) : [...prev, rel]
    );
  };

  const handleToggleRedFlag = (rf: string) => {
    triggerHaptic();
    setSelectedRedFlags((prev) =>
      prev.includes(rf) ? prev.filter((item) => item !== rf) : [...prev, rf]
    );
  };

  const handleAddMedPreset = (name: string) => {
    triggerHaptic();
    setMedication((prev) => (prev ? `${prev}, ${name}` : name));
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
        painQuality: selectedQualities,
        radiation: selectedRadiation,
        triggers: selectedTriggers,
        reliefFactors: selectedReliefs,
        redFlags: selectedRedFlags,
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
    if (num <= 3) return '1~3: 가벼운 통증 (일상생활 가능, 수면 지장 없음)';
    if (num <= 6) return '4~6: 중등도 통증 (일상생활에 지장 발생, 진통제 필요)';
    if (num <= 8) return '7~8: 매우 심한 통증 (거동 힘들고 집중 불가능)';
    return '9~10: 극심하여 참을 수 없음 (즉시 응급 진료 요망)';
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
              {t('followUpMode')}
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
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                {t('selectCondition')}
              </label>
              <select
                value={selectedConditionId}
                onChange={(e) => setSelectedConditionId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className={`h-12 rounded-xl font-black text-lg transition-all flex flex-col items-center justify-center border ${
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

        {/* Section 3: Clinical PQRST (Pain Quality & Radiation) */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              통증 양상 및 방사통 (PQRST 의학 척도)
            </h2>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              의사 문진 필수 항목
            </span>
          </div>

          {/* Quality Chips */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
              어떤 느낌으로 아픈가요? (다중 선택 가능)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_QUALITIES.map((q) => {
                const isSelected = selectedQualities.includes(q);
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleToggleQuality(q)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm scale-102'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 active:scale-95'
                    }`}
                  >
                    {q} {isSelected && '✓'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Radiation Chips */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
              다른 부위로 뻗치는 방사통이 있나요?
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RADIATIONS.map((rad) => {
                const isSelected = selectedRadiation === rad;
                return (
                  <button
                    key={rad}
                    type="button"
                    onClick={() => handleToggleRadiation(rad)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm scale-102'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 active:scale-95'
                    }`}
                  >
                    {rad} {isSelected && '✓'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Triggers & Relief Factors */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
              통증 악화 요인:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {TRIGGERS.map((tr) => {
                const isSelected = selectedTriggers.includes(tr);
                return (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => handleToggleTrigger(tr)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      isSelected
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {tr}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
              통증 완화 요인:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RELIEF_FACTORS.map((rel) => {
                const isSelected = selectedReliefs.includes(rel);
                return (
                  <button
                    key={rel}
                    type="button"
                    onClick={() => handleToggleRelief(rel)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      isSelected
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {rel}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 4: Red Flags Safety Check (Medical Safety Net) */}
        <section className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 shadow-sm space-y-2.5">
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <ShieldAlert size={16} />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              위험 징후 (Red Flags) 확인
            </h2>
          </div>
          <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80">
            해당되는 응급 증상이 있다면 체크하세요 (의료진에게 최우선 경고 전달):
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {RED_FLAGS.map((rf) => {
              const isSelected = selectedRedFlags.includes(rf);
              return (
                <button
                  key={rf}
                  type="button"
                  onClick={() => handleToggleRedFlag(rf)}
                  className={`p-2 rounded-xl text-xs font-bold text-left transition-all border ${
                    isSelected
                      ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {rf} {isSelected && '⚠️'}
                </button>
              );
            })}
          </div>

          {selectedRedFlags.length > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-[11px] font-bold text-rose-900 dark:text-rose-100 flex items-start gap-1.5 animate-in fade-in">
              <AlertTriangle size={15} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>
                위험 징후가 체크되었습니다. 의무기록에 응급 상태로 표기되며, 진단 전이라도 상태 악화 시 즉시 응급실을 내원하시기 바랍니다.
              </span>
            </div>
          )}
        </section>

        {/* Section 5: Medication & Treatment */}
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

        {/* Section 6: Notes */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {t('notesLabel')}
          </label>
          <textarea
            rows={2}
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
