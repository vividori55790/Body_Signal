import React, { useState } from 'react';
import { ShieldCheck, Lock, Award, HeartPulse, Info, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { triggerHaptic } from '../utils/native';

export const TrustBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    triggerHaptic();
    setIsOpen(true);
  };

  const handleClose = () => {
    triggerHaptic();
    setIsOpen(false);
  };

  return (
    <>
      {/* Badge Button */}
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 rounded-full border transition-all active:scale-95 ${
          compact
            ? 'px-2.5 py-1 text-[10px] font-bold bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
            : 'w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:border-emerald-400'
        }`}
      >
        <ShieldCheck size={compact ? 12 : 15} className="text-emerald-500 shrink-0" />
        <span className="truncate">
          {compact ? '100% 온디바이스 암호화 • 의료 표준' : '안심 신뢰 검증: 100% 오프라인 암호화 및 NRS 의학 표준'}
        </span>
        <Info size={compact ? 11 : 13} className="text-slate-400 ml-auto shrink-0" />
      </button>

      {/* Trust & Clinical Assurance Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Bignal 의료 신뢰 보증</h3>
                  <p className="text-[10px] text-slate-400">환자와 의료진을 위한 4대 신뢰 원칙</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Trust Pillars */}
            <div className="space-y-3 text-xs">
              {/* Pillar 1: Zero Cloud Leakage */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <Lock size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">100% 온디바이스 암호화 저장</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    회원가입도, 외부 클라우드 전송도 없습니다. 환자의 모든 통증 및 투약 기록은 본인 스마트폰 내부 IndexedDB에 군사 표준 <strong>AES-GCM 256비트</strong>로 암호화되어 안전하게 보관됩니다.
                  </p>
                </div>
              </div>

              {/* Pillar 2: Medical Grounding */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <Award size={18} className="text-blue-500 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">국제 표준 의학 척도 (NRS & PQRST)</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    임의의 수치가 아닌 세계보건기구(WHO) 및 대한통증학회 공인 <strong>NRS(숫자통증등급 0~10)</strong> 척도와 세계 의학 표준인 <strong>PQRST 문진 원칙</strong>(유발, 양상, 방사통, 강도, 시간)에 기초합니다.
                  </p>
                </div>
              </div>

              {/* Pillar 3: Doctor & Nurse Friendly */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <HeartPulse size={18} className="text-rose-500 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">병원 전자의무기록(EMR) 즉시 연동</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    진료실에서 의사·간호사가 30초 안에 상태를 파악할 수 있도록 표준 의무기록(EMR) 형식 및 SOAP Note 요약을 제공하여 진료의 정확도를 대폭 향상시킵니다.
                  </p>
                </div>
              </div>

              {/* Pillar 4: Local AI Zero-Leakage */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <CheckCircle2 size={18} className="text-purple-500 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">오프라인 로컬 LLM 프라이빗 AI</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    AI 분석 기능 사용 시에도 외부 빅테크 서버가 아닌 내 PC 또는 기기 내 로컬 LLM(Ollama 등)과만 통신하므로 완벽한 프라이버시가 유지됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* Medical Disclaimer */}
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <span>
                <strong>의료 안전 안내:</strong> 본 앱은 환자의 증상 자가 관찰 및 진료 보조 도구이며, 의사의 전문적인 의학적 진단을 대신하지 않습니다. 급성 마비나 고열 등 응급 증상 발생 시 즉시 의료기관을 방문하세요.
              </span>
            </div>

            {/* Confirm Button */}
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md active:scale-98 transition-all"
            >
              확인하였습니다
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TrustBadge;
