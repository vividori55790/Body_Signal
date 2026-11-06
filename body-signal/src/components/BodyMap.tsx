import React, { useState } from 'react';
import { triggerHaptic } from '../utils/native';

interface BodyMapProps {
  selectedPart?: string;
  onSelectPart?: (partLabel: string) => void;
  intensityMap?: Record<string, number>;
  readOnly?: boolean;
}

interface AnatomicalRegion {
  id: string;
  name: string;
  category: string;
  d: string;
  center: { x: number; y: number };
}

// Front View Regions (Clean, anatomical proportions, 220x460 viewBox)
const FRONT_REGIONS: AnatomicalRegion[] = [
  {
    id: 'front-head',
    name: '머리/안면',
    category: '머리',
    d: 'M110 32 C125 32 136 44 136 62 C136 82 124 96 110 98 C96 96 84 82 84 62 C84 44 95 32 110 32 Z',
    center: { x: 110, y: 65 },
  },
  {
    id: 'front-neck',
    name: '목(앞)',
    category: '목',
    d: 'M100 98 L120 98 L124 116 L96 116 Z',
    center: { x: 110, y: 107 },
  },
  {
    id: 'front-shoulder-l',
    name: '왼쪽 어깨',
    category: '어깨',
    d: 'M70 118 C80 115 95 116 96 116 L92 144 L66 148 C64 134 65 124 70 118 Z',
    center: { x: 80, y: 130 },
  },
  {
    id: 'front-shoulder-r',
    name: '오른쪽 어깨',
    category: '어깨',
    d: 'M150 118 C140 115 125 116 124 116 L128 144 L154 148 C156 134 155 124 150 118 Z',
    center: { x: 140, y: 130 },
  },
  {
    id: 'front-chest',
    name: '가슴/흉부',
    category: '가슴',
    d: 'M96 116 L124 116 L128 162 C122 165 110 166 110 166 C110 166 98 165 92 162 Z',
    center: { x: 110, y: 140 },
  },
  {
    id: 'front-abdomen',
    name: '복부/위장',
    category: '복부',
    d: 'M92 162 C98 165 110 166 110 166 C110 166 122 165 128 162 L131 208 C124 212 110 214 110 214 C110 214 96 212 89 208 Z',
    center: { x: 110, y: 186 },
  },
  {
    id: 'front-pelvis',
    name: '골반/하복부',
    category: '골반',
    d: 'M89 208 C96 212 110 214 110 214 C110 214 124 212 131 208 L136 242 L84 242 Z',
    center: { x: 110, y: 226 },
  },
  {
    id: 'front-arm-l',
    name: '왼쪽 팔',
    category: '팔',
    d: 'M66 148 L92 144 L87 212 L61 216 Z',
    center: { x: 74, y: 180 },
  },
  {
    id: 'front-arm-r',
    name: '오른쪽 팔',
    category: '팔',
    d: 'M154 148 L128 144 L133 212 L159 216 Z',
    center: { x: 146, y: 180 },
  },
  {
    id: 'front-hand-l',
    name: '왼쪽 손목/손',
    category: '손',
    d: 'M61 216 L87 212 L83 268 C76 274 65 272 58 266 Z',
    center: { x: 70, y: 242 },
  },
  {
    id: 'front-hand-r',
    name: '오른쪽 손목/손',
    category: '손',
    d: 'M159 216 L133 212 L137 268 C144 274 155 272 162 266 Z',
    center: { x: 150, y: 242 },
  },
  {
    id: 'front-thigh-l',
    name: '왼쪽 허벅지',
    category: '허벅지',
    d: 'M84 242 L108 242 L105 326 L81 326 C78 296 79 268 84 242 Z',
    center: { x: 94, y: 284 },
  },
  {
    id: 'front-thigh-r',
    name: '오른쪽 허벅지',
    category: '허벅지',
    d: 'M112 242 L136 242 C141 268 142 296 139 326 L115 326 Z',
    center: { x: 126, y: 284 },
  },
  {
    id: 'front-knee-l',
    name: '왼쪽 무릎',
    category: '무릎',
    d: 'M81 326 L105 326 L103 354 L79 354 Z',
    center: { x: 92, y: 340 },
  },
  {
    id: 'front-knee-r',
    name: '오른쪽 무릎',
    category: '무릎',
    d: 'M115 326 L139 326 L141 354 L117 354 Z',
    center: { x: 128, y: 340 },
  },
  {
    id: 'front-leg-l',
    name: '왼쪽 종아리/발',
    category: '종아리',
    d: 'M79 354 L103 354 L99 428 C92 434 80 434 74 426 Z',
    center: { x: 88, y: 394 },
  },
  {
    id: 'front-leg-r',
    name: '오른쪽 종아리/발',
    category: '종아리',
    d: 'M117 354 L141 354 L146 426 C140 434 128 434 121 428 Z',
    center: { x: 132, y: 394 },
  },
];

// Back View Regions (Posterior)
const BACK_REGIONS: AnatomicalRegion[] = [
  {
    id: 'back-head',
    name: '후두부/머리뒤',
    category: '머리',
    d: 'M110 32 C125 32 136 44 136 62 C136 82 124 96 110 98 C96 96 84 82 84 62 C84 44 95 32 110 32 Z',
    center: { x: 110, y: 65 },
  },
  {
    id: 'back-neck',
    name: '목덜미/경추',
    category: '목',
    d: 'M98 98 L122 98 L126 120 L94 120 Z',
    center: { x: 110, y: 109 },
  },
  {
    id: 'back-upper-back',
    name: '등/견갑골(상배부)',
    category: '등',
    d: 'M72 120 C85 117 135 117 148 120 L144 174 L76 174 Z',
    center: { x: 110, y: 147 },
  },
  {
    id: 'back-lower-back',
    name: '허리(요추)',
    category: '허리',
    d: 'M76 174 L144 174 L138 214 L82 214 Z',
    center: { x: 110, y: 194 },
  },
  {
    id: 'back-glutes',
    name: '골반/둔부(엉덩이)',
    category: '골반',
    d: 'M82 214 L138 214 L134 250 C122 254 98 254 86 250 Z',
    center: { x: 110, y: 232 },
  },
  {
    id: 'back-arm-l',
    name: '왼쪽 팔(뒤)',
    category: '팔',
    d: 'M72 120 L58 178 L76 174 Z',
    center: { x: 68, y: 150 },
  },
  {
    id: 'back-arm-r',
    name: '오른쪽 팔(뒤)',
    category: '팔',
    d: 'M148 120 L162 178 L144 174 Z',
    center: { x: 152, y: 150 },
  },
  {
    id: 'back-hamstring-l',
    name: '왼쪽 햄스트링',
    category: '허벅지',
    d: 'M86 250 L108 250 L104 330 L82 330 Z',
    center: { x: 95, y: 290 },
  },
  {
    id: 'back-hamstring-r',
    name: '오른쪽 햄스트링',
    category: '허벅지',
    d: 'M112 250 L134 250 L138 330 L116 330 Z',
    center: { x: 125, y: 290 },
  },
  {
    id: 'back-calf-l',
    name: '왼쪽 종아리/발목',
    category: '종아리',
    d: 'M82 330 L104 330 L100 428 C92 434 82 434 76 426 Z',
    center: { x: 90, y: 380 },
  },
  {
    id: 'back-calf-r',
    name: '오른쪽 종아리/발목',
    category: '종아리',
    d: 'M116 330 L138 330 L144 426 C138 434 128 434 120 428 Z',
    center: { x: 130, y: 380 },
  },
];

const COMMON_CHIPS = [
  '머리/두통',
  '목/경추',
  '어깨',
  '가슴',
  '허리/요통',
  '복부/위장',
  '골반',
  '손목/손',
  '무릎/관절',
  '발목/발',
];

export const BodyMap: React.FC<BodyMapProps> = ({
  selectedPart,
  onSelectPart,
  intensityMap = {},
  readOnly = false,
}) => {
  const [viewSide, setViewSide] = useState<'front' | 'back'>('front');

  const regions = viewSide === 'front' ? FRONT_REGIONS : BACK_REGIONS;

  const handleRegionClick = (region: AnatomicalRegion) => {
    if (readOnly || !onSelectPart) return;
    triggerHaptic();
    onSelectPart(region.name);
  };

  const getRegionFill = (region: AnatomicalRegion) => {
    const isSelected =
      selectedPart &&
      (selectedPart.includes(region.category) ||
        selectedPart.includes(region.name) ||
        region.name.includes(selectedPart));

    if (isSelected) {
      return 'fill-emerald-500 stroke-emerald-300 stroke-[2.5] filter drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]';
    }

    // Check intensity map
    const int =
      intensityMap[region.name] ||
      intensityMap[region.category] ||
      intensityMap[region.id] ||
      0;

    if (int >= 8) return 'fill-rose-500/80 stroke-rose-400 stroke-1 hover:fill-rose-500';
    if (int >= 5) return 'fill-amber-500/80 stroke-amber-400 stroke-1 hover:fill-amber-500';
    if (int >= 1) return 'fill-teal-500/60 stroke-teal-400 stroke-1 hover:fill-teal-500';

    return 'fill-slate-200 dark:fill-slate-800/90 stroke-slate-300 dark:stroke-slate-700/80 stroke-1 hover:fill-emerald-500/30 dark:hover:fill-emerald-500/30';
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto select-none space-y-3">
      {/* Front / Back Toggle Buttons */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setViewSide('front');
          }}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            viewSide === 'front'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          앞면 (Front)
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setViewSide('back');
          }}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            viewSide === 'back'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          뒷면 (Back)
        </button>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full max-w-[220px] aspect-[1/2] flex items-center justify-center p-2 rounded-2xl bg-gradient-to-b from-slate-50/50 to-slate-100/50 dark:from-slate-900/40 dark:to-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 shadow-inner">
        <svg
          viewBox="0 0 220 460"
          className="w-full h-full drop-shadow-md touch-manipulation"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Outer Silhouette Glow */}
          <g className="transition-all duration-300">
            {regions.map((region) => (
              <path
                key={region.id}
                d={region.d}
                onClick={() => handleRegionClick(region)}
                className={`transition-all duration-150 ${
                  readOnly ? 'cursor-default' : 'cursor-pointer active:scale-98'
                } ${getRegionFill(region)}`}
              >
                <title>{region.name}</title>
              </path>
            ))}
          </g>

          {/* Region Anchor Indicators on hover/selected */}
          {regions.map((region) => {
            const isSelected =
              selectedPart &&
              (selectedPart.includes(region.category) || selectedPart.includes(region.name));

            if (!isSelected) return null;

            return (
              <circle
                key={`dot-${region.id}`}
                cx={region.center.x}
                cy={region.center.y}
                r="3"
                className="fill-white animate-ping"
              />
            );
          })}
        </svg>
      </div>

      {/* Selected Indicator Label */}
      {!readOnly && (
        <div className="text-center">
          {selectedPart ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-sm animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              선택 부위: {selectedPart}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">
              인체도에서 통증 부위를 직접 터치하거나 아래 칩을 선택하세요
            </span>
          )}
        </div>
      )}

      {/* Quick One-Touch Category Chips for Mobile */}
      {!readOnly && (
        <div className="w-full pt-1">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {COMMON_CHIPS.map((chip) => {
              const isSelected = selectedPart && selectedPart.includes(chip.split('/')[0]);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    if (chip.includes('허리') || chip.includes('경추')) {
                      setViewSide('back');
                    } else if (chip.includes('가슴') || chip.includes('복부')) {
                      setViewSide('front');
                    }
                    onSelectPart?.(chip);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm scale-105'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 active:scale-95'
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BodyMap;
