import { MedicationPreset } from '../types/health';

/**
 * Standardized formatter for medication presets.
 * Returns `${name} ${dosage}` if dosage is provided and not already included in name.
 */
export function formatMedicationPreset(preset: { name: string; dosage?: string }): string {
  const name = (preset.name || '').trim();
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
  dosage?: string
): {
  valid: boolean;
  error?: string;
  cleanName?: string;
  cleanDosage?: string;
} {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return { valid: false, error: '약 이름을 입력해 주세요.' };
  }
  if (cleanName.length > 80) {
    return { valid: false, error: '약 이름은 최대 80자까지 입력 가능합니다.' };
  }
  const cleanDosage = dosage ? dosage.trim().slice(0, 40) : undefined;
  return { valid: true, cleanName, cleanDosage };
}
