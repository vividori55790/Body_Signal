import React, { useState } from 'react';
import { Lock, Delete, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerHaptic } from '../utils/native';

export const LockScreen: React.FC = () => {
  const { unlockApp, lockoutRemainingMs } = useAuth();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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

  const remainingSeconds = Math.ceil(lockoutRemainingMs / 1000);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 px-4 text-white">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-slate-700 bg-slate-900 shadow-xl">
          <Lock size={36} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-wider">BODY SIGNAL</h1>
        <p className="mt-1 text-xs text-slate-400">안전한 데이터 접근을 위해 PIN을 입력하세요</p>
      </div>

      {/* PIN dots */}
      <div className="mb-6 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full transition-all duration-200 ${
              pin.length > i
                ? 'scale-110 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                : 'border border-slate-700 bg-slate-800'
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
      <div className="grid grid-cols-3 gap-4 max-w-[280px] w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            disabled={lockoutRemainingMs > 0}
            onClick={() => handleDigit(num)}
            className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-900/90 text-2xl font-bold border border-slate-800 shadow-md transition-all active:scale-90 active:bg-slate-700 disabled:opacity-30"
          >
            {num}
          </button>
        ))}

        <div />

        <button
          type="button"
          disabled={lockoutRemainingMs > 0}
          onClick={() => handleDigit('0')}
          className="flex h-18 w-18 items-center justify-center rounded-full bg-slate-900/90 text-2xl font-bold border border-slate-800 shadow-md transition-all active:scale-90 active:bg-slate-700 disabled:opacity-30"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="flex h-18 w-18 items-center justify-center rounded-full text-slate-400 transition-all hover:text-white active:scale-90"
        >
          <Delete size={28} />
        </button>
      </div>
    </div>
  );
};

export default LockScreen;
