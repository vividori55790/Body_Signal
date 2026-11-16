import React, { useId } from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
  showFrame?: boolean;
}

/**
 * Bignal (Body Signal) signature emblem:
 * protective medical shield paired with a vital ECG pulse wave.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 64,
  className = '',
  showFrame = true,
}) => {
  const uid = useId().replace(/:/g, '');
  const bgGradId = `bignal-bg-${uid}`;
  const shieldGradId = `bignal-shield-${uid}`;
  const glowId = `bignal-glow-${uid}`;

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
