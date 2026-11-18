import React, { useContext, useId } from 'react';
import bignalCube3d from '../assets/bignal-cube-3d.png';
import bignalCube2d from '../assets/Group 1.svg';
import { SettingsContext } from '../context/SettingsContext';
import type { LogoVariant } from '../types/health';

export interface LogoVariantOption {
  id: LogoVariant;
  labelKo: string;
  labelEn: string;
  descKo: string;
  descEn: string;
}

export const LOGO_VARIANT_OPTIONS: readonly LogoVariantOption[] = [
  {
    id: 'cube-3d',
    labelKo: '3D 글래스',
    labelEn: '3D Glass',
    descKo: '입체 프로스트 크리스탈 큐브',
    descEn: 'Frosted 3D crystal cube',
  },
  {
    id: 'cube-2d',
    labelKo: '2D 민트',
    labelEn: '2D Mint',
    descKo: '네온 라인 아이소메트릭 큐브',
    descEn: 'Crisp neon isometric vector',
  },
  {
    id: 'shield',
    labelKo: '실드 엠블럼',
    labelEn: 'Shield',
    descKo: '클래식 메디컬 보안 방패',
    descEn: 'Classic medical vault shield',
  },
];

interface BrandLogoProps {
  size?: number;
  className?: string;
  showFrame?: boolean;
  variant?: LogoVariant;
}

/**
 * Bignal (Body Signal) signature emblem supporting user-selected variants:
 * - 'cube-3d': Blender-rendered luxury frosted glass cube with glowing cyan/emerald ECG
 * - 'cube-2d': Clean isometric neon cyan-mint SVG cube (Group 1.svg)
 * - 'shield': Protective medical shield vector paired with an ECG pulse wave
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 64,
  className = '',
  showFrame = true,
  variant,
}) => {
  const settingsCtx = useContext(SettingsContext);
  const resolvedVariant: LogoVariant = variant ?? settingsCtx?.settings.logoVariant ?? 'cube-3d';

  const uid = useId().replace(/:/g, '');
  const bgGradId = `bignal-bg-${uid}`;
  const shieldGradId = `bignal-shield-${uid}`;
  const glowId = `bignal-glow-${uid}`;

  if (resolvedVariant === 'cube-3d' || resolvedVariant === 'cube-2d') {
    const src = resolvedVariant === 'cube-3d' ? bignalCube3d : bignalCube2d;
    const alt = resolvedVariant === 'cube-3d' ? 'Bignal 3D 글래스 큐브 로고' : 'Bignal 2D 민트 큐브 로고';
    const radius = Math.max(8, Math.round(size * 0.24));
    const pad = showFrame ? Math.max(4, Math.round(size * 0.11)) : 0;

    if (showFrame) {
      return (
        <div
          className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-emerald-400/25 shadow-sm ${className}`}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            padding: pad,
            background: 'radial-gradient(circle at 50% 38%, #072924 0%, #031110 72%, #020808 100%)',
          }}
          role="img"
          aria-label={alt}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="h-full w-full object-contain select-none"
          />
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        style={{ width: size, height: size }}
        className={`inline-block shrink-0 object-contain select-none drop-shadow-[0_10px_24px_rgba(16,185,129,0.28)] ${className}`}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Bignal 로고"
    >
      <defs>
        <linearGradient id={bgGradId} x1="12" y1="8" x2="108" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="55%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id={shieldGradId} x1="60" y1="22" x2="60" y2="98" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.06" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#022c22" floodOpacity="0.35" />
        </filter>
      </defs>

      {showFrame && (
        <rect
          x="6"
          y="6"
          width="108"
          height="108"
          rx="28"
          fill={`url(#${bgGradId})`}
        />
      )}

      {/* Subtle protective shield contour */}
      <path
        d="M60 22L89 32.5V56.5C89 75.5 76.6 90.4 60 98C43.4 90.4 31 75.5 31 56.5V32.5L60 22Z"
        fill={`url(#${shieldGradId})`}
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Vital ECG heartbeat pulse */}
      <path
        d="M22 61H40L47.5 41L56.5 79L65.5 36L74 71L80.5 61H98"
        stroke="#ffffff"
        strokeWidth="6.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
      />

      {/* Active signal node */}
      <circle cx="65.5" cy="36" r="3.6" fill="#a7f3d0" />
    </svg>
  );
};

export default BrandLogo;
