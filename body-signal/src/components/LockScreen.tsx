import React, { useState, useEffect } from 'react';
import { Lock, Delete, AlertCircle, Fingerprint } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerHaptic } from '../utils/native';

export const LockScreen: React.FC = () => {
  const {
    unlockApp,
    unlockWithBiometric,
    isBiometricEnabled,
    isBiometricAvailable,
    lockoutRemainingMs,
  } = useAuth();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-prompt biometrics once on mount if enabled & not locked out
  useEffect(() => {
    let active = true;
    if (isBiometricEnabled && isBiometricAvailable && lockoutRemainingMs === 0) {
      const timer = setTimeout(async () => {
        if (!active) return;
        await unlockWithBiometric();
      }, 200);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [isBiometricEnabled, isBiometricAvailable, lockoutRemainingMs, unlockWithBiometric]);

  const handleDigit = async (digit: string) => {
    if (lockoutRemainingMs > 0) return;
    if (pin.length >= 4) return;

    triggerHaptic();
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg('');

    if (nextPin.length === 4) {
      const result = await unlockApp(nextPin);
      if (!result.success) {
        setErrorMsg(result.message || 'PIN이 일치하지 않습니다.');
        setTimeout(() => setPin(''), 300);
      }
    }
  };

  const handleDelete = () => {
    triggerHaptic();
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleBiometricUnlock = async () => {
    if (lockoutRemainingMs > 0) return;
    triggerHaptic();
    const success = await unlockWithBiometric();
    if (!success) {
      // Smooth continuation with PIN pad, no disruption
    }
  };

  const remainingSeconds = Math.ceil(lockoutRemainingMs / 1000);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 px-4 text-white">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-slate-700 bg-slate-900 shadow-xl">
          <Lock size={36} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-wider">BODY SIGNAL</h1>
        <p className="mt-1 text-xs text-slate-400">
          {isBiometricEnabled && isBiometricAvailable ? '생체인식 또는 PIN을 입력하세요' : '안전한 데이터 접근을 위해 PIN을 입력하세요'}
        </p>
      </div>

      {/* PIN dots */}
      <div className="mb-6 flex gap-4 sm:gap-5 justify-center">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full transition-all duration-200 ${
              errorMsg || lockoutRemainingMs > 0
                ? 'scale-110 bg-rose-500 border-2 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.9)]'
                : pin.length > i
                ? 'scale-110 bg-emerald-400 border-2 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                : 'border-2 border-slate-700 bg-slate-900/80'
            }`}
          />
        ))}
      </div>

      {/* Error or Lockout notification */}
      <div className="mb-8 flex h-6 items-center justify-center text-xs font-bold text-rose-400">
        {lockoutRemainingMs > 0 ? (
          <span className="flex items-center gap-1.5">
            <AlertCircle size={14} /> 너무 많은 시도. {remainingSeconds}초 후 다시 시도해 주세요.
          </span>
        ) : (
          errorMsg && (
            <span className="flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle size={14} /> {errorMsg}
            </span>
          )
        )}
      </div>

      {/* Mobile Pad */}
      <div
        role="group"
        aria-label="PIN 입력 키패드"
        className="grid grid-cols-3 gap-y-4 gap-x-6 w-full max-w-[320px] sm:max-w-[340px] place-items-center mb-6"
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            aria-label={`숫자 ${num}`}
            disabled={lockoutRemainingMs > 0}
            onClick={() => handleDigit(num)}
            className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-slate-700 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
          >
            {num}
          </button>
        ))}

        {/* Row 4 Column 1: Biometric button slot (F2 hook) or spacer */}
        {isBiometricEnabled && isBiometricAvailable ? (
          <button
            type="button"
            aria-label="생체인식 잠금 해제"
            disabled={lockoutRemainingMs > 0}
            onClick={handleBiometricUnlock}
            className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 text-emerald-400 border border-slate-800 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-emerald-500/50 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Fingerprint size={28} />
          </button>
        ) : (
          <div className="h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px]" />
        )}

        {/* Row 4 Column 2: Digit 0 */}
        <button
          type="button"
          aria-label="숫자 0"
          disabled={lockoutRemainingMs > 0}
          onClick={() => handleDigit('0')}
          className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-slate-700 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
        >
          0
        </button>

        {/* Row 4 Column 3: Delete / Backspace */}
        <button
          type="button"
          aria-label="한 글자 지우기"
          onClick={handleDelete}
          className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:text-slate-200 hover:bg-slate-900/60 active:scale-90 active:text-rose-400 active:bg-rose-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Delete size={28} />
        </button>
      </div>
    </div>
  );
};

export default LockScreen;

