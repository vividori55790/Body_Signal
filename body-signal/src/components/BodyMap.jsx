import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper to merge classes
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Function to map intensity (1-10) to color class or style
// For a smoother gradient we might want inline styles, but let's stick to tailwind classes + opacity or mapped colors for now.
// Actually, detailed heatmap usually needs inline styles for precise color interpolation.
// Let's use a helper that returns a fill color.
const getHeatmapColor = (intensity) => {
  if (!intensity) return 'fill-surface hover:fill-slate-700';
  if (intensity <= 3) return 'fill-pain-low/60';
  if (intensity <= 7) return 'fill-orange-500/80';
  return 'fill-pain-high';
};

const BodyPart = ({ id, d, intensity, onClick, label }) => {
  return (
    <g onClick={() => onClick(id)} className="cursor-pointer group transition-all duration-300">
      <path
        d={d}
        className={cn(
          "stroke-slate-600 stroke-1 transition-colors duration-300",
          getHeatmapColor(intensity),
          "group-hover:stroke-primary"
        )}
      />
      {/* Optional: Label on hover or always if active? For now clean look. */}
    </g>
  );
};

const BodyMap = ({ data = [], onBodyPartClick }) => {
  // Convert logs to map for O(1) lookup
  // data expected to be: [{ bodyPart: 'head', intensity: 5 }, ...]
  const intensityMap = data.reduce((acc, log) => {
    // Basic aggregation: take max intensity if multiple logs exist for today
    acc[log.bodyPart] = Math.max(acc[log.bodyPart] || 0, log.intensity);
    return acc;
  }, {});

  const handlePartClick = (partId) => {
    if (onBodyPartClick) {
      onBodyPartClick(partId);
    }
  };

  return (
    <div className="relative w-full aspect-[1/2] max-w-[300px] mx-auto">
      <svg
        viewBox="0 0 200 450"
        className="w-full h-full drop-shadow-xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Silhouette / Glow effect behind */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        {/* HEAD */}
        <BodyPart
          id="head"
          label="Head"
          intensity={intensityMap['head']}
          onClick={handlePartClick}
          d="M100,50 C100,25 125,25 125,50 C125,75 100,85 100,85 C100,85 75,75 75,50 C75,25 100,25 100,50 Z"
        />

        {/* NECK */}
        <BodyPart
          id="neck"
          label="Neck"
          intensity={intensityMap['neck']}
          onClick={handlePartClick}
          d="M85,80 L115,80 L115,95 L85,95 Z"
        />

        {/* CHEST / TORSO UPPER */}
        <BodyPart
          id="chest"
          label="Chest"
          intensity={intensityMap['chest']}
          onClick={handlePartClick}
          d="M70,95 L130,95 L140,150 L60,150 Z"
        />

        {/* ABDOMEN / STOMACH */}
        <BodyPart
          id="stomach"
          label="Stomach"
          intensity={intensityMap['stomach']}
          onClick={handlePartClick}
          d="M60,150 L140,150 L135,210 L65,210 Z"
        />

         {/* PELVIS */}
         <BodyPart
          id="pelvis"
          label="Pelvis"
          intensity={intensityMap['pelvis']}
          onClick={handlePartClick}
          d="M65,210 L135,210 L110,240 L90,240 Z"
        />

        {/* ARMS LEFT */}
        <BodyPart
          id="arm-l"
          label="Left Arm"
          intensity={intensityMap['arm-l']}
          onClick={handlePartClick}
          d="M60,100 L40,160 L50,165 L70,110 Z"
        />
        
        {/* ARMS RIGHT */}
        <BodyPart
          id="arm-r"
          label="Right Arm"
          intensity={intensityMap['arm-r']}
          onClick={handlePartClick}
          d="M140,100 L160,160 L150,165 L130,110 Z"
        />

         {/* LEGS LEFT UPPER */}
         <BodyPart
          id="leg-l-upper"
          label="Left Thigh"
          intensity={intensityMap['leg-l-upper']}
          onClick={handlePartClick}
          d="M90,240 L65,330 L85,330 L100,240 Z"
        />

         {/* LEGS RIGHT UPPER */}
         <BodyPart
          id="leg-r-upper"
          label="Right Thigh"
          intensity={intensityMap['leg-r-upper']}
          onClick={handlePartClick}
          d="M110,240 L135,330 L115,330 L100,240 Z"
        />

        {/* LEGS LEFT LOWER */}
         <BodyPart
          id="leg-l-lower"
          label="Left Shin"
          intensity={intensityMap['leg-l-lower']}
          onClick={handlePartClick}
          d="M65,330 L70,420 L80,420 L85,330 Z"
        />

        {/* LEGS RIGHT LOWER */}
         <BodyPart
          id="leg-r-lower"
          label="Right Shin"
          intensity={intensityMap['leg-r-lower']}
          onClick={handlePartClick}
          d="M115,330 L110,420 L120,420 L135,330 Z"
        />

      </svg>
      
      {/* Helper text for empty state */}
      {Object.keys(intensityMap).length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none opacity-50">
          <p className="text-sm font-light">Tap a body part</p>
        </div>
      )}
    </div>
  );
};

export default BodyMap;
