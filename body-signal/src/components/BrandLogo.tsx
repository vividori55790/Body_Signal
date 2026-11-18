import React, { useContext } from 'react';
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
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 64,
  className = '',
  showFrame = true,
  variant,
}) => {
  const settingsCtx = useContext(SettingsContext);
  const candidate = variant ?? settingsCtx?.settings.logoVariant;
  const resolvedVariant: LogoVariant = candidate === 'cube-2d' ? 'cube-2d' : 'cube-3d';
  const isEn = settingsCtx?.settings.language === 'en';

  const src = resolvedVariant === 'cube-3d' ? bignalCube3d : bignalCube2d;
  const alt =
    resolvedVariant === 'cube-3d'
      ? isEn
        ? 'Bignal 3D glass cube logo'
        : 'Bignal 3D 글래스 큐브 로고'
      : isEn
      ? 'Bignal 2D mint cube logo'
      : 'Bignal 2D 민트 큐브 로고';
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
};

export default BrandLogo;
