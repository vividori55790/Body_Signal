import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { triggerHaptic } from '../utils/native';
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
  const isEn = settingsCtx?.settings.language === 'en';

  // Ephemeral slider state: defaults to button mode, merges to slider on hold/slide, reverts on release
  const [isSliderMode, setIsSliderMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const sliderActivatedRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const isDarkVariant = variant === 'dark';

  const getColorClass = (num: number, isSelected: boolean) => {
    if (isDarkVariant) {
      if (num <= 3) {
        return isSelected
          ? 'bg-emerald-500 text-white scale-105 shadow-md ring-2 ring-emerald-300 font-black'
          : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60';
      }
      if (num <= 6) {
        return isSelected
          ? 'bg-amber-500 text-white scale-105 shadow-md ring-2 ring-amber-300 font-black'
          : 'bg-amber-950/60 text-amber-300 border border-amber-800/60 hover:bg-amber-900/60';
      }
      return isSelected
        ? 'bg-rose-600 text-white scale-105 shadow-md ring-2 ring-rose-400 font-black'
        : 'bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60';
    }

    if (num <= 3) {
      return isSelected
        ? 'bg-emerald-600 text-white scale-105 shadow-sm ring-2 ring-emerald-400 font-black'
        : 'bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300';
    }
    if (num <= 6) {
      return isSelected
        ? 'bg-amber-500 text-white scale-105 shadow-sm ring-2 ring-amber-400 font-black'
        : 'bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300';
    }
    return isSelected
      ? 'bg-rose-600 text-white scale-105 shadow-sm ring-2 ring-rose-400 font-black'
      : 'bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300';
  };

  const getIntensityDescription = (num: number) => {
    if (num <= 3) return t('painMildDesc');
    if (num <= 6) return t('painModerateDesc');
    return t('painSevereDesc');
  };

  const calculateIntensityFromPosition = useCallback((clientX: number): number => {
    if (!containerRef.current) return valueRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return valueRef.current;
    const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = relativeX / rect.width;
    const computed = Math.round(percentage * 9) + 1;
    return Math.max(1, Math.min(10, computed));
  }, []);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const activateSliderAt = useCallback(
    (clientX: number) => {
      if (!sliderActivatedRef.current) {
        sliderActivatedRef.current = true;
        setIsSliderMode(true);
        setIsDragging(true);
        triggerHaptic();
      }
      const next = calculateIntensityFromPosition(clientX);
      if (next !== valueRef.current) {
        triggerHaptic();
        onChange(next);
      }
    },
    [calculateIntensityFromPosition, onChange]
  );

  // Global pointer tracking during press/hold/slide; auto-reverts to Button Mode on release
  useEffect(() => {
    const handleMove = (clientX: number) => {
      if (!pointerDownRef.current) return;
      if (!sliderActivatedRef.current && Math.abs(clientX - startXRef.current) >= 10) {
        clearLongPressTimer();
        activateSliderAt(clientX);
        return;
      }
      if (sliderActivatedRef.current) {
        const next = calculateIntensityFromPosition(clientX);
        if (next !== valueRef.current) {
          triggerHaptic();
          onChange(next);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (!pointerDownRef.current) return;
      if (sliderActivatedRef.current) {
        e.preventDefault();
      }
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    const onRelease = () => {
      if (!pointerDownRef.current) return;
      clearLongPressTimer();
      pointerDownRef.current = false;
      if (sliderActivatedRef.current) {
        sliderActivatedRef.current = false;
        setIsDragging(false);
        setIsSliderMode(false);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onRelease);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onRelease);
    window.addEventListener('touchcancel', onRelease);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onRelease);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onRelease);
      window.removeEventListener('touchcancel', onRelease);
    };
  }, [activateSliderAt, calculateIntensityFromPosition, onChange]);

  const handleRowPointerDown = (clientX: number, initialNum?: number) => {
    pointerDownRef.current = true;
    startXRef.current = clientX;
    sliderActivatedRef.current = false;

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      if (!pointerDownRef.current) return;
      if (initialNum !== undefined && initialNum !== valueRef.current) {
        onChange(initialNum);
      }
      activateSliderAt(clientX);
    }, 220);
  };

  const handleButtonClick = (num: number) => {
    if (sliderActivatedRef.current) return;
    triggerHaptic();
    onChange(num);
  };

  const progressPercent = ((value - 1) / 9) * 100;

  return (
    <div className={`space-y-2 w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {t('painLevelTitle')}{' '}
          <span className="font-normal opacity-75">· {isEn ? 'Hold & slide' : '밀어서 조절'}</span>
        </span>

        <span
          className={`text-xs font-black px-2.5 py-0.5 rounded-lg transition-all ${
            value >= 7
              ? 'bg-rose-600 text-white'
              : value >= 4
              ? 'bg-amber-500 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          NRS {value} / 10
        </span>
      </div>

      {/* Main Selector Track Container (Button Mode by default, merges into Slider while holding/sliding) */}
      <div
        ref={containerRef}
        className="w-full touch-pan-y select-none"
      >
        {isSliderMode ? (
          <div className="py-1.5 px-1">
            <div
              role="slider"
              aria-valuemin={1}
              aria-valuemax={10}
              aria-valuenow={value}
              aria-label={isEn ? 'Pain intensity slider' : '통증 강도 슬라이더'}
              className="relative h-11 w-full flex items-center touch-none select-none"
            >
              <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative border border-slate-300 dark:border-slate-700">
                <div
                  className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="absolute inset-x-0 flex justify-between px-1 pointer-events-none">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <span
                    key={num}
                    className={`h-2 w-0.5 rounded-full ${
                      num <= value ? 'bg-white/80' : 'bg-slate-400/50 dark:bg-slate-600'
                    }`}
                  />
                ))}
              </div>

              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-black text-xs text-white transition-transform ${
                  isDragging ? 'scale-120 ring-4 ring-teal-400/40' : 'scale-100'
                } ${
                  value >= 7
                    ? 'bg-rose-600'
                    : value >= 4
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ left: `${progressPercent}%` }}
              >
                {value}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-10 gap-1 select-none">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
              const isSelected = value === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleButtonClick(num)}
                  onMouseDown={(e) => handleRowPointerDown(e.clientX, num)}
                  onTouchStart={(e) => {
                    if (e.touches[0]) {
                      handleRowPointerDown(e.touches[0].clientX, num);
                    }
                  }}
                  aria-label={isEn ? `Pain level ${num}` : `통증 강도 ${num}점`}
                  className={`min-h-[44px] h-11 rounded-xl font-black text-sm flex items-center justify-center transition-all select-none ${getColorClass(
                    num,
                    isSelected
                  )}`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Compact Scale / Description */}
      {showDescription ? (
        <div
          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border ${
            value <= 3
              ? isDarkVariant
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
              : value <= 6
              ? isDarkVariant
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300'
              : isDarkVariant
              ? 'bg-rose-950/50 border-rose-800/70 text-rose-200'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800/70 dark:text-rose-200'
          }`}
        >
          {getIntensityDescription(value)}
        </div>
      ) : (
        <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1">
          <span className="text-emerald-600 dark:text-emerald-400">1-3 {t('painMild')}</span>
          <span className="text-amber-600 dark:text-amber-400">4-6 {t('painModerate')}</span>
          <span className="text-rose-600 dark:text-rose-400">7-10 {t('painSevere')}</span>
        </div>
      )}
    </div>
  );
};

export default PainLevelSelector;
