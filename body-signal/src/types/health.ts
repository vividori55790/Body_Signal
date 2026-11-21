import { z } from 'zod';

export const UNASSIGNED_CONDITION_ID = 'unassigned';
export const CURRENT_SCHEMA_VERSION = 2;

export const InputSourceSchema = z.enum(['manual', 'quick', 'ai_text', 'ai_voice', 'ai_vision']);
export type InputSource = z.infer<typeof InputSourceSchema>;

export const RevisionReasonSchema = z.enum([
  'edit',
  'reassign_condition',
  'soft_delete',
  'restore',
  'post_med_eval',
]);
export type RevisionReason = z.infer<typeof RevisionReasonSchema>;

export const ConditionDomainSchema = z.enum(['physical', 'mental', 'systemic']);
export type ConditionDomain = z.infer<typeof ConditionDomainSchema>;

export const TrackingModeSchema = z.enum(['pain', 'symptom_burden', 'mixed']);
export type TrackingMode = z.infer<typeof TrackingModeSchema>;

export const DepartmentIdSchema = z.enum([
  'orthopedics',
  'neurology',
  'gastroenterology',
  'internal_medicine',
]);
export type DepartmentId = z.infer<typeof DepartmentIdSchema>;

export const ThemeAccentSchema = z
  .enum(['emerald', 'teal', 'blue', 'indigo', 'rose', 'amber'])
  .catch('emerald');
export type ThemeAccentId = z.infer<typeof ThemeAccentSchema>;

export const LanguagePreferenceSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .default('system');
export type LanguagePreference = z.infer<typeof LanguagePreferenceSchema>;

/**
 * Unassigned condition normalization helpers:
 * PainLog stores 'unassigned', while DiagnosticRecord stores undefined for unassigned entries.
 */
export function isUnassignedConditionId(conditionId?: string | null): boolean {
  const trimmed = (conditionId || '').trim();
  return !trimmed || trimmed === UNASSIGNED_CONDITION_ID;
}

export function normalizePainConditionId(conditionId?: string | null): string {
  return isUnassignedConditionId(conditionId) ? UNASSIGNED_CONDITION_ID : conditionId!.trim();
}

export function normalizeDiagnosticConditionId(conditionId?: string | null): string | undefined {
  return isUnassignedConditionId(conditionId) ? undefined : conditionId!.trim();
}

export const PainLogSnapshotSchema = z
  .object({
    conditionId: z.string(),
    date: z.string(),
    intensity: z.number(),
    medication: z.string().optional(),
    notes: z.string().optional(),
    bodyPartOverride: z.string().optional(),
    bodyPartOverrideIds: z.array(z.string()).optional(),
    painQuality: z.array(z.string()).optional(),
    painQualityCodes: z.array(z.string()).optional(),
    radiation: z.string().optional(),
    radiationCodes: z.array(z.string()).optional(),
    painTiming: z
      .enum(['morning', 'afternoon', 'evening', 'night', 'constant', 'intermittent'])
      .optional(),
    triggers: z.array(z.string()).optional(),
    triggerCodes: z.array(z.string()).optional(),
    reliefFactors: z.array(z.string()).optional(),
    reliefFactorCodes: z.array(z.string()).optional(),
    redFlags: z.array(z.string()).optional(),
    redFlagCodes: z.array(z.string()).optional(),
    symptomCategory: z.string().optional(),
    severityScore: z.number().optional(),
    followUpSymptomCodes: z.array(z.string()).optional(),
    postMedIntensity: z.number().optional(),
    postMedSideEffects: z.array(z.string()).optional(),
    postMedEvaluatedAt: z.string().optional(),
    deletedAt: z.string().optional(),
    inputSource: InputSourceSchema.optional(),
    chainIndex: z.number().int().nonnegative().optional(),
    signature: z.string().optional(),
    prevSignature: z.string().optional(),
    signedAt: z.string().optional(),
  })
  .passthrough();

export type PainLogSnapshot = z.infer<typeof PainLogSnapshotSchema>;

export const PainLogRevisionSchema = z.object({
  editedAt: z.string(),
  reason: RevisionReasonSchema.default('edit'),
  previous: PainLogSnapshotSchema,
});

export type PainLogRevision = z.infer<typeof PainLogRevisionSchema>;

// Condition schema & type (with non-pain domain, bodyPartIds, recovery goal, and merge slots)
export const ConditionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bodyPart: z.string().min(1),
  bodyPartIds: z.array(z.string()).optional().default([]),
  onsetDate: z.string(), // YYYY-MM-DD (local date)
  isArchived: z.boolean().default(false),
  notes: z.string().optional(),
  domain: ConditionDomainSchema.optional().default('physical'),
  trackingMode: TrackingModeSchema.optional().default('pain'),
  resolvedAt: z.string().optional(), // YYYY-MM-DD or ISO when marked resolved
  baselineIntensity: z.number().min(0).max(10).optional(),
  targetIntensity: z.number().min(0).max(10).optional(),
  goalNote: z.string().max(500).optional(),
  mergedIntoConditionId: z.string().optional(),
});

export type Condition = Omit<
  z.infer<typeof ConditionSchema>,
  'bodyPartIds' | 'domain' | 'trackingMode'
> & {
  bodyPartIds?: string[];
  domain?: ConditionDomain;
  trackingMode?: TrackingMode;
};

// Pain Log schema & type (with PQRST codes, diversified symptom slots & revision audit trail)
export const PainLogSchema = z.object({
  id: z.string().min(1),
  conditionId: z.string().min(1),
  date: z.string(), // ISO 8601 timestamp
  intensity: z.number().int().min(1).max(10),
  medication: z.string().max(500).optional().default(''),
  notes: z.string().max(5000).optional().default(''),
  bodyPartOverride: z.string().optional(),
  bodyPartOverrideIds: z.array(z.string()).optional().default([]),

  // Clinical PQRST & Red Flag Extensions (display labels + language-neutral canonical codes)
  painQuality: z.array(z.string()).optional().default([]),
  painQualityCodes: z.array(z.string()).optional().default([]),
  radiation: z.string().optional().default(''),
  radiationCodes: z.array(z.string()).optional().default([]),
  painTiming: z.enum(['morning', 'afternoon', 'evening', 'night', 'constant', 'intermittent']).optional(),
  triggers: z.array(z.string()).optional().default([]),
  triggerCodes: z.array(z.string()).optional().default([]),
  reliefFactors: z.array(z.string()).optional().default([]),
  reliefFactorCodes: z.array(z.string()).optional().default([]),
  redFlags: z.array(z.string()).optional().default([]),
  redFlagCodes: z.array(z.string()).optional().default([]),

  // Non-pain / diversified symptom extensions (compatible with PainLog.intensity)
  symptomCategory: z.string().optional(),
  severityScore: z.number().min(0).max(10).optional(),
  followUpSymptomCodes: z.array(z.string()).optional().default([]),

  postMedIntensity: z.number().int().min(0).max(10).optional(),
  postMedSideEffects: z.array(z.string()).optional().default([]),
  postMedEvaluatedAt: z.string().optional(),

  // Medical Audit Trail, Revisions, Soft Delete & AI-Ready Provenance
  signature: z.string().optional(),
  prevSignature: z.string().optional(),
  signedAt: z.string().optional(),
  chainIndex: z.number().int().nonnegative().optional(),
  revisions: z.array(PainLogRevisionSchema).optional().default([]),
  deletedAt: z.string().optional(),
  inputSource: InputSourceSchema.optional(),
});

export type PainLog = Omit<
  z.infer<typeof PainLogSchema>,
  | 'postMedSideEffects'
  | 'revisions'
  | 'bodyPartOverrideIds'
  | 'painQualityCodes'
  | 'radiationCodes'
  | 'triggerCodes'
  | 'reliefFactorCodes'
  | 'redFlagCodes'
  | 'followUpSymptomCodes'
> & {
  postMedSideEffects?: string[];
  revisions?: PainLogRevision[];
  bodyPartOverrideIds?: string[];
  painQualityCodes?: string[];
  radiationCodes?: string[];
  triggerCodes?: string[];
  reliefFactorCodes?: string[];
  redFlagCodes?: string[];
  followUpSymptomCodes?: string[];
};

// Diary Entry schema & type (supports future per-condition timeline linkage)
export const DiaryEntrySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  text: z.string().max(5000),
  updatedAt: z.string(),
  conditionId: z.string().optional(),
  conditionIds: z.array(z.string()).optional().default([]),
});

export type DiaryEntry = Omit<z.infer<typeof DiaryEntrySchema>, 'conditionIds'> & {
  conditionIds?: string[];
};

export const DiagnosticSnapshotSchema = z
  .object({
    conditionId: z.string().optional(),
    diagnosisDate: z.string(),
    diagnosisName: z.string(),
    hospitalName: z.string().optional(),
    department: z.string().optional(),
    departmentId: DepartmentIdSchema.optional(),
    amountKrw: z.number().optional(),
    notes: z.string().optional(),
    photoIds: z.array(z.string()).optional(),
    claimStatus: z.enum(['pending', 'claimed', 'not_applicable']).optional(),
    claimDeadlineYears: z.number().optional(),
    claimedAt: z.string().optional(),
    deletedAt: z.string().optional(),
    inputSource: InputSourceSchema.optional(),
    signature: z.string().optional(),
    prevSignature: z.string().optional(),
    signedAt: z.string().optional(),
  })
  .passthrough();

export type DiagnosticSnapshot = z.infer<typeof DiagnosticSnapshotSchema>;

export const DiagnosticRevisionSchema = z.object({
  editedAt: z.string(),
  reason: RevisionReasonSchema.default('edit'),
  previous: DiagnosticSnapshotSchema,
});

export type DiagnosticRevision = z.infer<typeof DiagnosticRevisionSchema>;

// Diagnostic Record & Encrypted Photo Vault schema
export const DiagnosticRecordSchema = z.object({
  id: z.string().min(1),
  conditionId: z.string().optional(), // Associated disease/condition ID (optional)
  diagnosisDate: z.string(), // YYYY-MM-DD
  diagnosisName: z.string().min(1),
  hospitalName: z.string().optional().default(''),
  department: z.string().optional().default(''),
  departmentId: DepartmentIdSchema.optional(),
  amountKrw: z.number().nonnegative().optional(),
  notes: z.string().max(5000).optional().default(''),
  photoIds: z.array(z.string()).default([]),
  claimStatus: z.enum(['pending', 'claimed', 'not_applicable']).default('pending'),
  claimDeadlineYears: z.number().int().min(1).max(10).default(3),
  claimedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Optional Integrity, Revisions, Soft Delete & AI-Ready Provenance
  signature: z.string().optional(),
  prevSignature: z.string().optional(),
  signedAt: z.string().optional(),
  revisions: z.array(DiagnosticRevisionSchema).optional().default([]),
  deletedAt: z.string().optional(),
  inputSource: InputSourceSchema.optional(),
});

export type DiagnosticRecord = Omit<z.infer<typeof DiagnosticRecordSchema>, 'revisions'> & {
  revisions?: DiagnosticRevision[];
};

// Presets for quick mobile logging
export const MedicationPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  dosage: z.string().optional(),
});

export type MedicationPreset = z.infer<typeof MedicationPresetSchema>;

// Local LLM Config Schema
export const LocalLlmConfigSchema = z.object({
  enabled: z.boolean().default(false),
  endpoint: z.string().default('http://localhost:11434/v1'),
  model: z.string().default('llama3.2'),
  apiKey: z.string().optional().default(''),
  temperature: z.number().default(0.3),
  maxTokens: z.number().default(1024),
});

export type LocalLlmConfig = z.infer<typeof LocalLlmConfigSchema>;

export const LogoVariantSchema = z.enum(['cube-3d', 'cube-2d']).catch('cube-3d');
export type LogoVariant = z.infer<typeof LogoVariantSchema>;

// Single Source of Truth (SSOT) defaults
export const DEFAULT_LOCAL_LLM_CONFIG: LocalLlmConfig = {
  enabled: false,
  endpoint: 'http://localhost:11434/v1',
  model: 'llama3.2',
  apiKey: '',
  temperature: 0.3,
  maxTokens: 1024,
};

export const DEFAULT_MEDICATION_PRESETS: MedicationPreset[] = [
  { id: '1', name: '타이레놀', dosage: '500mg' },
  { id: '2', name: '이부프로펜', dosage: '400mg' },
  { id: '3', name: '소염진통제' },
  { id: '4', name: '근이완제' },
  { id: '5', name: '위장보호제' },
];

export const DEFAULT_SYMPTOM_PRESETS: string[] = [
  'throbbing',
  'sharp_stabbing',
  'aching_heavy',
  'burning',
  'tingling_electric',
  'tight_squeezing',
  'cramping_spasm',
];

// User Settings
export const UserSettingsSchema = z.object({
  language: LanguagePreferenceSchema,
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  themeAccent: ThemeAccentSchema.default('emerald'),
  logoVariant: LogoVariantSchema.default('cube-3d'),
  hapticsEnabled: z.boolean().default(true),
  reminderEnabled: z.boolean().default(false), // Deferred to v4.0.0 UI (disabled under Zero Dead-Control Gate)
  reminderTime: z.string().default('21:00'), // HH:mm
  pinEnabled: z.boolean().default(false),
  quickSosEnabled: z.boolean().default(false),
  showDiagnosticsTab: z.boolean().default(false),
  defaultQuickLoggerOpen: z.boolean().default(true),
  defaultBodyMapOpen: z.boolean().default(true),
  quickLoggerUnusedCloseCount: z.number().int().min(0).default(0),
  bodyMapUnusedCloseCount: z.number().int().min(0).default(0),
  emrFormat: z.enum(['standard', 'soap']).default('standard'), // Deferred/legacy preference (disabled in v2 Settings UI)
  localLlm: LocalLlmConfigSchema.default(DEFAULT_LOCAL_LLM_CONFIG),
  medicationPresets: z.array(MedicationPresetSchema).default(DEFAULT_MEDICATION_PRESETS),
  symptomPresets: z.array(z.string()).default(DEFAULT_SYMPTOM_PRESETS),
  disclaimerAcceptedAt: z.string().optional(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = UserSettingsSchema.parse({});

// Complete Health Data Payload
export const HealthDataPayloadSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  conditions: z.array(ConditionSchema),
  logs: z.array(PainLogSchema),
  diaryEntries: z.array(DiaryEntrySchema),
  diagnosticRecords: z.array(DiagnosticRecordSchema).optional().default([]),
  settings: UserSettingsSchema.optional(),
  lastUpdated: z.string().optional(),
});

export type HealthDataPayload = Omit<
  z.infer<typeof HealthDataPayloadSchema>,
  'conditions' | 'logs' | 'diaryEntries' | 'diagnosticRecords' | 'schemaVersion'
> & {
  schemaVersion?: number;
  conditions: Condition[];
  logs: PainLog[];
  diaryEntries: DiaryEntry[];
  diagnosticRecords: DiagnosticRecord[];
};

// Clinical Briefing (For Doctors & Nurses)
export interface ClinicalBriefing {
  patientSummary: {
    activeConditionsCount: number;
    totalLogsRecorded: number;
    daysTracked: number;
  };
  conditionsSummary: {
    condition: Condition;
    recentIntensity: number | null;
    avgIntensity7Days: number | null;
    avgIntensity30Days: number | null;
    peakIntensity: number | null;
    trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
    delta: number | null;
    frequentMedications: string[];
    medicationAdherenceRate: number; // percentage of days logged with med
    recentLogs: PainLog[];
    painQualities: string[];
    radiations: string[];
    triggers: string[];
    reliefFactors: string[];
  }[];
  bodyPartDistribution: Record<string, { count: number; maxIntensity: number }>;
  medicationResponse: {
    medication: string;
    logCount: number;
    avgIntensityWhenTaken: number;
    nextDayAvgIntensity: number | null;
  }[];
  redFlagsDetected: string[];
  timingAnalysis: {
    morningCount: number;
    nightCount: number;
    constantCount: number;
    intermittentCount: number;
  };
  qualityDistribution: Record<string, number>;
  soapNote: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
}
