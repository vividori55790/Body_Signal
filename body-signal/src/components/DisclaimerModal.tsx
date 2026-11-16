import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ShieldCheck, FileText, HardDrive, X, Check } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';
import BrandLogo from './BrandLogo';

interface DisclaimerModalProps {
  mode?: 'gate' | 'view';
  acceptedAt?: string;
  onAccept?: () => Promise<void> | void;
  onClose?: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({
  mode = 'gate',
  acceptedAt,
  onAccept,
  onClose,
}) => {
  const { settings, setLanguage } = useSettings();
  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEn = settings.language === 'en';

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleConfirm = async () => {
    if (!checked || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAccept?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = acceptedAt
    ? new Date(acceptedAt).toLocaleString(isEn ? 'en-US' : 'ko-KR')
    : null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Medical & Privacy Disclaimer' : '면책조항 및 이용 안내'}
      className="fixed inset-0 z-[9998] flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <BrandLogo size={36} />
          <div>
            <h1 className="text-base font-black tracking-tight">
              {isEn ? 'Disclaimer & Terms of Use' : '면책조항 및 이용 안내'}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isEn ? 'Required before first use' : '최초 사용 전 필수 확인 사항'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(isEn ? 'ko' : 'en')}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300"
          >
            {isEn ? '한국어' : 'EN'}
          </button>
          {mode === 'view' && onClose && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                onClose();
              }}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Legal & Safety Terms */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 max-w-xl w-full mx-auto">
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-amber-800 dark:text-amber-300">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              {isEn
                ? '1. Not Medical Advice or Diagnosis'
                : '1. 의료 행위 및 의학적 진단 대체 불가'}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {isEn
              ? 'Body Signal (Bignal) is a personal health-logging and consultation-aid tool. Recorded pain trends, department groupings, summaries, and optional local AI outputs do not constitute medical diagnosis, prescriptions, or treatment decisions.'
              : 'Body Signal(Bignal)은 개인 건강 기록 및 진료 보조 도구입니다. 앱에 표시되는 통증 추이, 진료과 분류, 요약 리포트 및 실험실 로컬 AI 출력은 의학적 진단·처방·치료 결정을 대체할 수 없습니다.'}
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-rose-800 dark:text-rose-300">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              {isEn ? '2. Emergency Situations' : '2. 응급 상황 대처'}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {isEn
              ? 'Do not rely on this app during medical emergencies (severe chest pain, paralysis, breathing difficulty, high fever, or loss of consciousness). Seek immediate emergency care or call local emergency services.'
              : '극심한 흉통, 감각·운동 마비, 호흡곤란, 의식 저하 등 응급 징후가 발생할 경우 앱 기록에 의존하지 말고 즉시 119 또는 가까운 응급 의료기관을 방문하세요.'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-teal-700 dark:text-teal-400">
            <HardDrive size={16} className="shrink-0" />
            <span>
              {isEn
                ? '3. On-Device Storage & User Backup Responsibility'
                : '3. 100% 기기 내 저장 및 백업 관리 책임'}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {isEn
              ? 'All logs, PIN/TOTP secrets, and diagnostic photos stay strictly on your device with AES-256 encryption and zero cloud servers. If the app is uninstalled, the device is lost, or your PIN/2FA recovery codes are forgotten, the developer cannot recover your data. Maintain encrypted backups regularly.'
              : '모든 통증 기록, 진단서·영수증 사진, PIN·2FA 정보는 외부 서버 전송 없이 기기 내부에만 암호화 저장됩니다. 앱 삭제, 기기 분실, PIN 또는 TOTP 복구 코드 분실 시 개발자도 데이터를 복구할 수 없으므로 암호화 백업을 직접 보관하셔야 합니다.'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200">
            <FileText size={16} className="shrink-0 text-indigo-500" />
            <span>
              {isEn
                ? '4. Claim Deadlines & Warranty Disclaimer (GPL-3.0)'
                : '4. 실손보험 기한 안내 및 무보증 고지 (GPL-3.0)'}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {isEn
              ? 'Indemnity claim deadline calculations are general informational estimates and vary by policy terms and insurer review. This open-source software (GPL-3.0-only) is provided "AS IS" without warranty of any kind.'
              : '실손보험 청구 기한 안내는 일반적인 참고 기준이며 실제 보상 여부와 기한은 가입 약관 및 보험사 심사에 따릅니다. 본 오픈소스 소프트웨어(GPL-3.0-only)는 법률이 허용하는 범위 내에서 명시적·묵시적 보증 없이 현 상태 그대로 제공됩니다.'}
          </p>
        </div>

        {mode === 'view' && formattedDate && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 px-3.5 py-2.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck size={15} className="shrink-0" />
            <span>
              {isEn ? `Accepted on: ${formattedDate}` : `동의 완료 일시: ${formattedDate}`}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Agreement Footer */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
        <div className="max-w-xl mx-auto space-y-3">
          {mode === 'gate' ? (
            <>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    triggerHaptic();
                    setChecked(e.target.checked);
                  }}
                  className="mt-0.5 h-5 w-5 accent-teal-600 rounded shrink-0 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                  {isEn
                    ? 'I have read and agree to the medical disclaimer, local data responsibility, and terms of use above.'
                    : '위 의료 면책조항, 기기 내 데이터/백업 관리 책임 및 이용 안내를 모두 읽고 동의합니다.'}
                </span>
              </label>

              <button
                type="button"
                disabled={!checked || isSubmitting}
                onClick={handleConfirm}
                className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold text-sm shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Check size={16} />
                {isEn ? 'Agree and Start Bignal' : '동의하고 Bignal 시작하기'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                onClose?.();
              }}
              className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs"
            >
              {isEn ? 'Close' : '닫기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (mode === 'view' && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
};

export default DisclaimerModal;
