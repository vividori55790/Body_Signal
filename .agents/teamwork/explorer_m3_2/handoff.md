# Handoff Report: Feature F10 Multi-Region Body Map Selection Technical Strategy

## 1. Observation

### 1.1 Current `BodyMap.tsx` Interface and Behavior
- **File**: `body-signal/src/components/BodyMap.tsx` (Lines 4–9, 236–277)
  ```tsx
  interface BodyMapProps {
    selectedPart?: string;
    onSelectPart?: (partLabel: string) => void;
    intensityMap?: Record<string, number>;
    readOnly?: boolean;
  }
  ```
- **Region definitions**: 17 anatomical regions in `FRONT_REGIONS` (Lines 20–140) and 11 anatomical regions in `BACK_REGIONS` (Lines 143–221). 10 quick category chips in `COMMON_CHIPS` (Lines 223–234).
- **Selection check**:
  ```tsx
  const isSelected =
    selectedPart &&
    (selectedPart.includes(region.category) ||
      selectedPart.includes(region.name) ||
      region.name.includes(selectedPart));
  ```
  Currently, `BodyMap.tsx` only accepts a single string `selectedPart?: string` and triggers `onSelectPart(region.name)` on click. Clicking another region immediately overwrites the single selection.
- **Visual indicators**:
  - SVG path fill turns to emerald highlight: `fill-emerald-500 stroke-emerald-300 stroke-[2.5] filter drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]` (Line 261).
  - Selected anchor dot pulses at region center (Lines 336–352).
  - Bottom indicator displays single text string `선택 부위: {selectedPart}` (Lines 409–413).

### 1.2 Symptom Entry Flow in `EntryForm.tsx`
- **File**: `body-signal/src/pages/EntryForm.tsx` (Lines 50–52, 291–310)
  ```tsx
  const [newLabel, setNewLabel] = useState('');
  const [newBodyPart, setNewBodyPart] = useState('');
  const [newOnsetDate, setNewOnsetDate] = useState(new Date().toISOString().split('T')[0]);
  const [showBodyMap, setShowBodyMap] = useState(false);
  ...
  <BodyMap
    selectedPart={newBodyPart}
    onSelectPart={(part) => {
      setNewBodyPart(part);
    }}
  />
  ```
  `newBodyPart` is passed as a string. When creating a new condition, it is packaged into `conditionData`:
  ```tsx
  conditionData: mode === 'new'
    ? {
        label: newLabel,
        bodyPart: newBodyPart,
        onsetDate: newOnsetDate,
      }
    : { id: selectedConditionId },
  ```

### 1.3 Schemas and Persistence Contracts
- **File**: `body-signal/src/types/health.ts` (Lines 4–11, 16–23)
  ```ts
  export const ConditionSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    bodyPart: z.string().min(1),
    onsetDate: z.string(),
    isArchived: z.boolean().default(false),
    notes: z.string().optional(),
  });

  export const PainLogSchema = z.object({
    id: z.string().min(1),
    conditionId: z.string().min(1),
    date: z.string(),
    intensity: z.number().int().min(1).max(10),
    medication: z.string().max(500).optional().default(''),
    notes: z.string().max(5000).optional().default(''),
    bodyPartOverride: z.string().optional(),
    ...
  });
  ```
  Both `Condition.bodyPart` and `PainLog.bodyPartOverride` are typed as `z.string()`.

### 1.4 Cryptographic Signatures in `crypto.ts`
- **File**: `body-signal/src/utils/crypto.ts` (Lines 340–362)
  ```ts
  export async function computeRecordSignature(
    record: {
      id: string;
      conditionId: string;
      date: string;
      intensity: number;
      medication?: string;
      postMedIntensity?: number;
      prevSignature?: string;
    },
    prevSignature: string = ''
  ): Promise<string> {
    const canonicalStr = [
      record.id,
      record.conditionId,
      record.date,
      record.intensity,
      record.medication || '',
      record.postMedIntensity ?? '',
      prevSignature || record.prevSignature || '',
    ].join('|');
    return computeSha256Checksum(canonicalStr);
  }
  ```
  `computeRecordSignature` computes the canonical SHA-256 integrity signature based solely on `[id, conditionId, date, intensity, medication, postMedIntensity, prevSignature]`. The `bodyPart` or `bodyPartOverride` string is **not** included in the signature hash calculation.

### 1.5 Clinical Briefing and Distribution in `HealthContext.tsx`
- **File**: `body-signal/src/context/HealthContext.tsx` (Lines 329–340)
  ```ts
  // Body Part distribution
  const bodyPartDist: Record<string, { count: number; maxIntensity: number }> = {};
  logs.forEach((log) => {
    const cond = conditions.find((c) => c.id === log.conditionId);
    const part = log.bodyPartOverride || cond?.bodyPart || '미지정';
    if (!bodyPartDist[part]) {
      bodyPartDist[part] = { count: 0, maxIntensity: 0 };
    }
    bodyPartDist[part].count += 1;
    bodyPartDist[part].maxIntensity = Math.max(bodyPartDist[part].maxIntensity, log.intensity);
  });
  ```
  `bodyPartDist` aggregates stats by key. If `cond.bodyPart` contains comma-separated values (e.g. `"머리/안면, 목(앞)"`), splitting by comma allows both regions to contribute to clinical distribution and `intensityMap`.

### 1.6 E2E Test Suite Contracts for Feature F10
- **File**: `body-signal/test/e2e/feedback_helpers.mjs` (Lines 204–215)
  - `parseMultiRegionParts(bodyPartStr)`: splits by comma, trims whitespace, filters empty tokens.
  - `formatMultiRegionParts(parts)`: deduplicates via `Set`, trims, and joins with `', '`.
- **File**: `body-signal/test/e2e/tier1_feedback_features.mjs` (Lines 690–757)
  - `T1.F10.1`: `BodyMap` supports `selectedParts` array with multiple anatomical regions.
  - `T1.F10.2`: Tapping unselected part toggles it into `selectedParts` array.
  - `T1.F10.3`: Tapping already selected part deselects it from `selectedParts` array.
  - `T1.F10.4`: Serializes multi-region selection into comma-separated string for schema compatibility.
  - `T1.F10.5`: Deserializes comma-separated string back to array with whitespace trimming.
- **File**: `body-signal/test/e2e/tier2_feedback_boundaries.mjs` (Lines 708–783)
  - `T2.F10.1`: Backward compatibility: passing single `selectedPart` string prop works cleanly.
  - `T2.F10.2`: Simultaneous selection of front and back regions persists across view toggle.
  - `T2.F10.3`: Deselecting all regions yields empty array without null pointer exception.
  - `T2.F10.4`: Comma parser tolerates messy formatting, extra spaces, and empty commas.
  - `T2.F10.5`: Large number of selected regions (>3) renders compact summary badge (`${parts.slice(0, 3).join(', ')} 외 ${parts.length - 3}곳`).
- **File**: `body-signal/test/e2e/tier3_feedback_combinations.mjs` (Lines 120–149, 274–291)
  - `T3.5`: Multi-region symptom entry validates cleanly under `ConditionSchema` and signs canonically.
  - `T3.12`: Multi-region symptom with head and knee pain automatically populates both Neurology and Orthopedics departments.
- **File**: `body-signal/test/e2e/tier4_feedback_scenarios.mjs` (Lines 77–88)
  - `T4.2`: Post-surgery patient selects knee & back simultaneously on `BodyMap`, adds prescribed analgesic in-flow, and verifies audit chain.

---

## 2. Logic Chain

1. **Dual-Prop Backward Compatibility**:
   - `BodyMapProps` must accept both modern multi-selection props (`selectedParts?: string[]`, `onTogglePart?: (partLabel: string) => void`) and legacy single-selection props (`selectedPart?: string`, `onSelectPart?: (partLabel: string) => void`).
   - By computing an internal `effectiveSelectedParts: string[]`:
     - If `selectedParts` is provided and non-empty, use `selectedParts`.
     - Else if `selectedPart` is provided, parse it via `parseMultiRegionParts(selectedPart)`.
     - Else fallback to `[]`.
   - This satisfies `T2.F10.1` and guarantees that any caller passing either prop works seamlessly without runtime branching or breaking existing callers.

2. **Toggle Interaction Model**:
   - When user taps a region (SVG path) or a chip:
     - Check if the region is currently selected in `effectiveSelectedParts`.
     - If already selected, removing it deselects it (`filter(p => p !== region.name)`).
     - If not selected, append it (`[...effectiveSelectedParts, region.name]`).
     - Trigger `onTogglePart?.(region.name)`.
     - Trigger `onSelectPart?.(region.name)` for backward compatibility with single-select callers.
   - This satisfies `T1.F10.2` and `T1.F10.3`.

3. **Front/Back View Persistence**:
   - Currently, view switching toggles state `viewSide` between `'front'` and `'back'`.
   - Because `selectedParts` is stored in component props / parent state (or normalized `effectiveSelectedParts`), toggling `viewSide` merely alters the active SVG region list (`FRONT_REGIONS` vs `BACK_REGIONS`).
   - Regions selected on the front side remain preserved in `effectiveSelectedParts` while viewing the back side, and vice versa.
   - When switching back to front, front regions are still highlighted. This satisfies `T2.F10.2`.

4. **Visual Multi-Region Highlighting and Badging**:
   - In SVG paths: A region is rendered as active if any part in `effectiveSelectedParts` matches `region.name` or `region.category`.
   - All active regions display the emerald glow `fill-emerald-500 stroke-emerald-300 stroke-[2.5] filter drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]`.
   - Pinging white anchor dots render on every selected region's center point.
   - Visual Badges:
     - When `effectiveSelectedParts.length === 0`: render instruction helper text.
     - When `effectiveSelectedParts.length <= 3`: render interactive individual tag badges with '×' removal buttons.
     - When `effectiveSelectedParts.length > 3`: render compact summary text (`${parts.slice(0, 3).join(', ')} 외 ${parts.length - 3}곳`) alongside tag badges and a "전체 해제" (Clear all) button. This satisfies `T2.F10.5`.

5. **Storage, Schema and Cryptographic Chain Stability**:
   - `ConditionSchema.bodyPart` is `z.string().min(1)`. Storing comma-delimited strings (`"머리/안면, 목(앞)"`) complies with `ConditionSchema` without requiring any schema migrations, migration scripts, or IndexedDB version increments.
   - In `crypto.ts`, `computeRecordSignature` does not include `bodyPart` or `bodyPartOverride` in canonical audit string hashing. Hence, multi-part selection introduces zero risk of signature hash divergence or audit chain failure.
   - In `HealthContext.tsx`, splitting multi-part strings by comma when aggregating `bodyPartDist` allows each distinct body region to independently contribute to frequency metrics and clinical department classification (`T3.12`).

---

## 3. Caveats

1. **Quick Loggers vs Full Entry Form**:
   - `AcutePainMode.tsx` and `QuickPainLogger.tsx` are intentional 1-second / 3-second emergency triage interfaces. They use high-contrast primary buttons rather than the full anatomical SVG `BodyMap`. Their condition-matching logic (`c.bodyPart.includes(...)`) already matches comma-separated multi-region conditions safely.
2. **Category Chips vs Specific Anatomical Regions**:
   - `COMMON_CHIPS` contains broad categories (e.g. `'어깨'`, `'무릎/관절'`). When a user selects a chip like `'어깨'`, matching logic should highlight the relevant shoulder regions. Conversely, tapping the specific `'왼쪽 어깨'` SVG path adds the exact anatomical label to `selectedParts`.
3. **No Database Schema Alterations**:
   - Do NOT convert `ConditionSchema.bodyPart` from `z.string()` to `z.array(z.string())`. Doing so would break existing on-device IndexedDB records from earlier versions and fail existing schema tests. Comma-delimited string serialization is the mandated, verified design.

---

## 4. Conclusion & Detailed Technical Strategy

### 4.1 Architecture & Utilities
Create or export serialization utilities in `body-signal/src/components/BodyMap.tsx` (and/or `src/utils/bodyMap.ts`):

```ts
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
```

### 4.2 Exact Implementation Specifications

#### A. `BodyMap.tsx`
Update `BodyMapProps`:
```tsx
export interface BodyMapProps {
  selectedParts?: string[];
  onTogglePart?: (partLabel: string) => void;
  selectedPart?: string;
  onSelectPart?: (partLabel: string) => void;
  intensityMap?: Record<string, number>;
  readOnly?: boolean;
}
```

Internal State & Normalization:
```tsx
export const BodyMap: React.FC<BodyMapProps> = ({
  selectedParts,
  onTogglePart,
  selectedPart,
  onSelectPart,
  intensityMap = {},
  readOnly = false,
}) => {
  const [viewSide, setViewSide] = useState<'front' | 'back'>('front');

  // Compute effective selected parts with 100% backward compatibility
  const effectiveSelectedParts: string[] = React.useMemo(() => {
    if (selectedParts && selectedParts.length > 0) {
      return selectedParts;
    }
    if (selectedPart) {
      return parseMultiRegionParts(selectedPart);
    }
    return [];
  }, [selectedParts, selectedPart]);

  const handleRegionClick = (region: AnatomicalRegion) => {
    if (readOnly) return;
    triggerHaptic();
    if (onTogglePart) {
      onTogglePart(region.name);
    }
    if (onSelectPart) {
      onSelectPart(region.name);
    }
  };

  const isRegionSelected = (region: AnatomicalRegion): boolean => {
    return effectiveSelectedParts.some((part) => {
      const trimmed = part.trim();
      if (!trimmed) return false;
      return (
        trimmed === region.name ||
        region.name.includes(trimmed) ||
        trimmed.includes(region.name) ||
        trimmed === region.category ||
        trimmed.split('/')[0] === region.category
      );
    });
  };

  const getRegionFill = (region: AnatomicalRegion) => {
    if (isRegionSelected(region)) {
      return 'fill-emerald-500 stroke-emerald-300 stroke-[2.5] filter drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]';
    }

    // Intensity lookup supports both exact name and substring/category
    let int =
      intensityMap[region.name] ||
      intensityMap[region.category] ||
      intensityMap[region.id] ||
      0;

    if (!int) {
      for (const [key, val] of Object.entries(intensityMap)) {
        if (key.includes(region.name) || region.name.includes(key) || key.includes(region.category)) {
          int = Math.max(int, val);
        }
      }
    }

    if (int >= 8) return 'fill-rose-500/80 stroke-rose-400 stroke-1 hover:fill-rose-500';
    if (int >= 5) return 'fill-amber-500/80 stroke-amber-400 stroke-1 hover:fill-amber-500';
    if (int >= 1) return 'fill-teal-500/60 stroke-teal-400 stroke-1 hover:fill-teal-500';

    return 'fill-slate-200 dark:fill-slate-800/90 stroke-slate-300 dark:stroke-slate-700/80 stroke-1 hover:fill-emerald-500/30 dark:hover:fill-emerald-500/30';
  };
```

Pinging Anchor Dots for Multi-Region Feedback:
```tsx
{/* Region Anchor Indicators on hover/selected */}
{regions.map((region) => {
  if (!isRegionSelected(region)) return null;

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
```

Interactive Selection Tag Badges & Compact Summary:
```tsx
{/* Selected Indicator Badges & Summary */}
{!readOnly && (
  <div className="w-full text-center space-y-2">
    {effectiveSelectedParts.length > 0 ? (
      <div className="space-y-1.5 animate-in fade-in">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
            선택 부위 ({effectiveSelectedParts.length}곳):
          </span>
          {effectiveSelectedParts.length > 3 && (
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {effectiveSelectedParts.slice(0, 3).join(', ')} 외 {effectiveSelectedParts.length - 3}곳
            </span>
          )}
          {onTogglePart && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                // Clear all
                effectiveSelectedParts.forEach((p) => onTogglePart(p));
              }}
              className="text-[10px] text-slate-400 hover:text-rose-500 underline ml-1"
            >
              전체 해제
            </button>
          )}
        </div>

        {/* Tag Badges with X buttons */}
        <div className="flex flex-wrap gap-1.5 justify-center max-w-sm mx-auto px-2">
          {effectiveSelectedParts.map((part) => (
            <span
              key={part}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {part}
              {onTogglePart && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic();
                    onTogglePart(part);
                  }}
                  className="hover:text-rose-500 ml-0.5 font-bold"
                  aria-label={`${part} 선택 해제`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      </div>
    ) : (
      <span className="text-[11px] font-medium text-slate-400">
        인체도에서 통증 부위를 직접 터치하거나 아래 칩을 선택하세요 (다중 선택 가능)
      </span>
    )}
  </div>
)}
```

Common Quick Chips Multi-Toggle Support:
```tsx
{/* Quick One-Touch Category Chips for Mobile */}
{!readOnly && (
  <div className="w-full pt-1">
    <div className="flex flex-wrap gap-1.5 justify-center">
      {COMMON_CHIPS.map((chip) => {
        const isSelected = effectiveSelectedParts.some(
          (p) => p.includes(chip.split('/')[0]) || chip.includes(p.split('/')[0])
        );
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
              if (onTogglePart) {
                onTogglePart(chip);
              }
              onSelectPart?.(chip);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              isSelected
                ? 'bg-emerald-600 text-white shadow-sm scale-105'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 active:scale-95'
            }`}
          >
            {chip} {isSelected && '✓'}
          </button>
        );
      })}
    </div>
  </div>
)}
```

#### B. `EntryForm.tsx`
Integration with `newBodyPart`:
```tsx
// Body part multi-selection handler
const selectedParts = parseMultiRegionParts(newBodyPart);

const handleToggleBodyPart = (part: string) => {
  const exists = selectedParts.includes(part);
  const next = exists
    ? selectedParts.filter((p) => p !== part)
    : [...selectedParts, part];
  setNewBodyPart(formatMultiRegionParts(next));
};

...
{showBodyMap && (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 animate-in fade-in">
    <BodyMap
      selectedParts={selectedParts}
      onTogglePart={handleToggleBodyPart}
      selectedPart={newBodyPart}
      onSelectPart={(part) => {
        // Fallback for single-touch callers
        if (!selectedParts.includes(part)) {
          setNewBodyPart(formatMultiRegionParts([...selectedParts, part]));
        }
      }}
    />
  </div>
)}
```

#### C. `HealthContext.tsx`
Update `bodyPartDist` calculation to support comma-separated multi-regions in `ClinicalBriefing`:
```tsx
// Body Part distribution (split comma-separated multi-region parts)
const bodyPartDist: Record<string, { count: number; maxIntensity: number }> = {};
logs.forEach((log) => {
  const cond = conditions.find((c) => c.id === log.conditionId);
  const rawPart = log.bodyPartOverride || cond?.bodyPart || '미지정';
  const parts = rawPart.includes(',')
    ? rawPart.split(',').map((s) => s.trim()).filter(Boolean)
    : [rawPart];

  parts.forEach((part) => {
    if (!bodyPartDist[part]) {
      bodyPartDist[part] = { count: 0, maxIntensity: 0 };
    }
    bodyPartDist[part].count += 1;
    bodyPartDist[part].maxIntensity = Math.max(bodyPartDist[part].maxIntensity, log.intensity);
  });
});
```

---

## 5. Verification Method

### 5.1 Verification Commands
The implementing agent can verify the changes by running the following automated test suites:

1. **Feedback Feature E2E Test Suite**:
   ```powershell
   node body-signal/test/run-feedback-tests.mjs
   ```
   *Expected Result*: All 161 tests pass cleanly, specifically:
   - `[T1.F10.1] - [T1.F10.5]` (Happy path multi-selection, toggle on/off, format & parse)
   - `[T2.F10.1] - [T2.F10.5]` (Single prop backward compatibility, front/back view persistence, compact summary badge)
   - `[T3.5]` (ConditionSchema validation + SHA-256 signature chain verification)
   - `[T3.12]` (Multi-region symptom populates both Neurology and Orthopedics)
   - `[T4.2]` (Post-op multi-region body map logging scenario)

2. **Full Production E2E Test Suite**:
   ```powershell
   npm --prefix body-signal run test:e2e
   ```
   *Expected Result*: All 170 tests pass with 0 failures.

3. **TypeScript Build Verification**:
   ```powershell
   npm --prefix body-signal run build
   ```
   *Expected Result*: Vite build succeeds without TypeScript compiler errors (`tsc -b` clean).

### 5.2 Invalidation Conditions
- Any change that alters `computeRecordSignature` in `crypto.ts` will invalidate SHA-256 integrity verification.
- Any change that mutates `ConditionSchema.bodyPart` into an array type will break existing database records.
- Any change that drops `selectedPart` or `onSelectPart` from `BodyMapProps` will break legacy components and `T2.F10.1`.
