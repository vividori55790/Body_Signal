import { LocaleId } from '../i18n/translations';

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
