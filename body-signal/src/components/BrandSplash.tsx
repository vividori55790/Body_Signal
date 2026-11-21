import React, { useContext } from 'react';
import BrandLogo from './BrandLogo';
import { SettingsContext } from '../context/SettingsContext';

interface BrandSplashProps {
  statusText?: string;
}

/**
 * Full-screen launch splash shown on app startup before LockScreen mounts.
 */
export const BrandSplash: React.FC<BrandSplashProps> = ({ statusText }) => {
  const settingsCtx = useContext(SettingsContext);
  const isEn = settingsCtx?.resolvedLanguage === 'en';
  return (
    <div
      data-testid="brand-splash"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#020707] px-6 text-white select-none overflow-hidden"
    >
      {/* Ambient forest-emerald studio glow matching the 3D crystal cube */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(16, 185, 129, 0.16) 0%, rgba(6, 78, 59, 0.10) 32%, rgba(2, 7, 7, 0.96) 70%)',
        }}
      />

      <div className="relative flex flex-col items-center animate-in fade-in duration-300">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-36 w-36 rounded-full bg-cyan-400/10 blur-2xl animate-pulse" />
          <div className="absolute h-28 w-28 rounded-full bg-emerald-500/20 blur-xl" />
          <div className="relative p-1">
            <BrandLogo size={108} showFrame={false} />
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-[0.22em] text-white">
          BIGNAL
        </h1>
        <p className="mt-1.5 text-xs font-medium tracking-wide text-emerald-300/90">
          {isEn
            ? 'BODY SIGNAL · On-Device Encrypted Health Vault'
            : 'BODY SIGNAL · 온디바이스 암호화 건강 기록'}
        </p>

        {/* Subtle ECG pulse accent bar */}
        <div className="mt-5 flex items-center gap-2 opacity-75">
          <span className="h-[1px] w-8 bg-gradient-to-r from-transparent to-cyan-400/60" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
          <span className="h-[1px] w-8 bg-gradient-to-l from-transparent to-emerald-400/60" />
        </div>

        {statusText && (
          <p className="mt-4 text-[11px] font-semibold text-slate-400 animate-pulse">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
};

export default BrandSplash;
