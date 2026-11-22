import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Fingerprint, KeyRound, ShieldAlert, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { PinModal } from './PinModal';
import { triggerHaptic } from '../utils/native';

export interface DeleteAuthRequest {
  title: string;
  description: string;
  onAuthorized: () => Promise<void> | void;
}

export function useAuthorizedDelete() {
  const {
    isPinSet,
    isBiometricEnabled,
    pinLengthHint,
    lockoutRemainingMs,
    verifySensitiveActionPin,
    verifySensitiveActionBiometric,
  } = useAuth();
  const { resolvedLanguage } = useSettings();
  const isEn = resolvedLanguage === 'en';

  const [pendingRequest, setPendingRequest] = useState<DeleteAuthRequest | null>(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinError, setPinError] = useState('');
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const closeAll = () => {
    setPendingRequest(null);
    setShowPinPrompt(false);
    setPinError('');
    setAuthError('');
    setIsVerifying(false);
  };

  const requestAuthorizedDelete = (req: DeleteAuthRequest) => {
    triggerHaptic();
    setPinError('');
    setAuthError('');
    setShowPinPrompt(false);
    setPendingRequest(req);
  };

  const executeDeletion = async (req: DeleteAuthRequest) => {
    setIsVerifying(true);
    try {
      await req.onAuthorized();
      closeAll();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBiometricVerify = async () => {
    if (!pendingRequest) return;
    triggerHaptic();
    setAuthError('');
    setIsVerifying(true);
    const ok = await verifySensitiveActionBiometric();
    if (ok) {
      await executeDeletion(pendingRequest);
      return;
    }
    setIsVerifying(false);
    setPinError('');
    setAuthError(
      isEn
        ? 'Biometrics canceled or failed. Switched to App PIN verification.'
        : '생체인증이 취소되거나 실패하여 앱 PIN 입력으로 전환했습니다.'
    );
    setShowPinPrompt(true);
  };

  const handlePinVerify = async (pin: string) => {
    if (!pendingRequest) return;
    setPinError('');
    const res = await verifySensitiveActionPin(pin);
    if (res.success) {
      await executeDeletion(pendingRequest);
    } else {
      setPinError(
        res.message || (isEn ? 'Incorrect PIN.' : 'PIN이 일치하지 않습니다.')
      );
    }
  };

  const confirmDialog =
    pendingRequest && !showPinPrompt ? (
      <div
        role="dialog"
        aria-modal="true"
        onClick={closeAll}
        className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {pendingRequest.title}
                </h3>
                {isPinSet && (
                  <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                    {isEn ? 'Biometric or PIN required' : '삭제 전 본인 인증 필수'}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={closeAll}
              aria-label={isEn ? 'Close' : '닫기'}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {pendingRequest.description}
          </p>

          {authError && (
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl p-2.5">
              {authError}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {!isPinSet ? (
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => executeDeletion(pendingRequest)}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 size={15} /> {isEn ? 'Delete Permanently' : '영구 삭제'}
              </button>
            ) : isBiometricEnabled ? (
              <>
                <button
                  type="button"
                  disabled={isVerifying || lockoutRemainingMs > 0}
                  onClick={handleBiometricVerify}
                  className="w-full min-h-[44px] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Fingerprint size={16} />
                  {isEn ? 'Verify with Biometrics & Delete' : '지문/생체인증 후 삭제'}
                </button>
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => {
                    triggerHaptic();
                    setShowPinPrompt(true);
                  }}
                  className="w-full min-h-[42px] py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <KeyRound size={15} />
                  {isEn ? 'Verify with App PIN instead' : '앱 PIN 번호로 확인'}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => {
                  triggerHaptic();
                  setShowPinPrompt(true);
                }}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <KeyRound size={15} />
                {isEn ? 'Verify PIN & Delete' : '앱 PIN 확인 후 삭제'}
              </button>
            )}

            <button
              type="button"
              onClick={closeAll}
              className="w-full min-h-[40px] py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isEn ? 'Cancel' : '취소'}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const authModal = (
    <>
      {confirmDialog &&
        (typeof document !== 'undefined' ? createPortal(confirmDialog, document.body) : confirmDialog)}
      <PinModal
        isOpen={Boolean(pendingRequest && showPinPrompt)}
        mode="unlock"
        cancellable={true}
        expectedLength={pinLengthHint}
        title={isEn ? 'Verify PIN to Delete' : '삭제 본인 확인 (PIN)'}
        subtitle={
          authError ||
          pendingRequest?.description ||
          (isEn ? 'Enter your saved PIN to confirm deletion.' : '기록을 삭제하려면 저장된 PIN을 입력해 주세요.')
        }
        errorMessage={pinError}
        lockoutRemainingMs={lockoutRemainingMs}
        onSuccess={handlePinVerify}
        onCancel={closeAll}
      />
    </>
  );

  return { requestAuthorizedDelete, authModal };
}
