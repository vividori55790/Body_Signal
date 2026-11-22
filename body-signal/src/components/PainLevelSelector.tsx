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
  const isEn = settingsCtx?.resolvedLanguage === 'en';

  // Ephemeral slider state: defaults to button mode, merges to slider on hold/slide, reverts on release
  const [isSliderMode, setIsSliderMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const sliderActivatedRef = useRef(false);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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
    const computed = Math.floor(percentage * 10) + 1;
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
    const handleMove = (clientX: number, clientY?: number) => {
      if (!pointerDownRef.current) return;
      if (!sliderActivatedRef.current) {
        const dx = Math.abs(clientX - startXRef.current);
        const dy = clientY !== undefined ? Math.abs(clientY - startYRef.current) : 0;
        if (dy >= 10 && dy > dx) {
          clearLongPressTimer();
          pointerDownRef.current = false;
          return;
        }
        if (dx >= 8) {
          clearLongPressTimer();
          activateSliderAt(clientX);
          return;
        }
      }
      if (sliderActivatedRef.current) {
        const next = calculateIntensityFromPosition(clientX);
        if (next !== valueRef.current) {
          triggerHaptic();
          onChange(next);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (!pointerDownRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      if (sliderActivatedRef.current) {
        e.preventDefault();
      }
      handleMove(touch.clientX, touch.clientY);
      if (sliderActivatedRef.current && e.cancelable) {
        e.preventDefault();
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

  const handleRowPointerDown = (clientX: number, clientY: number, initialNum?: number) => {
    pointerDownRef.current = true;
    startXRef.current = clientX;
    startYRef.current = clientY;
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

  const fillPercent = value * 10;

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

      {/* Main Selector Track Container (Button Mode stays mounted so long-press -> drag never drops touch target) */}
      <div
        ref={containerRef}
        className={`relative w-full h-11 select-none ${isSliderMode ? 'touch-none' : 'touch-pan-y'}`}
      >
        <div
          className={`grid grid-cols-10 gap-1 h-11 select-none transition-opacity duration-100 ${
            isSliderMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
            const isSelected = value === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => handleButtonClick(num)}
                onMouseDown={(e) => handleRowPointerDown(e.clientX, e.clientY, num)}
                onTouchStart={(e) => {
                  if (e.touches[0]) {
                    handleRowPointerDown(e.touches[0].clientX, e.touches[0].clientY, num);
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

        {/* Same-height (h-11) unified bar morph when holding or sliding; cleanly reverts on finger release */}
        {isSliderMode && (
          <div
            role="slider"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={value}
            aria-label={isEn ? 'Pain intensity slider' : '통증 강도 슬라이더'}
            className={`absolute inset-0 h-11 w-full rounded-xl overflow-hidden border pointer-events-none select-none z-10 shadow-inner ${
              isDarkVariant
                ? 'bg-slate-900 border-slate-700'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
            }`}
          >
            {/* Positional gradient revealed smoothly up to current segment */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 transition-[clip-path] duration-75"
              style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }}
            />

            {/* Crisp right boundary edge inside the bar */}
            {value < 10 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-sm transition-[left] duration-75"
                style={{ left: `calc(${fillPercent}% - 1px)` }}
              />
            )}

            {/* Merged 10-segment numbers aligned 1:1 with the discrete buttons */}
            <div className="relative h-full grid grid-cols-10 gap-0">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
                const isFilled = num <= value;
                const isCurrent = num === value;
                return (
                  <div
                    key={num}
                    className={`h-full flex items-center justify-center border-r last:border-r-0 transition-transform duration-75 ${
                      isDarkVariant ? 'border-white/10' : 'border-slate-300/40 dark:border-white/10'
                    } ${
                      isCurrent && isDragging
                        ? 'text-white font-black text-base scale-110 bg-white/15'
                        : isFilled
                        ? 'text-white font-bold text-sm'
                        : isDarkVariant
                        ? 'text-slate-400 font-semibold text-sm'
                        : 'text-slate-500 dark:text-slate-400 font-semibold text-sm'
                    }`}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
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
