import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Lock, Award, HeartPulse, Info, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { triggerHaptic } from '../utils/native';
import { SettingsContext } from '../context/SettingsContext';

export const TrustBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const settingsCtx = useContext(SettingsContext);
  const isEn = settingsCtx?.resolvedLanguage === 'en';
  const [isOpen, setIsOpen] = useState(false);

  // Lock background document scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);

  const handleOpen = () => {
    triggerHaptic();
    setIsOpen(true);
  };

  const handleClose = () => {
    triggerHaptic();
    setIsOpen(false);
  };

  const modalContent = isOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Security & Clinical Standards' : '보안 및 의학 표준 검증 안내'}
      onClick={handleClose}
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm touch-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-3.5 max-h-[85vh] overflow-y-auto touch-pan-y"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {isEn ? 'On-Device Security · Clinical Standards' : '온디바이스 보안 · 의학 표준'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {isEn ? 'Encrypted locally with zero cloud uploads' : '외부 전송 없는 로컬 암호화 기록'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={isEn ? 'Close' : '닫기'}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Concise Trust Pillars */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <Lock size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200">AES-GCM 256 · AndroidKeyStore</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isEn
                  ? 'Stored encrypted on-device without accounts or cloud, verified via SHA-256 integrity signatures.'
                  : '계정·클라우드 없이 기기 내부에만 암호화 저장되며 SHA-256 서명으로 변조를 검증합니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <Award size={16} className="text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200">
                {isEn ? 'NRS · PQRST Clinical Scales' : 'NRS · PQRST 의학 척도'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isEn
                  ? 'Structures pain intensity (1–10), triggers, quality, radiation, and timing for doctor visits.'
                  : '통증 강도(1~10)와 유발·양상·방사통·시간대 원칙으로 진료 브리핑을 정리합니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <HeartPulse size={16} className="text-slate-600 dark:text-slate-300 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200">
                {isEn ? '30-Sec Doctor Briefing · EMR Copy' : '진료실 30초 요약 · EMR 복사'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isEn
                  ? 'Review progress and medication responses by department and copy in one tap.'
                  : '진료과별 경과 및 약물 반응을 30초 요약으로 확인하고 복사할 수 있습니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <CheckCircle2 size={16} className="text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200">
                {isEn ? 'Screen Capture & Assist Blocked' : '화면 캡처 · AI 공유 차단'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isEn
                  ? 'FLAG_SECURE and assistant screen-context blocking prevent accidental exposure.'
                  : 'FLAG_SECURE 및 어시스턴트 컨텍스트 차단이 적용되어 민감 정보가 노출되지 않습니다.'}
              </p>
            </div>
          </div>
        </div>

        {/* Medical Disclaimer */}
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <span>
            {isEn
              ? 'This app is a personal logging aid and does not replace medical diagnosis. Seek emergency care for urgent symptoms.'
              : '본 앱은 자가 기록 및 진료 보조 도구이며 의학적 진단을 대체하지 않습니다. 응급 증상 시 즉시 병원을 방문하세요.'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="w-full py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-sm active:scale-98 transition-all"
        >
          {isEn ? 'OK' : '확인'}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 rounded-full border transition-all active:scale-95 ${
          compact
            ? 'px-2.5 py-1 text-[10px] font-bold bg-teal-50/80 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/60 text-teal-700 dark:text-teal-300'
            : 'w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:border-teal-500'
        }`}
      >
        <ShieldCheck size={compact ? 12 : 14} className="text-teal-600 dark:text-teal-400 shrink-0" />
        <span className="truncate">
          {compact
            ? isEn
              ? 'Local Encrypted · Clinical Standards'
              : '로컬 암호화 · 의학 표준'
            : isEn
            ? 'Verified Trust: Local Encrypted · Clinical Standards'
            : '안심 신뢰 검증: 로컬 암호화 · 의학 표준'}
        </span>
        <Info size={compact ? 11 : 13} className="text-slate-400 ml-auto shrink-0" />
      </button>

      {modalContent && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent}
    </>
  );
};

export default TrustBadge;
