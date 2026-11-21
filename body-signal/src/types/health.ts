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

export const PainLogSnapshotSchema = z
  .object({
    conditionId: z.string(),
    date: z.string(),
    intensity: z.number(),
    medication: z.string().optional(),
    notes: z.string().optional(),
    bodyPartOverride: z.string().optional(),
    painQuality: z.array(z.string()).optional(),
    radiation: z.string().optional(),
    painTiming: z
      .enum(['morning', 'afternoon', 'evening', 'night', 'constant', 'intermittent'])
      .optional(),
    triggers: z.array(z.string()).optional(),
    reliefFactors: z.array(z.string()).optional(),
    redFlags: z.array(z.string()).optional(),
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

// Condition schema & type
export const ConditionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bodyPart: z.string().min(1),
  onsetDate: z.string(), // YYYY-MM-DD (local date)
  isArchived: z.boolean().default(false),
  notes: z.string().optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

// Pain Log schema & type (with PQRST clinical metrics & revision audit trail)
export const PainLogSchema = z.object({
  id: z.string().min(1),
  conditionId: z.string().min(1),
  date: z.string(), // ISO 8601 timestamp
  intensity: z.number().int().min(1).max(10),
  medication: z.string().max(500).optional().default(''),
  notes: z.string().max(5000).optional().default(''),
  bodyPartOverride: z.string().optional(),

  // Clinical PQRST & Red Flag Extensions
  painQuality: z.array(z.string()).optional().default([]), // e.g. ['욱신거림', '찌르는 듯함', '타는 듯함']
  radiation: z.string().optional().default(''), // e.g. '우측 하지 방사통', '팔로 뻗침'
  painTiming: z.enum(['morning', 'afternoon', 'evening', 'night', 'constant', 'intermittent']).optional(),
  triggers: z.array(z.string()).optional().default([]), // e.g. ['보행 시', '오래 앉을 때', '기침/재채기']
  reliefFactors: z.array(z.string()).optional().default([]), // e.g. ['누워서 안정', '온찜질', '스트레칭']
  redFlags: z.array(z.string()).optional().default([]), // e.g. ['마비/감각 저하', '근력 약화', '고열 동반']
  postMedIntensity: z.number().int().min(0).max(10).optional(), // Pain rating after medication
  postMedSideEffects: z.array(z.string()).optional().default([]), // Side effects after medication (e.g. 속쓰림, 어지러움, 구역)
  postMedEvaluatedAt: z.string().optional(), // Medication response evaluated timestamp (ISO)

  // Medical Audit Trail, Revisions, Soft Delete & AI-Ready Provenance
  signature: z.string().optional(),
  prevSignature: z.string().optional(),
  signedAt: z.string().optional(),
  chainIndex: z.number().int().nonnegative().optional(),
  revisions: z.array(PainLogRevisionSchema).optional().default([]),
  deletedAt: z.string().optional(),
  inputSource: InputSourceSchema.optional(),
});

export type PainLog = Omit<z.infer<typeof PainLogSchema>, 'postMedSideEffects' | 'revisions'> & {
  postMedSideEffects?: string[];
  revisions?: PainLogRevision[];
};

// Diary Entry schema & type
export const DiaryEntrySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  text: z.string().max(5000),
  updatedAt: z.string(),
});

export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;

export const DiagnosticSnapshotSchema = z
  .object({
    conditionId: z.string().optional(),
    diagnosisDate: z.string(),
    diagnosisName: z.string(),
    hospitalName: z.string().optional(),
    department: z.string().optional(),
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

// User Settings
export const UserSettingsSchema = z.object({
  language: z.enum(['ko', 'en']).default('ko'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
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
  localLlm: LocalLlmConfigSchema.default({
    enabled: false,
    endpoint: 'http://localhost:11434/v1',
    model: 'llama3.2',
    apiKey: '',
    temperature: 0.3,
    maxTokens: 1024,
  }),
  medicationPresets: z.array(MedicationPresetSchema).default([
    { id: '1', name: '타이레놀 500mg' },
    { id: '2', name: '이부프로펜 400mg' },
    { id: '3', name: '소염진통제' },
    { id: '4', name: '근이완제' },
    { id: '5', name: '위장보호제' },
  ]),
  symptomPresets: z.array(z.string()).default([
    '욱신거림', '찌르는 듯함', '뻐근함', '타는 듯함', '저림', '조이는 느낌', '두통', '관절통'
  ]),
  disclaimerAcceptedAt: z.string().optional(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

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

export type HealthDataPayload = Omit<z.infer<typeof HealthDataPayloadSchema>, 'logs' | 'diagnosticRecords' | 'schemaVersion'> & {
  schemaVersion?: number;
  logs: PainLog[];
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
