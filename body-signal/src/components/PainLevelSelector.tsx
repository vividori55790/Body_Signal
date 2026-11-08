import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { triggerHaptic } from '../utils/native';
import { Sliders, Grid } from 'lucide-react';
import { SettingsContext } from '../context/SettingsContext';
import { translations } from '../i18n/translations';

export interface PainLevelSelectorProps {
  value: number; // 1 to 10
  onChange: (value: number) => void;
  variant?: 'dark' | 'light' | 'auto';
  showDescription?: boolean;
  className?: string;
}

export const PainLevelSelector: React.FC<PainLevelSelectorProps> = ({
  value,
  onChange,
  variant = 'auto',
  showDescription = true,
  className = '',
}) => {
  const settingsCtx = useContext(SettingsContext);
  const t = settingsCtx?.t || ((k: keyof typeof translations.ko) => translations.ko[k] || (k as string));

  const [isSliderMode, setIsSliderMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDarkVariant = variant === 'dark';

  const getColorClass = (num: number, isSelected: boolean) => {
    if (isDarkVariant) {
      if (num <= 3) {
        return isSelected
          ? 'bg-emerald-500 text-white scale-105 shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-300 font-black'
          : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60 active:scale-95';
      }
      if (num <= 6) {
        return isSelected
          ? 'bg-amber-500 text-white scale-105 shadow-lg shadow-amber-500/50 ring-2 ring-amber-300 font-black'
          : 'bg-amber-950/60 text-amber-300 border border-amber-800/60 hover:bg-amber-900/60 active:scale-95';
      }
      return isSelected
        ? 'bg-rose-600 text-white scale-105 shadow-lg shadow-rose-600/50 ring-2 ring-rose-400 font-black'
        : 'bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60 active:scale-95';
    }

    // Auto / Light variant
    if (num <= 3) {
      return isSelected
        ? 'bg-emerald-500 text-white scale-105 shadow-md ring-2 ring-emerald-400 font-black'
        : 'bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 active:scale-95';
    }
    if (num <= 6) {
      return isSelected
        ? 'bg-amber-500 text-white scale-105 shadow-md ring-2 ring-amber-400 font-black'
        : 'bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 active:scale-95';
    }
    return isSelected
      ? 'bg-rose-600 text-white scale-105 shadow-md ring-2 ring-rose-400 font-black'
      : 'bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 active:scale-95';
  };

  const getIntensityDescription = (num: number) => {
    if (num <= 3) return t('painMildDesc');
    if (num <= 6) return t('painModerateDesc');
    return t('painSevereDesc');
  };

  const calculateIntensityFromPosition = useCallback((clientX: number): number => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = relativeX / rect.width;
    const computed = Math.round(percentage * 9) + 1; // 1 to 10
    return Math.max(1, Math.min(10, computed));
  }, [value]);

  const handlePointerDown = (clientX: number) => {
    setIsDragging(true);
    const newIntensity = calculateIntensityFromPosition(clientX);
    if (newIntensity !== value) {
      triggerHaptic();
      onChange(newIntensity);
    }
  };

  const handlePointerMove = (clientX: number) => {
    if (!isDragging) return;
    const newIntensity = calculateIntensityFromPosition(clientX);
    if (newIntensity !== value) {
      triggerHaptic();
      onChange(newIntensity);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Global pointer move & up for smooth dragging
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handlePointerMove(clientX);
    };

    const onPointerEnd = () => {
      handlePointerUp();
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerEnd);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerEnd);

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerEnd);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerEnd);
    };
  }, [isDragging, handlePointerMove]);

  // Long press detection on buttons to seamlessly switch to slider line
  const handleButtonTouchStart = (num: number) => {
    longPressTimerRef.current = setTimeout(() => {
      triggerHaptic();
      setIsSliderMode(true);
      setIsDragging(true);
      onChange(num);
    }, 280);
  };

  const handleButtonTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleButtonClick = (num: number) => {
    triggerHaptic();
    onChange(num);
  };

  const progressPercent = ((value - 1) / 9) * 100;

  return (
    <div className={`space-y-2.5 w-full ${className}`}>
      {/* Top Header Controls (Mode Switch & Level Tag) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t('painLevelTitle')}
          </span>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setIsSliderMode(!isSliderMode);
            }}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
              isSliderMode
                ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-400/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            {isSliderMode ? (
              <>
                <Grid size={11} /> {t('painButtonMode')}
              </>
            ) : (
              <>
                <Sliders size={11} /> {t('painSliderMode')}
              </>
            )}
          </button>
        </div>

        <span
          className={`text-sm font-black px-2.5 py-0.5 rounded-xl shadow-sm transition-all ${
            value >= 7
              ? 'bg-rose-600 text-white'
              : value >= 4
              ? 'bg-amber-500 text-white'
              : 'bg-emerald-500 text-white'
          }`}
        >
          NRS {value} / 10
        </span>
      </div>

      {/* Description Banner */}
      {showDescription && (
        <div
          className={`p-2 rounded-xl text-[11px] font-bold transition-all border ${
            value <= 3
              ? isDarkVariant
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
              : value <= 6
              ? isDarkVariant
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300'
              : isDarkVariant
              ? 'bg-rose-950/50 border-rose-800/70 text-rose-200 animate-pulse'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800/70 dark:text-rose-200 animate-pulse'
          }`}
        >
          {getIntensityDescription(value)}
        </div>
      )}

      {/* Main Selector: 1 Single Horizontal Row */}
      {isSliderMode ? (
        /* Continuous Slider Line Track (하나의 선으로 통합된 슬라이더 라인) */
        <div className="py-2 px-1">
          <div
            ref={trackRef}
            role="slider"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={value}
            aria-label="통증 강도 슬라이더"
            onPointerDown={(e) => handlePointerDown(e.clientX)}
            className="relative h-10 w-full flex items-center cursor-pointer touch-none select-none"
          >
            {/* Background Line Track */}
            <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative border border-slate-300 dark:border-slate-700">
              {/* Gradient Fill Track */}
              <div
                className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Slider Ticks (1 to 10 markers) */}
            <div className="absolute inset-x-0 flex justify-between px-1 pointer-events-none">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                <div
                  key={num}
                  className={`flex flex-col items-center text-[9px] font-black ${
                    num <= value
                      ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span className="h-2 w-0.5 bg-white/70 rounded-full" />
                </div>
              ))}
            </div>

            {/* Draggable Thumb Knob */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-black text-xs text-white transition-transform ${
                isDragging ? 'scale-125 ring-4 ring-indigo-400/50' : 'scale-100 hover:scale-110'
              } ${
                value >= 7
                  ? 'bg-rose-600'
                  : value >= 4
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ left: `${progressPercent}%` }}
            >
              {value}
            </div>
          </div>

          <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1 mt-1">
            <span className="text-emerald-500">1 {t('painMild')}</span>
            <span className="text-amber-500">5 {t('painModerate')}</span>
            <span className="text-rose-500">10 {t('painSevere')}</span>
          </div>
        </div>
      ) : (
        /* Discrete 10-Button Layout in STRICT 1 Horizontal Row (1줄 10버튼) */
        <div className="space-y-1">
          <div className="grid grid-cols-10 gap-1 select-none">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
              const isSelected = value === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleButtonClick(num)}
                  onTouchStart={() => handleButtonTouchStart(num)}
                  onTouchEnd={handleButtonTouchEnd}
                  onMouseDown={() => handleButtonTouchStart(num)}
                  onMouseUp={handleButtonTouchEnd}
                  aria-label={`통증 강도 ${num}점`}
                  className={`min-h-[46px] h-11 rounded-xl font-black text-sm flex items-center justify-center transition-all select-none ${getColorClass(
                    num,
                    isSelected
                  )}`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1">
            <span className="text-emerald-500 font-extrabold">🟢 1-3 {t('painMild')}</span>
            <span className="text-amber-500 font-extrabold">🟡 4-6 {t('painModerate')}</span>
            <span className="text-rose-500 font-extrabold">🔴 7-10 {t('painSevere')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PainLevelSelector;
