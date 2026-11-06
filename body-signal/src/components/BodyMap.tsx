import React from 'react';
import { triggerHaptic } from '../utils/native';

interface BodyMapProps {
  selectedPart?: string;
  onSelectPart?: (partLabel: string) => void;
  intensityMap?: Record<string, number>; // part -> intensity 1-10
  readOnly?: boolean;
}

interface PartConfig {
  id: string;
  label: string;
  d: string;
}

const BODY_PARTS: PartConfig[] = [
  {
    id: 'head',
    label: '머리 (두통/안면)',
    d: 'M100,50 C100,25 125,25 125,50 C125,75 100,85 100,85 C100,85 75,75 75,50 C75,25 100,25 100,50 Z',
  },
  {
    id: 'neck',
    label: '목 (경추)',
    d: 'M85,82 L115,82 L115,96 L85,96 Z',
  },
  {
    id: 'chest',
    label: '가슴/흉부',
    d: 'M70,96 L130,96 L140,150 L60,150 Z',
  },
  {
    id: 'stomach',
    label: '복부/위장',
    d: 'M60,150 L140,150 L135,210 L65,210 Z',
  },
  {
    id: 'pelvis',
    label: '골반/허리(하복부)',
    d: 'M65,210 L135,210 L110,240 L90,240 Z',
  },
  {
    id: 'arm-l',
    label: '왼쪽 팔/어깨',
    d: 'M60,100 L35,160 L45,165 L68,110 Z',
  },
  {
    id: 'arm-r',
    label: '오른쪽 팔/어깨',
    d: 'M140,100 L165,160 L155,165 L132,110 Z',
  },
  {
    id: 'leg-l',
    label: '왼쪽 다리/무릎',
    d: 'M90,240 L65,330 L70,420 L80,420 L85,330 L100,240 Z',
  },
  {
    id: 'leg-r',
    label: '오른쪽 다리/무릎',
    d: 'M110,240 L135,330 L130,420 L120,420 L115,330 L100,240 Z',
  },
];

export const BodyMap: React.FC<BodyMapProps> = ({
  selectedPart,
  onSelectPart,
  intensityMap = {},
  readOnly = false,
}) => {
  const handlePartClick = (part: PartConfig) => {
    if (readOnly || !onSelectPart) return;
    triggerHaptic();
    onSelectPart(part.label);
  };

  const getColor = (part: PartConfig) => {
    const isSelected = selectedPart && selectedPart.includes(part.label.split(' ')[0]);
    if (isSelected) {
      return 'fill-emerald-500 stroke-emerald-400 stroke-2';
    }

    // Check intensity map by label or id
    const intensity =
      intensityMap[part.label] ||
      intensityMap[part.id] ||
      intensityMap[part.label.split(' ')[0]] ||
      0;

    if (intensity >= 8) return 'fill-rose-500/80 stroke-rose-400 stroke-1';
    if (intensity >= 5) return 'fill-amber-500/80 stroke-amber-400 stroke-1';
    if (intensity >= 1) return 'fill-emerald-500/60 stroke-emerald-400 stroke-1';

    return 'fill-slate-200 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-700 stroke-1 hover:fill-slate-300 dark:hover:fill-slate-700';
  };

  return (
    <div className="relative mx-auto flex flex-col items-center justify-center p-2">
      <svg
        viewBox="0 0 200 450"
        className="h-64 max-h-[300px] w-auto drop-shadow-md select-none touch-manipulation"
      >
        {BODY_PARTS.map((part) => (
          <path
            key={part.id}
            d={part.d}
            onClick={() => handlePartClick(part)}
            className={`transition-all duration-200 ${
              readOnly ? 'cursor-default' : 'cursor-pointer active:scale-95'
            } ${getColor(part)}`}
          />
        ))}
      </svg>

      {!readOnly && (
        <p className="mt-2 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {selectedPart ? (
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              선택됨: {selectedPart}
            </span>
          ) : (
            '신체 부위를 직접 터치하여 선택하세요'
          )}
        </p>
      )}
    </div>
  );
};

export default BodyMap;
