import React, { useState, useRef, useCallback, useContext } from 'react';
import { Eraser } from 'lucide-react';
import { triggerHaptic } from '../utils/native';
import { SettingsContext } from '../context/SettingsContext';

/**
 * Deserializes a comma-separated bodyPart string into a cleaned string array.
 * Tolerates messy punctuation, redundant commas, and extra whitespace.
 */
export function parseMultiRegionParts(bodyPartStr?: string | null): string[] {
  if (!bodyPartStr || typeof bodyPartStr !== 'string') return [];
  return bodyPartStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Serializes an array of body part names into a clean comma-separated string.
 * Deduplicates entries and removes blank strings.
 */
export function formatMultiRegionParts(parts: string[]): string {
  if (!Array.isArray(parts)) return '';
  return Array.from(new Set(parts.map((p) => p.trim()).filter(Boolean))).join(', ');
}

export interface BodyMapProps {
  selectedParts?: string[];
  onTogglePart?: (partLabel: string) => void;
  selectedPart?: string;
  onSelectPart?: (partLabel: string) => void;
  intensityMap?: Record<string, number>;
  readOnly?: boolean;
}

interface RegionZone {
  id: string;
  name: string;
  category: string;
  center: { x: number; y: number };
  rx: number;
  ry: number;
  test: (x: number, y: number) => boolean;
}

// Smooth organic human silhouette path (viewBox 0 0 240 480)
const HUMAN_SILHOUETTE_PATH = [
  'M 120 22',
  // Head & Jaw
  'C 134 22 143 33 143 50 C 143 66 134 79 128 84',
  // Neck -> Right Shoulder (viewer's right)
  'C 129 94 134 100 156 106 C 173 111 180 123 184 146',
  // Right Arm & Forearm & Hand
  'L 196 205 C 201 226 204 242 200 256 C 197 265 189 266 184 258',
  'C 180 250 180 236 177 222 L 164 160',
  // Right Torso -> Waist -> Hip
  'C 161 154 157 156 156 168 L 154 202 C 153 216 159 230 160 248',
  // Right Thigh -> Knee -> Calf -> Foot
  'C 161 274 157 308 153 334 C 155 352 156 376 151 404',
  'L 148 438 C 148 446 154 452 150 457 C 145 461 133 460 130 452',
  'L 128 408 L 125 338 C 124 304 123 272 120 264',
  // Crotch -> Left Leg
  'C 117 272 116 304 115 338 L 112 408 L 110 452',
  'C 107 460 95 461 90 457 C 86 452 92 446 92 438',
  'L 89 404 C 84 376 85 352 87 334 C 83 308 79 274 80 248',
  // Left Hip -> Waist -> Torso
  'C 81 230 87 216 86 202 L 84 168 C 83 156 79 154 76 160',
  // Left Arm & Hand
  'L 63 222 C 60 236 60 250 56 258 C 51 266 43 265 40 256',
  'C 36 242 39 226 44 205 L 56 146',
  // Left Shoulder -> Neck -> Head
  'C 60 123 67 111 84 106 C 106 100 111 94 112 84',
  'C 106 79 97 66 97 50 C 97 33 106 22 120 22 Z',
].join(' ');

const FRONT_ZONES: RegionZone[] = [
  { id: 'front-head', name: '머리/안면', category: '머리', center: { x: 120, y: 54 }, rx: 22, ry: 28, test: (x, y) => y >= 20 && y < 86 && x >= 94 && x <= 146 },
  { id: 'front-neck', name: '목/경추', category: '목', center: { x: 120, y: 97 }, rx: 14, ry: 12, test: (x, y) => y >= 86 && y < 108 && x >= 102 && x <= 138 },
  { id: 'front-shoulder-l', name: '왼쪽 어깨', category: '어깨', center: { x: 74, y: 120 }, rx: 18, ry: 15, test: (x, y) => y >= 102 && y < 142 && x >= 52 && x < 95 },
  { id: 'front-shoulder-r', name: '오른쪽 어깨', category: '어깨', center: { x: 166, y: 120 }, rx: 18, ry: 15, test: (x, y) => y >= 102 && y < 142 && x > 145 && x <= 188 },
  { id: 'front-chest', name: '가슴/흉부', category: '가슴', center: { x: 120, y: 136 }, rx: 26, ry: 24, test: (x, y) => y >= 108 && y < 166 && x >= 88 && x <= 152 },
  { id: 'front-abdomen', name: '복부/위장', category: '복부', center: { x: 120, y: 192 }, rx: 26, ry: 24, test: (x, y) => y >= 166 && y < 220 && x >= 86 && x <= 154 },
  { id: 'front-pelvis', name: '골반/하복부', category: '골반', center: { x: 120, y: 242 }, rx: 32, ry: 20, test: (x, y) => y >= 220 && y < 268 && x >= 80 && x <= 160 },
  { id: 'front-arm-l', name: '왼쪽 팔', category: '팔', center: { x: 56, y: 185 }, rx: 14, ry: 34, test: (x, y) => y >= 142 && y < 220 && x >= 34 && x < 84 },
  { id: 'front-arm-r', name: '오른쪽 팔', category: '팔', center: { x: 184, y: 185 }, rx: 14, ry: 34, test: (x, y) => y >= 142 && y < 220 && x > 156 && x <= 206 },
  { id: 'front-hand-l', name: '왼쪽 손목/손', category: '손', center: { x: 48, y: 242 }, rx: 14, ry: 22, test: (x, y) => y >= 220 && y <= 270 && x >= 32 && x < 76 },
  { id: 'front-hand-r', name: '오른쪽 손목/손', category: '손', center: { x: 192, y: 242 }, rx: 14, ry: 22, test: (x, y) => y >= 220 && y <= 270 && x > 164 && x <= 208 },
  { id: 'front-thigh-l', name: '왼쪽 허벅지', category: '허벅지', center: { x: 100, y: 300 }, rx: 18, ry: 30, test: (x, y) => y >= 268 && y < 332 && x >= 76 && x < 120 },
  { id: 'front-thigh-r', name: '오른쪽 허벅지', category: '허벅지', center: { x: 140, y: 300 }, rx: 18, ry: 30, test: (x, y) => y >= 268 && y < 332 && x >= 120 && x <= 164 },
  { id: 'front-knee-l', name: '왼쪽 무릎', category: '무릎', center: { x: 100, y: 348 }, rx: 15, ry: 16, test: (x, y) => y >= 332 && y < 368 && x >= 78 && x < 120 },
  { id: 'front-knee-r', name: '오른쪽 무릎', category: '무릎', center: { x: 140, y: 348 }, rx: 15, ry: 16, test: (x, y) => y >= 332 && y < 368 && x >= 120 && x <= 162 },
  { id: 'front-leg-l', name: '왼쪽 종아리/발', category: '종아리', center: { x: 99, y: 410 }, rx: 16, ry: 40, test: (x, y) => y >= 368 && y <= 465 && x >= 78 && x < 120 },
  { id: 'front-leg-r', name: '오른쪽 종아리/발', category: '종아리', center: { x: 141, y: 410 }, rx: 16, ry: 40, test: (x, y) => y >= 368 && y <= 465 && x >= 120 && x <= 162 },
];

const BACK_ZONES: RegionZone[] = [
  { id: 'back-head', name: '후두부/머리뒤', category: '머리', center: { x: 120, y: 54 }, rx: 22, ry: 28, test: (x, y) => y >= 20 && y < 86 && x >= 94 && x <= 146 },
  { id: 'back-neck', name: '목덜미/경추', category: '목', center: { x: 120, y: 97 }, rx: 15, ry: 13, test: (x, y) => y >= 86 && y < 110 && x >= 100 && x <= 140 },
  { id: 'back-upper-back', name: '등/견갑골', category: '등', center: { x: 120, y: 142 }, rx: 32, ry: 28, test: (x, y) => y >= 110 && y < 174 && x >= 82 && x <= 158 },
  { id: 'back-lower-back', name: '허리/요통', category: '허리', center: { x: 120, y: 198 }, rx: 30, ry: 22, test: (x, y) => y >= 174 && y < 222 && x >= 84 && x <= 156 },
  { id: 'back-glutes', name: '골반/둔부', category: '골반', center: { x: 120, y: 244 }, rx: 34, ry: 22, test: (x, y) => y >= 222 && y < 268 && x >= 80 && x <= 160 },
  { id: 'back-arm-l', name: '왼쪽 팔(뒤)', category: '팔', center: { x: 56, y: 185 }, rx: 15, ry: 38, test: (x, y) => y >= 115 && y < 268 && x >= 32 && x < 82 },
  { id: 'back-arm-r', name: '오른쪽 팔(뒤)', category: '팔', center: { x: 184, y: 185 }, rx: 15, ry: 38, test: (x, y) => y >= 115 && y < 268 && x > 158 && x <= 208 },
  { id: 'back-hamstring-l', name: '왼쪽 햄스트링', category: '허벅지', center: { x: 100, y: 310 }, rx: 18, ry: 36, test: (x, y) => y >= 268 && y < 358 && x >= 76 && x < 120 },
  { id: 'back-hamstring-r', name: '오른쪽 햄스트링', category: '허벅지', center: { x: 140, y: 310 }, rx: 18, ry: 36, test: (x, y) => y >= 268 && y < 358 && x >= 120 && x <= 164 },
  { id: 'back-calf-l', name: '왼쪽 종아리/발목', category: '종아리', center: { x: 99, y: 406 }, rx: 16, ry: 42, test: (x, y) => y >= 358 && y <= 465 && x >= 78 && x < 120 },
  { id: 'back-calf-r', name: '오른쪽 종아리/발목', category: '종아리', center: { x: 141, y: 406 }, rx: 16, ry: 42, test: (x, y) => y >= 358 && y <= 465 && x >= 120 && x <= 162 },
];

interface SprayStroke {
  x: number;
  y: number;
  side: 'front' | 'back';
}

export const EN_PART_NAMES: Record<string, string> = {
  '머리/안면': 'Head / Face',
  '목/경추': 'Neck',
  '왼쪽 어깨': 'Left Shoulder',
  '오른쪽 어깨': 'Right Shoulder',
  '가슴/흉부': 'Chest',
  '복부/위장': 'Abdomen',
  '골반/하복부': 'Pelvis / Lower Abdomen',
  '왼쪽 팔': 'Left Arm',
  '오른쪽 팔': 'Right Arm',
  '왼쪽 손목/손': 'Left Wrist / Hand',
  '오른쪽 손목/손': 'Right Wrist / Hand',
  '왼쪽 허벅지': 'Left Thigh',
  '오른쪽 허벅지': 'Right Thigh',
  '왼쪽 무릎': 'Left Knee',
  '오른쪽 무릎': 'Right Knee',
  '왼쪽 종아리/발': 'Left Calf / Foot',
  '오른쪽 종아리/발': 'Right Calf / Foot',
  '후두부/머리뒤': 'Back of Head',
  '목덜미/경추': 'Back of Neck',
  '등/견갑골': 'Upper Back',
  '허리/요통': 'Lower Back',
  '골반/둔부': 'Glutes / Pelvis',
  '왼쪽 팔(뒤)': 'Left Arm (Back)',
  '오른쪽 팔(뒤)': 'Right Arm (Back)',
  '왼쪽 햄스트링': 'Left Hamstring',
  '오른쪽 햄스트링': 'Right Hamstring',
  '왼쪽 종아리/발목': 'Left Calf / Ankle',
  '오른쪽 종아리/발목': 'Right Calf / Ankle',
};

const KO_PART_NAMES_BY_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_PART_NAMES).map(([ko, en]) => [en.toLowerCase(), ko])
);

export function localizeBodyPart(part: string, isEn: boolean): string {
  const trimmed = (part || '').trim();
  if (!trimmed) return '';
  if (isEn) {
    return EN_PART_NAMES[trimmed] || trimmed;
  }
  return KO_PART_NAMES_BY_EN[trimmed.toLowerCase()] || trimmed;
}

export const BodyMap: React.FC<BodyMapProps> = ({
  selectedParts,
  onTogglePart,
  selectedPart,
  onSelectPart,
  intensityMap = {},
  readOnly = false,
}) => {
  const settingsCtx = useContext(SettingsContext);
  const isEn = settingsCtx?.settings.language === 'en';
  const [viewSide, setViewSide] = useState<'front' | 'back'>('front');
  const [sprayStrokes, setSprayStrokes] = useState<SprayStroke[]>([]);
  const [isPainting, setIsPainting] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const strokeRecognizedRef = useRef<Set<string>>(new Set());
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const zones = viewSide === 'front' ? FRONT_ZONES : BACK_ZONES;

  const effectiveSelectedParts: string[] = React.useMemo(() => {
    if (Array.isArray(selectedParts)) {
      return selectedParts;
    }
    if (selectedPart) {
      return parseMultiRegionParts(selectedPart);
    }
    return [];
  }, [selectedParts, selectedPart]);

  const findMatchingStoredPart = useCallback(
    (zone: RegionZone): string | undefined => {
      const enName = (EN_PART_NAMES[zone.name] || '').toLowerCase();
      return effectiveSelectedParts.find((part) => {
        const trimmed = part.trim();
        if (!trimmed) return false;
        const lower = trimmed.toLowerCase();
        return (
          trimmed === zone.name ||
          zone.name.includes(trimmed) ||
          trimmed.includes(zone.name) ||
          trimmed === zone.category ||
          trimmed.split('/')[0] === zone.category ||
          trimmed === zone.id ||
          (enName && (lower === enName || enName.includes(lower) || lower.includes(enName)))
        );
      });
    },
    [effectiveSelectedParts]
  );

  const isZoneSelected = useCallback(
    (zone: RegionZone): boolean => Boolean(findMatchingStoredPart(zone)),
    [findMatchingStoredPart]
  );

  const clientToSvgPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * 240;
    const y = ((clientY - rect.top) / rect.height) * 480;
    return { x, y };
  };

  const recognizeAndApplyAtPoint = useCallback(
    (x: number, y: number) => {
      const matched = zones.find((z) => z.test(x, y));
      if (!matched) return;

      // Record spray stroke inside silhouette
      setSprayStrokes((prev) => {
        const last = lastPointRef.current;
        if (last && Math.hypot(x - last.x, y - last.y) < 7) {
          return prev;
        }
        lastPointRef.current = { x, y };
        return [...prev.slice(-180), { x, y, side: viewSide }];
      });

      if (strokeRecognizedRef.current.has(matched.id)) return;
      strokeRecognizedRef.current.add(matched.id);

      const localizedName = isEn ? EN_PART_NAMES[matched.name] || matched.name : matched.name;
      const existingStoredPart = findMatchingStoredPart(matched);
      const alreadySelected = Boolean(existingStoredPart);

      // Single-tap toggles existing selection off (using stored token so alias cleanup works);
      // drag painting only adds unrecognized parts in the active UI locale.
      if (onTogglePart) {
        if (strokeRecognizedRef.current.size === 1 || !alreadySelected) {
          triggerHaptic();
          onTogglePart(alreadySelected && existingStoredPart ? existingStoredPart : localizedName);
        }
      } else if (onSelectPart && !alreadySelected) {
        triggerHaptic();
        onSelectPart(localizedName);
      }
    },
    [zones, viewSide, isEn, findMatchingStoredPart, onTogglePart, onSelectPart]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsPainting(true);
    strokeRecognizedRef.current = new Set();
    lastPointRef.current = null;
    const pt = clientToSvgPoint(e.clientX, e.clientY);
    if (pt) {
      recognizeAndApplyAtPoint(pt.x, pt.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || !isPainting) return;
    const pt = clientToSvgPoint(e.clientX, e.clientY);
    if (pt) {
      recognizeAndApplyAtPoint(pt.x, pt.y);
    }
  };

  const handlePointerUp = () => {
    setIsPainting(false);
    strokeRecognizedRef.current = new Set();
    lastPointRef.current = null;
  };

  const handleClearAll = () => {
    triggerHaptic();
    setSprayStrokes([]);
    if (onTogglePart) {
      effectiveSelectedParts.forEach((p) => onTogglePart(p));
    }
  };

  const getZoneIntensity = (zone: RegionZone): number => {
    const enName = EN_PART_NAMES[zone.name] || '';
    let int =
      intensityMap[zone.name] ||
      (enName ? intensityMap[enName] : 0) ||
      intensityMap[zone.category] ||
      intensityMap[zone.id] ||
      0;
    if (!int) {
      for (const [key, val] of Object.entries(intensityMap)) {
        const lowerKey = key.toLowerCase();
        const lowerEn = enName.toLowerCase();
        if (
          key.includes(zone.name) ||
          zone.name.includes(key) ||
          key.includes(zone.category) ||
          (lowerEn && (lowerKey.includes(lowerEn) || lowerEn.includes(lowerKey)))
        ) {
          int = Math.max(int, val);
        }
      }
    }
    return int;
  };

  const visibleStrokes = sprayStrokes.filter((s) => s.side === viewSide);

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto select-none space-y-2.5">
      {/* Top Controls: Front/Back + Clear Spray */}
      <div className="w-full flex items-center justify-between px-1">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setViewSide('front');
            }}
            className={`px-3.5 py-1 rounded-lg transition-all ${
              viewSide === 'front'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            {isEn ? 'Front' : '앞면'}
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setViewSide('back');
            }}
            className={`px-3.5 py-1 rounded-lg transition-all ${
              viewSide === 'back'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            {isEn ? 'Back' : '뒷면'}
          </button>
        </div>

        {!readOnly && (effectiveSelectedParts.length > 0 || sprayStrokes.length > 0) && (
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-600 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <Eraser size={13} /> {isEn ? 'Clear' : '지우기'}
          </button>
        )}
      </div>

      {/* Natural Silhouette + Spray Painting Surface */}
      <div className="relative w-full max-w-[230px] aspect-[1/2] flex items-center justify-center p-2 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-inner">
        <svg
          ref={svgRef}
          viewBox="0 0 240 480"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full h-full select-none ${readOnly ? 'cursor-default' : 'cursor-crosshair touch-none'}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id="human-body-clip">
              <path d={HUMAN_SILHOUETTE_PATH} />
            </clipPath>
            <radialGradient id="spray-selected" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.68" />
              <stop offset="65%" stopColor="#14b8a6" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="spray-severe" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e11d48" stopOpacity="0.72" />
              <stop offset="70%" stopColor="#f43f5e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="spray-moderate" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.7" />
              <stop offset="70%" stopColor="#fbbf24" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Base Natural Human Silhouette */}
          <path
            d={HUMAN_SILHOUETTE_PATH}
            className="fill-slate-200/90 dark:fill-slate-800/95 stroke-slate-300 dark:stroke-slate-700 stroke-[1.5]"
          />

          {/* Subtle Anatomical Guide Lines (non-intrusive) */}
          <g clipPath="url(#human-body-clip)" className="pointer-events-none stroke-slate-300/60 dark:stroke-slate-700/60 fill-none" strokeWidth="1">
            {viewSide === 'front' ? (
              <>
                <path d="M 96 116 Q 120 124 144 116" />
                <path d="M 92 162 Q 120 168 148 162" strokeDasharray="3 3" />
                <line x1="120" y1="112" x2="120" y2="225" strokeDasharray="2 4" />
              </>
            ) : (
              <>
                <line x1="120" y1="90" x2="120" y2="232" strokeDasharray="3 3" />
                <path d="M 88 176 Q 120 182 152 176" strokeDasharray="3 3" />
              </>
            )}
          </g>

          {/* Clipped Spray Paint Layer & Highlighted Regions */}
          <g clipPath="url(#human-body-clip)" className="pointer-events-none">
            {/* Intensity Heatmap Zones (for ClinicalBriefing readOnly & active heatmaps) */}
            {zones.map((zone) => {
              const int = getZoneIntensity(zone);
              const selected = isZoneSelected(zone);
              if (!selected && int <= 0) return null;
              const gradId =
                int >= 8 ? 'url(#spray-severe)' : int >= 5 ? 'url(#spray-moderate)' : 'url(#spray-selected)';
              return (
                <ellipse
                  key={`glow-${zone.id}`}
                  cx={zone.center.x}
                  cy={zone.center.y}
                  rx={zone.rx * 1.15}
                  ry={zone.ry * 1.15}
                  fill={gradId}
                />
              );
            })}

            {/* Live User Spray Paint Strokes */}
            {visibleStrokes.map((s, idx) => (
              <circle
                key={`stroke-${idx}`}
                cx={s.x}
                cy={s.y}
                r={18}
                fill="url(#spray-selected)"
              />
            ))}
          </g>

          {/* Intensity Numeric Badges (Clinical Heatmap View) */}
          {zones.map((zone) => {
            const int = getZoneIntensity(zone);
            if (int <= 0) return null;
            return (
              <g key={`badge-${zone.id}`} className="pointer-events-none">
                <circle
                  cx={zone.center.x}
                  cy={zone.center.y}
                  r="9"
                  className={
                    int >= 8
                      ? 'fill-rose-600 stroke-white stroke-[1.5]'
                      : int >= 5
                      ? 'fill-amber-500 stroke-white stroke-[1.5]'
                      : 'fill-teal-600 stroke-white stroke-[1.5]'
                  }
                />
                <text
                  x={zone.center.x}
                  y={zone.center.y + 3.5}
                  textAnchor="middle"
                  className="fill-white font-black text-[10px] font-mono"
                >
                  {int}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Recognized & Selected Regions Tags */}
      {!readOnly && (
        <div className="w-full text-center space-y-1.5">
          {effectiveSelectedParts.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 justify-center px-2">
              {effectiveSelectedParts.map((part) => {
                const displayPart = localizeBodyPart(part, Boolean(isEn));
                return (
                  <span
                    key={part}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-xs font-bold text-teal-800 dark:text-teal-200"
                  >
                    {displayPart}
                    {onTogglePart && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic();
                          onTogglePart(part);
                        }}
                        className="hover:text-rose-500 ml-0.5 font-bold"
                        aria-label={isEn ? `Deselect ${displayPart}` : `${displayPart} 선택 해제`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] font-medium text-slate-400">
              {isEn
                ? 'Tap or drag on the body diagram to select painful areas'
                : '실루엣 위 아픈 부위를 문질러 칠하면 부위가 자동 인식됩니다'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BodyMap;
