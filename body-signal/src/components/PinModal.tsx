import React, { useState, useEffect, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Delete, X, AlertCircle } from 'lucide-react';
import { triggerHaptic } from '../utils/native';
import { SettingsContext } from '../context/SettingsContext';

interface PinModalProps {
  isOpen: boolean;
  mode: 'unlock' | 'set' | 'change';
  onSuccess: (pin: string) => Promise<void> | void;
  onCancel: () => void;
  title?: string;
  confirmTitle?: string;
  subtitle?: string;
  confirmSubtitle?: string;
  errorMessage?: string;
  lockoutRemainingMs?: number;
  expectedLength?: number;
  required?: boolean;
  cancellable?: boolean;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  mode,
  onSuccess,
  onCancel,
  title,
  confirmTitle,
  subtitle,
  confirmSubtitle,
  errorMessage,
  lockoutRemainingMs = 0,
  expectedLength = 6,
  required = false,
  cancellable = false,
}) => {
  const settingsCtx = useContext(SettingsContext);
  const isEn = settingsCtx?.resolvedLanguage === 'en';
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState(''); // For set/change confirmation
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [localError, setLocalError] = useState('');
  const targetLength = mode === 'unlock' ? Math.max(4, Math.min(16, expectedLength)) : 6;

  const handleClose = useCallback(() => {
    setPin('');
    setFirstPin('');
    setStep('enter');
    setLocalError('');
    onCancel();
  }, [onCancel]);

  // Lock background scrolling and handle Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (mode !== 'unlock' || cancellable) && !required) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, mode, required, cancellable, handleClose]);

  // Reset internal state when opened
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setFirstPin('');
      setStep('enter');
      setLocalError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = async (digit: string) => {
    if (lockoutRemainingMs > 0) return;
    if (pin.length >= targetLength) return;

    triggerHaptic();
    const nextPin = pin + digit;
    setPin(nextPin);
    setLocalError('');

    if (nextPin.length === targetLength) {
      if (mode === 'unlock') {
        onSuccess(nextPin);
        setPin('');
      } else if (mode === 'set' || mode === 'change') {
        if (step === 'enter') {
          setFirstPin(nextPin);
          setPin('');
          setStep('confirm');
        } else {
          // Confirm step
          if (nextPin === firstPin) {
            await onSuccess(nextPin);
            handleClose();
          } else {
            setLocalError(
              isEn ? 'PINs do not match. Please try again.' : 'PIN이 일치하지 않습니다. 다시 설정해 주세요.'
            );
            setPin('');
            setFirstPin('');
            setStep('enter');
          }
        }
      }
    }
  };

  const handleDelete = () => {
    triggerHaptic();
    setPin((prev) => prev.slice(0, -1));
    setLocalError('');
  };

  const displayTitle =
    mode === 'unlock'
      ? title || (isEn ? 'Enter PIN' : 'PIN 입력')
      : step === 'enter'
      ? title || (isEn ? `Enter New ${targetLength}-Digit PIN` : `새 ${targetLength}자리 PIN 입력`)
      : confirmTitle || (isEn ? 'Confirm PIN (Re-enter)' : 'PIN 확인 (한 번 더 입력)');

  const displaySubtitle =
    mode === 'unlock'
      ? subtitle ||
        (isEn
          ? 'Your records are encrypted and protected on-device'
          : '데이터를 안전하게 암호화하여 보호합니다')
      : step === 'enter'
      ? subtitle ||
        (isEn
          ? 'A 6-digit PIN is required to protect your health records'
          : '보안을 위해 6자리 숫자 PIN을 필수 적용합니다')
      : confirmSubtitle ||
        (isEn
          ? 'Re-enter your 6-digit PIN to confirm'
          : '설정한 6자리 PIN을 한 번 더 입력해 확인해 주세요');

  const errorText =
    localError ||
    errorMessage ||
    (lockoutRemainingMs > 0
      ? isEn
        ? `Too many attempts. Try again in ${Math.ceil(lockoutRemainingMs / 1000)}s.`
        : `입력 횟수 초과. ${Math.ceil(lockoutRemainingMs / 1000)}초 후 다시 시도해 주세요.`
      : '');

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 w-screen h-screen min-h-[100dvh] overflow-hidden select-none px-4 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]"
    >
      {(mode !== 'unlock' || cancellable) && !required && (
        <button
          type="button"
          onClick={handleClose}
          aria-label={isEn ? 'Close' : '닫기'}
          className="absolute top-[max(1.5rem,env(safe-area-inset-top,1.5rem))] right-[max(1.5rem,env(safe-area-inset-right,1.5rem))] p-2.5 rounded-full bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition-all z-10"
        >
          <X size={24} />
        </button>
      )}

      {/* Lock Icon & Title */}
      <div className="mb-6 text-center text-white">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-900 shadow-lg">
          <Lock size={30} className="text-emerald-400" />
        </div>
        <h2 id="pin-modal-title" className="text-xl font-bold tracking-wider">{displayTitle}</h2>
        <p className="mt-1 text-xs text-slate-400">{displaySubtitle}</p>
      </div>

      {/* Dots Indicator */}
      {targetLength <= 8 ? (
        <div className="mb-4 flex gap-3.5 sm:gap-4 justify-center">
          {Array.from({ length: targetLength }, (_, i) => (
            <div
              key={i}
              className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full transition-all duration-200 ${
                errorText
                  ? 'scale-110 bg-rose-500 border-2 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.9)]'
                  : pin.length > i
                  ? 'scale-110 bg-emerald-400 border-2 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                  : 'border-2 border-slate-700 bg-slate-900/80'
              }`}
            />
          ))}
        </div>
      ) : (
        <div className="mb-4 text-center">
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 font-mono text-base tracking-widest text-emerald-400">
            {pin.length > 0
              ? '•'.repeat(pin.length)
              : isEn
              ? `Enter ${targetLength}-digit PIN`
              : `${targetLength}자리 PIN 입력`}
          </div>
          <span className="mt-1 block text-[11px] font-mono text-slate-400">
            {isEn ? `${pin.length} / ${targetLength} digits` : `${pin.length} / ${targetLength}자리`}
          </span>
        </div>
      )}

      {/* Error Message */}
      <div className="mb-8 flex h-6 items-center justify-center text-xs font-bold text-rose-400">
        {errorText && (
          <div className="flex items-center gap-1.5 animate-in fade-in">
            <AlertCircle size={14} />
            {errorText}
          </div>
        )}
      </div>

      {/* Mobile Number Keypad */}
      <div
        role="group"
        aria-label={isEn ? 'PIN Keypad' : 'PIN 입력 키패드'}
        className="grid grid-cols-3 gap-y-4 gap-x-6 w-full max-w-[320px] sm:max-w-[340px] place-items-center text-white mb-6"
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            aria-label={isEn ? `Digit ${num}` : `숫자 ${num}`}
            disabled={lockoutRemainingMs > 0}
            onClick={() => handleDigit(num)}
            className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-slate-700 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
          >
            {num}
          </button>
        ))}

        <div className="h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px]" />

        <button
          type="button"
          aria-label={isEn ? 'Digit 0' : '숫자 0'}
          disabled={lockoutRemainingMs > 0}
          onClick={() => handleDigit('0')}
          className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-slate-700 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
        >
          0
        </button>

        <button
          type="button"
          aria-label={isEn ? 'Backspace' : '한 글자 지우기'}
          onClick={handleDelete}
          className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:text-slate-200 hover:bg-slate-900/60 active:scale-90 active:text-rose-400 active:bg-rose-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Delete size={28} />
        </button>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

