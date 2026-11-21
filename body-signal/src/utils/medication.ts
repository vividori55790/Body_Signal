import { LocaleId } from '../i18n/translations';
import { MedicationPreset, isUnassignedConditionId } from '../types/health';

const DOSAGE_SUFFIX_PATTERN =
  /^(.+?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%|정|알|포|캡슐|방울|tablet|tabs?|capsule|caps?))$/i;

/**
 * Splits combined medication strings (e.g., "타이레놀 500mg" -> { name: "타이레놀", dosage: "500mg" })
 * when dosage was not explicitly provided in a separate field.
 */
export function normalizeMedicationNameDosage(
  rawName: string,
  rawDosage?: string
): { name: string; dosage?: string } {
  const cleanName = (rawName || '').trim();
  const explicitDosage = rawDosage ? rawDosage.trim().slice(0, 40) : '';
  if (explicitDosage || !cleanName) {
    return {
      name: cleanName,
      dosage: explicitDosage || undefined,
    };
  }
  const match = cleanName.match(DOSAGE_SUFFIX_PATTERN);
  if (match && match[1].trim()) {
    return {
      name: match[1].trim(),
      dosage: match[2].trim().slice(0, 40),
    };
  }
  return { name: cleanName, dosage: undefined };
}

/**
 * Prioritizes active medications linked to the given conditionId first,
 * followed by global presets (no conditionId), then other condition meds.
 */
export function prioritizeConditionMedications(
  presets: MedicationPreset[],
  conditionId?: string | null,
  includeInactive = false
): MedicationPreset[] {
  const visible = includeInactive ? [...presets] : presets.filter((p) => p.isActive !== false);
  const targetCondId = isUnassignedConditionId(conditionId) ? null : conditionId!.trim();

  const score = (p: MedicationPreset): number => {
    if (targetCondId && p.conditionId === targetCondId) return 0;
    if (!p.conditionId) return 1;
    return 2;
  };

  return visible.sort((a, b) => score(a) - score(b));
}

export function isMedicationLowStock(preset: MedicationPreset): boolean {
  if (typeof preset.remainingCount !== 'number') return false;
  const threshold = typeof preset.lowStockThreshold === 'number' ? preset.lowStockThreshold : 3;
  return preset.remainingCount <= threshold;
}

export function deductMedicationStock(preset: MedicationPreset, count = 1): MedicationPreset {
  if (typeof preset.remainingCount !== 'number' || count <= 0) return preset;
  return {
    ...preset,
    remainingCount: Math.max(0, Number((preset.remainingCount - count).toFixed(2))),
  };
}

export function refillMedicationStock(
  preset: MedicationPreset,
  addedCount: number,
  nextTotalCount?: number
): MedicationPreset {
  if (addedCount <= 0 && nextTotalCount === undefined) return preset;
  const base = typeof preset.remainingCount === 'number' ? preset.remainingCount : 0;
  const updatedRemaining = Math.max(0, Number((base + Math.max(0, addedCount)).toFixed(2)));
  const resolvedTotal =
    typeof nextTotalCount === 'number'
      ? Math.max(updatedRemaining, nextTotalCount)
      : typeof preset.totalCount === 'number'
      ? Math.max(preset.totalCount, updatedRemaining)
      : undefined;
  return {
    ...preset,
    remainingCount: updatedRemaining,
    ...(resolvedTotal !== undefined ? { totalCount: resolvedTotal } : {}),
  };
}

export function deactivateConditionMedications(
  presets: MedicationPreset[],
  conditionId: string,
  endedAt: string
): MedicationPreset[] {
  if (isUnassignedConditionId(conditionId)) return presets;
  return presets.map((p) =>
    p.conditionId === conditionId && p.isActive !== false
      ? { ...p, isActive: false, endedAt: p.endedAt || endedAt }
      : p
  );
}

const MEDICATION_KO_TO_EN: Record<string, string> = {
  '타이레놀 500mg': 'Tylenol 500mg',
  타이레놀: 'Tylenol',
  '이부프로펜 400mg': 'Ibuprofen 400mg',
  소염진통제: 'NSAID',
  근이완제: 'Muscle Relaxant',
  근육이완제: 'Muscle Relaxant',
  위장약: 'GI Protectant',
  위장보호제: 'GI Protectant',
  처방약: 'Rx Med',
  '병원 처방약': 'Rx Medication',
};

const MEDICATION_EN_TO_KO: Record<string, string> = {
  'tylenol 500mg': '타이레놀 500mg',
  tylenol: '타이레놀',
  'ibuprofen 400mg': '이부프로펜 400mg',
  nsaid: '소염진통제',
  'muscle relaxant': '근이완제',
  'gi protectant': '위장보호제',
  'rx med': '처방약',
  'rx medication': '병원 처방약',
};

/**
 * Localizes built-in medication preset names between Korean and English
 * while preserving custom user-entered medication names verbatim.
 */
export function localizeMedicationName(name: string, language?: LocaleId): string {
  const trimmed = (name || '').trim();
  if (!trimmed || !language) return trimmed;
  if (!language.toLowerCase().startsWith('ko')) {
    return MEDICATION_KO_TO_EN[trimmed] || trimmed;
  }
  return MEDICATION_EN_TO_KO[trimmed.toLowerCase()] || trimmed;
}

/**
 * Standardized formatter for medication presets.
 * Returns `${name} ${dosage}` if dosage is provided and not already included in name.
 */
export function formatMedicationPreset(
  preset: { name: string; dosage?: string },
  language?: LocaleId
): string {
  const name = localizeMedicationName(preset.name || '', language);
  const dosage = preset.dosage ? preset.dosage.trim() : '';

  if (!dosage || name.toLowerCase().includes(dosage.toLowerCase())) {
    return name;
  }
  return `${name} ${dosage}`;
}

/**
 * Validates medication input.
 * Ensures non-empty, trims whitespace, and caps length at 80 characters.
 */
export function validateMedicationInput(
  name: string,
  dosage?: string,
  language?: LocaleId
): {
  valid: boolean;
  error?: string;
  cleanName?: string;
  cleanDosage?: string;
} {
  const isEn = Boolean(language && !language.toLowerCase().startsWith('ko'));
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return {
      valid: false,
      error: isEn ? 'Please enter a medication name.' : '약 이름을 입력해 주세요.',
    };
  }
  if (cleanName.length > 80) {
    return {
      valid: false,
      error: isEn
        ? 'Medication name can be up to 80 characters.'
        : '약 이름은 최대 80자까지 입력 가능합니다.',
    };
  }
  const cleanDosage = dosage ? dosage.trim().slice(0, 40) : undefined;
  return { valid: true, cleanName, cleanDosage };
}
