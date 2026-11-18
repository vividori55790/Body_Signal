import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ShieldCheck,
  FileText,
  HardDrive,
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Activity,
  Lock,
  Palette,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';
import BrandLogo, { LOGO_VARIANT_OPTIONS } from './BrandLogo';

interface DisclaimerModalProps {
  mode?: 'gate' | 'view';
  acceptedAt?: string;
  onAccept?: () => Promise<void> | void;
  onClose?: () => void;
}

interface FirstLaunchWelcomeProps {
  isEn: boolean;
  onToggleLang: () => void;
  onContinue: () => void;
}

const FirstLaunchWelcome: React.FC<FirstLaunchWelcomeProps> = ({
  isEn,
  onToggleLang,
  onContinue,
}) => {
  const { settings, setLogoVariant, setTheme } = useSettings();

  const pillars = [
    {
      icon: Lock,
      colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60',
      title: isEn ? '100% On-Device AES-256' : '100% 기기 내 AES-256 암호화',
      desc: isEn
        ? 'Zero cloud servers. Logs, photos, and PIN secrets stay encrypted only on your phone.'
        : '외부 서버 전송 없이 모든 통증·투약·진단서 기록이 내 기기에만 암호화 저장됩니다.',
    },
    {
      icon: Activity,
      colorClass: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60',
      title: isEn ? 'Visual Pain & Medication Timeline' : '통증·증상·투약 직관 타임라인',
      desc: isEn
        ? 'Log intensity, regions, triggers, and medications in seconds with trend charts.'
        : '통증 강도, 부위, 유발 요인, 복용 약을 빠르게 기록하고 추이를 한눈에 확인하세요.',
    },
    {
      icon: FileText,
      colorClass: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60',
      title: isEn ? 'Clinical Briefing & Claim Tracker' : '진료 브리핑 · 실손 기한 체크',
      desc: isEn
        ? 'Summarize doctor-visit notes cleanly and keep encrypted diagnostic receipts offline.'
        : '진료 전 핵심 경과를 정리하고 진단서 사진과 실손 청구 기한을 오프라인으로 관리하세요.',
    },
  ];

  return (
    <div
      data-testid="first-launch-welcome"
      className="fixed inset-0 z-[9998] flex flex-col bg-slate-50 dark:bg-[#030909] text-slate-800 dark:text-slate-100"
    >
      {/* Scrollable luxury showcase + personalization */}
      <div className="flex-1 overflow-y-auto">
        {/* Luxury Deep Obsidian-Emerald Hero Stage */}
        <div
          className="relative overflow-hidden px-5 pt-5 pb-7 text-white"
          style={{
            background:
              'radial-gradient(circle at 50% 34%, rgba(16, 185, 129, 0.22) 0%, rgba(6, 78, 59, 0.16) 42%, #020808 82%)',
          }}
        >
          {/* Ambient starlight accents */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl"
          />

          <div className="relative max-w-xl mx-auto">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-950/50 px-3 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur-sm">
                <Sparkles size={12} className="text-cyan-300" />
                {isEn ? 'Step 1 of 2 · Welcome' : '1 / 2 · 첫 시작 꾸미기'}
              </span>

              <button
                type="button"
                onClick={onToggleLang}
                className="px-3 py-1 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-200 transition-colors"
              >
                {isEn ? '한국어' : 'EN'}
              </button>
            </div>

            {/* Hero Floating Logo */}
            <div className="mt-5 flex flex-col items-center text-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute h-36 w-36 rounded-full bg-cyan-400/10 blur-2xl" />
                <div className="absolute h-28 w-28 rounded-full bg-emerald-500/20 blur-xl" />
                <BrandLogo size={116} showFrame={false} className="relative transition-all duration-300" />
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-[0.16em] text-white">
                BIGNAL
              </h1>
              <p className="mt-1.5 text-sm font-bold text-emerald-300/95">
                {isEn
                  ? 'Your Private Encrypted Health Signal Vault'
                  : '내 몸의 신호를 지키는 온디바이스 암호화 건강 금고'}
              </p>
              <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-slate-300/80">
                {isEn
                  ? 'Choose your preferred emblem & display look before reviewing the safety notice.'
                  : '시작 전 마음에 드는 브랜드 로고와 화면 스타일을 골라 나만의 Bignal을 완성해 보세요.'}
              </p>
            </div>
          </div>
        </div>

        {/* Customization & Value Cards */}
        <div className="px-5 py-5 space-y-4 max-w-xl w-full mx-auto">
          {/* Logo Variant Picker */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-900/90 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-teal-600 dark:text-emerald-400" />
                <h2 className="text-xs font-extrabold tracking-tight">
                  {isEn ? 'Choose Your Brand Emblem' : '대표 로고 스타일 선택'}
                </h2>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                {isEn ? 'Change anytime in Settings' : '설정에서 언제든 변경 가능'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {LOGO_VARIANT_OPTIONS.map((opt) => {
                const selected = settings.logoVariant === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`logo-option-${opt.id}`}
                    onClick={() => {
                      triggerHaptic();
                      setLogoVariant(opt.id);
                    }}
                    className={`group relative flex flex-col items-center rounded-xl border p-2.5 text-center transition-all ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/35 ring-2 ring-emerald-500/25 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <BrandLogo
                      variant={opt.id}
                      size={44}
                      showFrame={true}
                      className="transition-transform group-hover:scale-105"
                    />
                    <span className="mt-2 text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                      {isEn ? opt.labelEn : opt.labelKo}
                    </span>
                    <span className="mt-0.5 text-[9px] leading-tight text-slate-500 dark:text-slate-400 line-clamp-2">
                      {isEn ? opt.descEn : opt.descKo}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Theme Quick Selector */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-900/90 px-4 py-3 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Palette size={15} className="text-teal-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-extrabold">
                {isEn ? 'Display Theme' : '화면 테마'}
              </span>
            </div>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-[11px]">
              {(
                [
                  { id: 'system', ko: '시스템', en: 'System' },
                  { id: 'dark', ko: '다크', en: 'Dark' },
                  { id: 'light', ko: '라이트', en: 'Light' },
                ] as const
              ).map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setTheme(th.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                    settings.theme === th.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isEn ? th.en : th.ko}
                </button>
              ))}
            </div>
          </section>

          {/* Core Pillars */}
          <section className="space-y-2">
            {pillars.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 p-3.5"
                >
                  <div className={`p-2 rounded-xl shrink-0 ${item.colorClass}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>

      {/* Bottom Next CTA */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
        <div className="max-w-xl mx-auto">
          <button
            type="button"
            data-testid="first-launch-next"
            onClick={() => {
              triggerHaptic();
              onContinue();
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-sm shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <span>
              {isEn ? 'Next: Review Safety Notice & Start' : '다음: 안전 고지 확인 후 시작하기'}
            </span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({
  mode = 'gate',
  acceptedAt,
  onAccept,
  onClose,
}) => {
  const { settings, setLanguage } = useSettings();
  const [step, setStep] = useState<'welcome' | 'terms'>(mode === 'gate' ? 'welcome' : 'terms');
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

  if (mode === 'gate' && step === 'welcome') {
    return (
      <FirstLaunchWelcome
        isEn={isEn}
        onToggleLang={() => setLanguage(isEn ? 'ko' : 'en')}
        onContinue={() => setStep('terms')}
      />
    );
  }

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
          {mode === 'gate' && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setStep('welcome');
              }}
              className="p-1.5 -ml-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
              aria-label={isEn ? 'Back to welcome setup' : '이전 꾸미기 화면으로'}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <BrandLogo size={36} />
          <div>
            <h1 className="text-base font-black tracking-tight">
              {isEn ? 'Disclaimer & Terms of Use' : '면책조항 및 이용 안내'}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {mode === 'gate'
                ? isEn
                  ? 'Step 2 of 2 · Required before first use'
                  : '2 / 2 · 최초 사용 전 필수 확인 사항'
                : isEn
                ? 'Required before first use'
                : '최초 사용 전 필수 확인 사항'}
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
