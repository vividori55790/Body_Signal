import React, { useState } from 'react';
import { Lock, Delete, X, AlertCircle } from 'lucide-react';
import { triggerHaptic } from '../utils/native';

interface PinModalProps {
  isOpen: boolean;
  mode: 'unlock' | 'set' | 'change';
  onSuccess: (pin: string) => Promise<void> | void;
  onCancel: () => void;
  title?: string;
  errorMessage?: string;
  lockoutRemainingMs?: number;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  mode,
  onSuccess,
  onCancel,
  title,
  errorMessage,
  lockoutRemainingMs = 0,
}) => {
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState(''); // For set/change confirmation
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const handleDigit = async (digit: string) => {
    if (lockoutRemainingMs > 0) return;
    if (pin.length >= 4) return;

    triggerHaptic();
    const nextPin = pin + digit;
    setPin(nextPin);
    setLocalError('');

    if (nextPin.length === 4) {
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
            setLocalError('PIN이 일치하지 않습니다. 다시 설정해 주세요.');
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

  const handleClose = () => {
    setPin('');
    setFirstPin('');
    setStep('enter');
    setLocalError('');
    onCancel();
  };

  const displayTitle =
    title ||
    (mode === 'unlock'
      ? 'PIN 입력'
      : step === 'enter'
      ? '새 4자리 PIN 입력'
      : 'PIN 확인 (한 번 더 입력)');

  const errorText =
    localError ||
    errorMessage ||
    (lockoutRemainingMs > 0
      ? `입력 횟수 초과. ${Math.ceil(lockoutRemainingMs / 1000)}초 후 다시 시도해 주세요.`
      : '');

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md px-4 animate-in fade-in duration-200">
      {mode !== 'unlock' && (
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X size={24} />
        </button>
      )}

      {/* Lock Icon & Title */}
      <div className="mb-8 text-center text-white">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-900 shadow-lg">
          <Lock size={30} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold tracking-wider">{displayTitle}</h2>
        <p className="mt-1 text-xs text-slate-400">데이터를 안전하게 암호화하여 보호합니다</p>
      </div>

      {/* 4 Dots Indicator */}
      <div className="mb-4 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full transition-all duration-200 ${
              pin.length > i
                ? 'scale-110 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                : 'border border-slate-600 bg-slate-800'
            }`}
          />
        ))}
      </div>

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
      <div className="grid grid-cols-3 gap-4 max-w-[280px] w-full text-white">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            disabled={lockoutRemainingMs > 0}
            onClick={() => handleDigit(num)}
            className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-800/80 text-2xl font-bold shadow-sm transition-all hover:bg-slate-700 active:scale-90 active:bg-emerald-500/20 disabled:opacity-40"
          >
            {num}
          </button>
        ))}

        <div />

        <button
          type="button"
          disabled={lockoutRemainingMs > 0}
          onClick={() => handleDigit('0')}
          className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-800/80 text-2xl font-bold shadow-sm transition-all hover:bg-slate-700 active:scale-90 active:bg-emerald-500/20 disabled:opacity-40"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="flex h-18 w-18 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-800 hover:text-white active:scale-90"
        >
          <Delete size={26} />
        </button>
      </div>
    </div>
  );
};
