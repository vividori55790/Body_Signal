import React, { useState, useEffect } from 'react';
import { Zap, Check, AlertCircle, HeartPulse, Pill, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useHealth } from '../context/HealthContext';
import { triggerHaptic } from '../utils/native';

// Top 6 Most Common Acute Pain Regions with clear, high-contrast emojis & 56dp+ tap targets
const ACUTE_BODY_PARTS = [
  { id: 'head', name: '머리/두통', icon: '🧠', desc: '이마, 관자놀이, 뒷머리' },
  { id: 'neck', name: '목/경추', icon: '🧣', desc: '목덜미, 뻐근함' },
  { id: 'shoulder', name: '어깨/등', icon: '💪', desc: '견갑골, 오십견' },
  { id: 'lower_back', name: '허리/요통', icon: '🧍', desc: '디스크, 삐끗함' },
  { id: 'knee', name: '무릎/관절', icon: '🦵', desc: '무릎, 고관절, 다리' },
  { id: 'stomach', name: '배/복부', icon: '🫄', desc: '위경련, 체함, 복통' },
];

const COMMON_ACUTE_MEDS = [
  '타이레놀(아세트아미노펜)',
  '이부프로펜/소염제',
  '병원 처방 진통제',
  '근육이완제',
];

export const AcutePainMode: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { conditions, saveEntry } = useHealth();

  const [intensity, setIntensity] = useState<number>(7); // Default to acute distress level
  const [selectedPart, setSelectedPart] = useState<string>('허리/요통');
  const [tookMed, setTookMed] = useState<boolean>(false);
  const [selectedMed, setSelectedMed] = useState<string>('타이레놀(아세트아미노펜)');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const activeConditions = conditions.filter((c) => !c.isArchived);

  // Auto-select patient's active primary condition body part if available
  useEffect(() => {
    if (activeConditions.length > 0) {
      const primary = activeConditions[0];
      const matchedPart = ACUTE_BODY_PARTS.find(
        (p) =>
          primary.bodyPart.includes(p.name.split('/')[0]) ||
          p.name.includes(primary.bodyPart) ||
          primary.label.includes(p.name.split('/')[0])
      );
      if (matchedPart) {
        setSelectedPart(matchedPart.name);
      }
    }
  }, [activeConditions.length]);

  const handleSelectIntensity = (num: number) => {
    triggerHaptic();
    setIntensity(num);
  };

  const handleSelectPart = (partName: string) => {
    triggerHaptic();
    setSelectedPart(partName);
  };

  const handleQuickSave = async () => {
    if (isSubmitting) return;
    triggerHaptic();
    setIsSubmitting(true);

    const matchingCond = activeConditions.find(
      (c) =>
        c.bodyPart.includes(selectedPart.split('/')[0]) ||
        selectedPart.includes(c.bodyPart) ||
        c.label.includes(selectedPart.split('/')[0])
    );

    const payload = {
      isNewCondition: !matchingCond,
      conditionData: matchingCond
        ? { id: matchingCond.id }
        : {
            label: selectedPart,
            bodyPart: selectedPart,
            onsetDate: new Date().toISOString().split('T')[0],
          },
      logData: {
        date: new Date().toISOString(),
        intensity,
        medication: tookMed ? selectedMed : '',
        notes: '🚨 급성 통증 1초 집중 기록',
        bodyPartOverride: selectedPart,
      },
    };

    const success = await saveEntry(payload);
    setIsSubmitting(false);

    if (success) {
      triggerHaptic();
      setIsSaved(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    }
  };

  if (isSaved) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-600 text-white p-6 animate-in fade-in">
        <div className="text-center space-y-4 max-w-xs">
          <div className="w-20 h-20 rounded-full bg-white/20 mx-auto flex items-center justify-center text-4xl shadow-inner animate-bounce">
            ✓
          </div>
          <h2 className="text-2xl font-black">3초 저장 완료!</h2>
          <p className="text-sm text-emerald-100 font-medium leading-relaxed">
            NRS {intensity}점 ({selectedPart}) 통증이 안전하게 기록되었습니다. 무리하지 마시고 편안히 쉬세요.
          </p>
        </div>
      </div>
    );
  }

  // Visual distinction colors: Green (1-3), Yellow/Amber (4-6), Red/Rose (7-10)
  const getNrsButtonStyle = (num: number, isSelected: boolean) => {
    if (num <= 3) {
      // Green 1-3
      return isSelected
        ? 'bg-emerald-500 text-white scale-105 shadow-xl shadow-emerald-500/50 ring-4 ring-emerald-300 font-black'
        : 'bg-emerald-950/70 text-emerald-300 border-2 border-emerald-700/60 hover:bg-emerald-900/80 active:scale-95 font-extrabold';
    }
    if (num <= 6) {
      // Yellow 4-6
      return isSelected
        ? 'bg-amber-500 text-white scale-105 shadow-xl shadow-amber-500/50 ring-4 ring-amber-300 font-black'
        : 'bg-amber-950/70 text-amber-300 border-2 border-amber-700/60 hover:bg-amber-900/80 active:scale-95 font-extrabold';
    }
    // Red 7-10
    return isSelected
      ? 'bg-rose-600 text-white scale-105 shadow-xl shadow-rose-600/50 ring-4 ring-rose-400 font-black'
      : 'bg-rose-950/70 text-rose-300 border-2 border-rose-700/60 hover:bg-rose-900/80 active:scale-95 font-extrabold';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-white overflow-y-auto animate-in fade-in">
      {/* Top Bar with Big Exit Button */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            onClose();
          }}
          className="min-h-[48px] min-w-[72px] flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs active:scale-95 transition-all"
        >
          <ArrowLeft size={18} /> 닫기
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 rounded-full bg-rose-500 animate-ping" />
          <h1 className="font-black text-sm tracking-wide text-rose-400 flex items-center gap-1">
            <Zap size={16} className="fill-rose-400" />
            급성 통증 1초 집중 기록 모드
          </h1>
        </div>
      </div>

      <div className="flex-1 p-4 max-w-md mx-auto w-full space-y-6 pb-36">
        {/* Step 1: 56dp+ NRS Touch Numbers with Clear Visual Distinction */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              1. 지금 얼마나 아프신가요? (NRS 1~10)
            </span>
            <span
              className={`text-xl font-black px-3.5 py-1 rounded-xl shadow-sm ${
                intensity >= 7
                  ? 'bg-rose-600 text-white'
                  : intensity >= 4
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              NRS {intensity} / 10
            </span>
          </div>

          {/* Description banner */}
          <div
            className={`p-2.5 rounded-xl text-xs font-bold transition-all border ${
              intensity <= 3
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : intensity <= 6
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-rose-950/50 border-rose-800/70 text-rose-200 animate-pulse'
            }`}
          >
            {intensity <= 3
              ? '🟢 1~3점: 가벼운 통증 (일상생활 가능, 수면 방해 없음)'
              : intensity <= 6
              ? '🟡 4~6점: 중등도 통증 (일상생활 지장, 휴식 필요)'
              : '🔴 7~10점: 극심한 통증 (즉각 안정 및 진통 처치 요망)'}
          </div>

          {/* 10 Huge 56dp+ Touch Numbers (2 Rows x 5 Cols, min-h-[58px]) */}
          <div className="grid grid-cols-5 gap-2.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isSelected = intensity === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSelectIntensity(num)}
                  aria-label={`통증 강도 ${num}점`}
                  className={`min-h-[58px] h-14 rounded-2xl text-xl flex items-center justify-center transition-all select-none ${getNrsButtonStyle(
                    num,
                    isSelected
                  )}`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between text-[11px] font-bold text-slate-400 px-1">
            <span className="text-emerald-400 font-extrabold">🟢 1-3 경도</span>
            <span className="text-amber-400 font-extrabold">🟡 4-6 중등도</span>
            <span className="text-rose-400 font-extrabold">🔴 7-10 극심</span>
          </div>
        </section>

        {/* Step 2: Instant Single-Tap Selection for Primary Body Parts */}
        <section className="space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            2. 어디가 가장 아프신가요? (원터치 선택)
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            {ACUTE_BODY_PARTS.map((part) => {
              const isSelected = selectedPart === part.name;
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => handleSelectPart(part.name)}
                  aria-pressed={isSelected}
                  className={`min-h-[64px] p-3.5 rounded-2xl text-left transition-all border flex items-center gap-3 select-none ${
                    isSelected
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-300 scale-102'
                      : 'bg-slate-800/90 border-slate-700/80 text-slate-300 hover:bg-slate-750 active:scale-95'
                  }`}
                >
                  <span className="text-2xl shrink-0">{part.icon}</span>
                  <div className="min-w-0">
                    <h3 className="font-black text-sm truncate">{part.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{part.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 3: Medication Check */}
        <section className="space-y-3 p-4 rounded-2xl bg-slate-800/70 border border-slate-700/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill size={18} className="text-blue-400" />
              <span className="font-bold text-xs text-slate-200">진통제나 약을 드셨나요?</span>
            </div>
            <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setTookMed(false);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !tookMed ? 'bg-slate-700 text-white shadow' : 'text-slate-400'
                }`}
              >
                안 먹음
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setTookMed(true);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tookMed ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
                }`}
              >
                먹었음
              </button>
            </div>
          </div>

          {tookMed && (
            <div className="space-y-2 pt-2 border-t border-slate-700/60 animate-in fade-in">
              <span className="text-[11px] font-bold text-slate-300 block">복용한 약 선택:</span>
              <div className="grid grid-cols-2 gap-2">
                {COMMON_ACUTE_MEDS.map((med) => {
                  const isSelected = selectedMed === med;
                  return (
                    <button
                      key={med}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedMed(med);
                      }}
                      className={`min-h-[44px] p-2 rounded-xl text-xs font-bold transition-all text-left truncate flex items-center justify-between border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-400 shadow-sm ring-1 ring-blue-300'
                          : 'bg-slate-700/60 text-slate-300 border-slate-600/50 hover:bg-slate-700'
                      }`}
                    >
                      <span className="truncate">{med}</span>
                      {isSelected && <Check size={14} className="shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Floating Bottom Massive 3-Second Quick Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/95 border-t border-slate-800 backdrop-blur-lg z-20">
        <div className="max-w-md mx-auto space-y-1">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleQuickSave}
            className="w-full min-h-[60px] py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-black text-lg shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all select-none disabled:opacity-50"
          >
            <Zap size={22} className="fill-white" />
            <span>[NRS {intensity}점 • {selectedPart}] 3초 즉시 저장</span>
          </button>
          <p className="text-center text-[10px] text-slate-400 font-medium">
            원터치로 건강 기록에 즉시 암호화 저장됩니다 (3초 완료)
          </p>
        </div>
      </div>
    </div>
  );
};

export default AcutePainMode;
