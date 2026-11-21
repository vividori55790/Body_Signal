import React, { useState, useEffect, useContext } from 'react';
import { Lock, Delete, AlertCircle, Fingerprint, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SettingsContext } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';
import BrandLogo from './BrandLogo';

export const LockScreen: React.FC = () => {
  const {
    unlockApp,
    unlockWithBiometric,
    isBiometricEnabled,
    isBiometricAvailable,
    pinLengthHint,
    isOsCredentialOnly,
    lockoutRemainingMs,
    pendingTwoFactor,
    verifyTwoFactorAndUnlock,
    cancelTwoFactor,
  } = useAuth();
  const settingsCtx = useContext(SettingsContext);
  const isEn = settingsCtx?.resolvedLanguage === 'en';
  const targetLength = Math.max(4, Math.min(16, pinLengthHint || 6));
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [totpInput, setTotpInput] = useState('');
  const [totpError, setTotpError] = useState('');

  // Auto-prompt biometrics once on mount if enabled & not locked out & not already awaiting 2FA
  useEffect(() => {
    let active = true;
    if (!pendingTwoFactor && isBiometricEnabled && isBiometricAvailable && lockoutRemainingMs === 0) {
      const timer = setTimeout(async () => {
        if (!active) return;
        await unlockWithBiometric();
      }, 200);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [pendingTwoFactor, isBiometricEnabled, isBiometricAvailable, lockoutRemainingMs, unlockWithBiometric]);

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    const res = await verifyTwoFactorAndUnlock(totpInput);
    if (!res.success) {
      setTotpError(
        res.message || (isEn ? 'Invalid 2FA or recovery code.' : '2단계 인증 코드가 올바르지 않습니다.')
      );
      return;
    }
    setTotpInput('');
    setTotpError('');
  };

  if (pendingTwoFactor) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/40 bg-slate-900 shadow-xl">
            <ShieldCheck size={38} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider">
              {isEn ? 'Two-Factor Authentication (2FA)' : '2단계 인증 (2FA)'}
            </h1>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              {isEn
                ? 'Enter the 6-digit code from your authenticator app (e.g., Aegis) or a one-time recovery code (XXXX-XXXX).'
                : '인증 앱(Aegis 등)의 6자리 코드 또는 일회용 복구 코드(`XXXX-XXXX`)를 입력하세요.'}
            </p>
          </div>

          <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
            <input
              type="text"
              autoFocus
              value={totpInput}
              onChange={(e) => {
                setTotpInput(e.target.value);
                setTotpError('');
              }}
              placeholder={isEn ? '6-digit or recovery code' : '6자리 코드 또는 복구 코드'}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-center font-mono text-lg font-bold tracking-widest text-white placeholder:text-slate-500 placeholder:text-xs placeholder:tracking-normal focus:border-emerald-400 focus:outline-none"
            />
            {totpError && (
              <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-rose-400">
                <AlertCircle size={14} /> {totpError}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg active:scale-95 transition-all"
            >
              {isEn ? 'Verify & Unlock' : '인증 완료 및 잠금 해제'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setTotpInput('');
              setTotpError('');
              setPin('');
              cancelTwoFactor();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
          >
            <ArrowLeft size={14} /> {isEn ? 'Back to primary unlock' : '첫 번째 인증으로 돌아가기'}
          </button>
        </div>
      </div>
    );
  }

  const handleDigit = async (digit: string) => {
    if (lockoutRemainingMs > 0) return;
    if (pin.length >= targetLength) return;

    triggerHaptic();
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg('');

    if (nextPin.length === targetLength) {
      const result = await unlockApp(nextPin);
      if (!result.success) {
        setErrorMsg(result.message || (isEn ? 'Incorrect PIN.' : 'PIN이 일치하지 않습니다.'));
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
      // Immediately clear stale digits and keep the app PIN keypad ready without blocking alerts
      setPin('');
      setErrorMsg('');
    }
  };

  const remainingSeconds = Math.ceil(lockoutRemainingMs / 1000);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 px-4 text-white">
      <div className="mb-10 text-center">
        <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-500/30 bg-slate-900/90 shadow-xl">
          <BrandLogo size={60} />
          <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-emerald-400 shadow">
            <Lock size={13} />
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-wider">BODY SIGNAL</h1>
        <p className="mt-1 text-xs text-slate-400">
          {isOsCredentialOnly
            ? isEn
              ? 'Use Biometrics / Device Lock or enter your 16-digit recovery PIN'
              : '생체인증·기기 잠금 또는 16자리 비상 복구 PIN을 입력하세요'
            : isBiometricEnabled && isBiometricAvailable
            ? isEn
              ? `Use biometrics or enter your ${targetLength}-digit PIN`
              : `생체인식 또는 ${targetLength}자리 PIN을 입력하세요`
            : isEn
            ? `Enter your ${targetLength}-digit PIN to unlock your records`
            : `안전한 데이터 접근을 위해 ${targetLength}자리 PIN을 입력하세요`}
        </p>
      </div>

      {/* PIN dots */}
      {targetLength <= 8 ? (
        <div className="mb-6 flex gap-3.5 sm:gap-4 justify-center">
          {Array.from({ length: targetLength }, (_, i) => (
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
      ) : (
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-2.5 font-mono text-lg tracking-widest text-emerald-400 min-w-[220px] text-center">
            {pin.length > 0 ? '•'.repeat(pin.length) : isEn ? 'Enter recovery PIN' : '비상 복구 PIN 입력'}
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {isEn ? `${pin.length} / ${targetLength} digits` : `${pin.length} / ${targetLength}자리`}
          </span>
        </div>
      )}

      {/* Error or Lockout notification */}
      <div className="mb-8 flex h-6 items-center justify-center text-xs font-bold text-rose-400">
        {lockoutRemainingMs > 0 ? (
          <span className="flex items-center gap-1.5">
            <AlertCircle size={14} />{' '}
            {isEn
              ? `Too many attempts. Try again in ${remainingSeconds}s.`
              : `너무 많은 시도. ${remainingSeconds}초 후 다시 시도해 주세요.`}
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
        aria-label={isEn ? 'PIN Keypad' : 'PIN 입력 키패드'}
        className="grid grid-cols-3 gap-y-4 gap-x-6 w-full max-w-[320px] sm:max-w-[340px] place-items-center mb-6"
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

        {/* Row 4 Column 1: Biometric button slot (F2 hook) or spacer */}
        {isBiometricEnabled && isBiometricAvailable ? (
          <button
            type="button"
            aria-label={isEn ? 'Unlock with Biometrics' : '생체인식 잠금 해제'}
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
          aria-label={isEn ? 'Digit 0' : '숫자 0'}
          disabled={lockoutRemainingMs > 0}
          onClick={() => handleDigit('0')}
          className="flex h-16 w-16 sm:h-20 sm:w-20 min-w-[64px] min-h-[64px] max-w-[80px] max-h-[80px] aspect-square items-center justify-center rounded-full bg-slate-900/90 border border-slate-800 text-2xl sm:text-3xl font-bold text-slate-100 shadow-lg transition-all duration-150 hover:bg-slate-800/80 hover:border-slate-700 active:scale-90 active:bg-emerald-500/25 active:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
        >
          0
        </button>

        {/* Row 4 Column 3: Delete / Backspace */}
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
};

export default LockScreen;

