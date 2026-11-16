import React from 'react';
import BrandLogo from './BrandLogo';

interface BrandSplashProps {
  statusText?: string;
}

/**
 * Full-screen launch splash shown on app startup before LockScreen mounts.
 */
export const BrandSplash: React.FC<BrandSplashProps> = ({ statusText }) => {
  return (
    <div
      data-testid="brand-splash"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 px-6 text-white select-none"
    >
      <div className="relative flex flex-col items-center animate-in fade-in duration-300">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <div className="relative rounded-[28px] p-1 ring-1 ring-emerald-400/25 shadow-2xl shadow-emerald-950/60">
            <BrandLogo size={88} />
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-[0.18em] text-white">
          BIGNAL
        </h1>
        <p className="mt-1.5 text-xs font-medium tracking-wide text-emerald-300/90">
          BODY SIGNAL · 온디바이스 암호화 건강 기록
        </p>

        {statusText && (
          <p className="mt-6 text-[11px] font-semibold text-slate-400 animate-pulse">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
};

export default BrandSplash;
