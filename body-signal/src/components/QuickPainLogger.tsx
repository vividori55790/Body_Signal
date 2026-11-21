import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Check, AlertCircle, Sparkles, HeartPulse, Plus } from 'lucide-react';
import { useHealth } from '../context/HealthContext';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';
import {
  formatMedicationPreset,
  localizeMedicationName,
  prioritizeConditionMedications,
} from '../utils/medication';
import { MedicationPreset, UNASSIGNED_CONDITION_ID } from '../types/health';
import { AddMedicationInline } from './AddMedicationInline';
import { PainLevelSelector } from './PainLevelSelector';

const QUICK_BODY_PARTS = [
  '허리/요통',
  '머리/두통',
  '목/경추',
  '어깨/등',
  '무릎/관절',
  '복부/위장',
  '손목/손',
  '발목/발',
];

const BODY_PART_EN_MAP: Record<string, string> = {
  '허리/요통': 'Lower Back',
  '머리/두통': 'Head / Headache',
  '목/경추': 'Neck',
  '어깨/등': 'Shoulder / Back',
  '무릎/관절': 'Knee / Joint',
  '복부/위장': 'Abdomen / GI',
  '손목/손': 'Wrist / Hand',
  '발목/발': 'Ankle / Foot',
};

const QUICK_MEDS = ['타이레놀', '소염진통제', '처방약', '근이완제'];
const QUICK_MED_EN_MAP: Record<string, string> = {
  타이레놀: 'Tylenol',
  소염진통제: 'NSAID',
  처방약: 'Rx Med',
  근이완제: 'Muscle Relaxant',
};

export const QuickPainLogger: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
  const { conditions, saveEntry } = useHealth();
  const { settings, resolvedLanguage, t, adjustMedicationStock } = useSettings();
  const isEn = resolvedLanguage === 'en';
  const [selectedIntensity, setSelectedIntensity] = useState<number>(5);
  const [selectedPart, setSelectedPart] = useState<string>('허리/요통');
  const [selectedConditionId, setSelectedConditionId] = useState<string>('unassigned');
  const [hasManualCondition, setHasManualCondition] = useState<boolean>(false);
  const [selectedMed, setSelectedMed] = useState<string>('');
  const [selectedMedIds, setSelectedMedIds] = useState<string[]>([]);
  const [showAddMed, setShowAddMed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const prioritizedPresets = useMemo(
    () => prioritizeConditionMedications(settings?.medicationPresets || [], selectedConditionId),
    [settings?.medicationPresets, selectedConditionId]
  );

  const availableMedItems =
    prioritizedPresets.length > 0
      ? prioritizedPresets.map((p) => ({
          id: p.id,
          label: formatMedicationPreset(p, resolvedLanguage),
          isConditionLinked:
            selectedConditionId !== UNASSIGNED_CONDITION_ID && p.conditionId === selectedConditionId,
        }))
      : (isEn ? QUICK_MEDS.map((m) => QUICK_MED_EN_MAP[m] || m) : QUICK_MEDS).map((label) => ({
          id: undefined as string | undefined,
          label,
          isConditionLinked: false,
        }));

  const activeConditions = conditions.filter((c) => !c.isArchived);

  // Auto-sync with patient's primary condition unless user explicitly picks a condition
  useEffect(() => {
    if (activeConditions.length > 0) {
      const primary = activeConditions[0];
      const match = QUICK_BODY_PARTS.find(
        (p) =>
          primary.bodyPart.includes(p.split('/')[0]) ||
          p.includes(primary.bodyPart) ||
          primary.label.includes(p.split('/')[0])
      );
      if (match) {
        setSelectedPart(match);
      }
      if (!hasManualCondition) {
        setSelectedConditionId(primary.id);
      }
    } else {
      setSelectedConditionId('unassigned');
    }
  }, [activeConditions.length]);

  const handleSelectIntensity = (num: number) => {
    triggerHaptic();
    setSelectedIntensity(num);
  };

  const handleSelectPart = (part: string) => {
    triggerHaptic();
    setSelectedPart(part);
    if (!hasManualCondition) {
      const match = activeConditions.find(
        (c) =>
          c.bodyPart.includes(part.split('/')[0]) ||
          part.includes(c.bodyPart) ||
          c.label.includes(part.split('/')[0])
      );
      setSelectedConditionId(match ? match.id : 'unassigned');
    }
  };

  const handleSelectCondition = (condId: string) => {
    triggerHaptic();
    setHasManualCondition(true);
    setSelectedConditionId(condId);
    const chosen = activeConditions.find((c) => c.id === condId);
    if (chosen) {
      const match = QUICK_BODY_PARTS.find(
        (p) =>
          chosen.bodyPart.includes(p.split('/')[0]) ||
          p.includes(chosen.bodyPart) ||
          chosen.label.includes(p.split('/')[0])
      );
      if (match) {
        setSelectedPart(match);
      }
    }
  };

  const handleToggleMed = (med: string, presetId?: string) => {
    triggerHaptic();
    const isDeselecting = selectedMed === med;
    setSelectedMed(isDeselecting ? '' : med);
    setSelectedMedIds(isDeselecting || !presetId ? [] : [presetId]);
  };

  const handleQuickSave = async () => {
    if (isSubmitting) return;
    triggerHaptic();
    setIsSubmitting(true);

    // Honor explicit condition choice; fall back to matching body-part condition only if auto-synced
    const matchingCond =
      selectedConditionId && selectedConditionId !== 'unassigned'
        ? activeConditions.find((c) => c.id === selectedConditionId)
        : undefined;

    const localizedPart = isEn ? BODY_PART_EN_MAP[selectedPart] || selectedPart : selectedPart;
    const nowIso = new Date().toISOString();

    const payload = {
      isNewCondition: false,
      isUnassigned: !matchingCond,
      conditionData: matchingCond ? { id: matchingCond.id } : {},
      logData: {
        date: nowIso,
        intensity: selectedIntensity,
        medication: selectedMed,
        medicationIds: selectedMedIds,
        medTakenAt: selectedMed.trim() ? nowIso : undefined,
        notes: isEn ? '⚡ 3s Quick Log (Home)' : '⚡ 3초 퀵 기록 (홈 화면)',
        bodyPartOverride: localizedPart,
      },
    };

    const success = await saveEntry(payload);
    setIsSubmitting(false);

    if (success) {
      if (selectedMedIds.length > 0) {
        void adjustMedicationStock(selectedMedIds, -1);
      }
      triggerHaptic();
      setJustSaved(true);
      setTimeout(() => {
        setJustSaved(false);
        onSaved?.();
      }, 1400);
    }
  };

  const getNrsButtonClass = (num: number, isSelected: boolean) => {
    if (num <= 3) {
      return isSelected
        ? 'bg-emerald-500 text-white scale-110 shadow-md ring-2 ring-emerald-400 z-10 font-black'
        : 'bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 active:scale-95';
    }
    if (num <= 6) {
      return isSelected
        ? 'bg-amber-500 text-white scale-110 shadow-md ring-2 ring-amber-400 z-10 font-black'
        : 'bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 active:scale-95';
    }
    return isSelected
      ? 'bg-rose-600 text-white scale-110 shadow-md ring-2 ring-rose-400 z-10 font-black'
      : 'bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 active:scale-95';
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-500/30 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 dark:text-amber-400">
            <Zap size={16} className="fill-amber-400 text-amber-500" />
          </span>
          <div>
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              {isEn ? '3-Second Quick Pain Log' : '3초 퀵 통증 기록 (간편 모드)'}
            </h3>
            <p className="text-[10px] text-slate-400">
              {isEn ? 'Save immediately in 3 taps without leaving Home' : '화면 이동 없이 3번의 탭으로 즉시 저장'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
          {isEn ? '3 Taps' : '터치 3번으로 끝'}
        </span>
      </div>

      {/* Step 0 (Optional): Target Condition Selection */}
      {activeConditions.length > 0 && (
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase">
            {t('quickConditionStep')}
          </label>
          <select
            aria-label={t('quickConditionStep')}
            value={selectedConditionId}
            onChange={(e) => handleSelectCondition(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            {activeConditions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.bodyPart})
              </option>
            ))}
            <option value="unassigned">{t('quickConditionUnassigned')}</option>
          </select>
        </div>
      )}

      {/* Step 1: Unified 1-Row NRS Touch Grid & Continuous Slider */}
      <div className="space-y-1.5">
        <PainLevelSelector
          value={selectedIntensity}
          onChange={setSelectedIntensity}
          variant="auto"
          showDescription={false}
        />
      </div>

      {/* Step 2: Body Part Quick Chips */}
      <div className="space-y-1.5">
        <span className="block text-[10px] font-bold text-slate-400 uppercase">
          {isEn ? '2. Affected Area (1-Tap)' : '2. 아픈 부위 선택 (1-탭)'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_BODY_PARTS.map((part) => {
            const isSelected = selectedPart === part;
            return (
              <button
                key={part}
                type="button"
                onClick={() => handleSelectPart(part)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 ring-1 ring-emerald-300 scale-102'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 active:scale-95'
                }`}
              >
                {isEn ? BODY_PART_EN_MAP[part] || part : part}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3: Quick Medication Chip (Optional) */}
      <div className="space-y-1.5">
        <span className="block text-[10px] font-bold text-slate-400 uppercase">
          {isEn ? '3. Medication Taken (Optional)' : '3. 복약 여부 (선택)'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {availableMedItems.map((item) => {
            const isSelected = selectedMed === item.label;
            const displayMed = isEn
              ? QUICK_MED_EN_MAP[item.label] || localizeMedicationName(item.label, 'en')
              : localizeMedicationName(item.label, 'ko');
            return (
              <button
                key={item.id || item.label}
                type="button"
                onClick={() => handleToggleMed(item.label, item.id)}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all break-words ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-300'
                    : item.isConditionLinked
                    ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/70 active:scale-95'
                    : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 active:scale-95'
                }`}
              >
                {displayMed} {isSelected && '✓'}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setShowAddMed(true);
            }}
            className="min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-300 dark:border-emerald-700 active:scale-95 flex items-center gap-1"
          >
            <Plus size={12} /> {isEn ? 'Add Med' : '+ 약 추가'}
          </button>
        </div>
      </div>

      <AddMedicationInline
        isOpen={showAddMed}
        onClose={() => setShowAddMed(false)}
        conditionId={selectedConditionId}
        onAdded={(newMed: string, preset?: MedicationPreset) => {
          setSelectedMed(newMed);
          setSelectedMedIds(preset?.id ? [preset.id] : []);
          setShowAddMed(false);
        }}
      />

      {/* Instant Submit Button */}
      <button
        type="button"
        disabled={isSubmitting}
        onClick={handleQuickSave}
        className={`w-full min-h-[48px] py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all select-none disabled:opacity-50 ${
          justSaved
            ? 'bg-emerald-500 text-white scale-98 shadow-emerald-500/30'
            : 'bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white shadow-emerald-600/20'
        }`}
      >
        {justSaved ? (
          <>
            <Check size={18} />
            {isEn ? 'Saved in 3 seconds!' : '기록되었습니다! (3초 저장 완료)'}
          </>
        ) : (
          <>
            <Zap size={16} className="fill-current" />
            {isEn
              ? `[NRS ${selectedIntensity} • ${BODY_PART_EN_MAP[selectedPart] || selectedPart}] Save Quickly`
              : `[NRS ${selectedIntensity} • ${selectedPart}] 3초 바로 기록하기`}
          </>
        )}
      </button>
    </div>
  );
};

export default QuickPainLogger;
