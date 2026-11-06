import { z } from 'zod';

// Condition schema & type
export const ConditionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bodyPart: z.string().min(1),
  onsetDate: z.string(), // ISO date or YYYY-MM-DD
  isArchived: z.boolean().default(false),
  notes: z.string().optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

// Pain Log schema & type (with PQRST clinical metrics)
export const PainLogSchema = z.object({
  id: z.string().min(1),
  conditionId: z.string().min(1),
  date: z.string(), // ISO string
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

  // Medical Audit Trail & Integrity Signatures
  signature: z.string().optional(),
  prevSignature: z.string().optional(),
  signedAt: z.string().optional(),
});

export type PainLog = Omit<z.infer<typeof PainLogSchema>, 'postMedSideEffects'> & {
  postMedSideEffects?: string[];
};

// Diary Entry schema & type
export const DiaryEntrySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  text: z.string().max(5000),
  updatedAt: z.string(),
});

export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;

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

// User Settings
export const UserSettingsSchema = z.object({
  language: z.enum(['ko', 'en']).default('ko'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  hapticsEnabled: z.boolean().default(true),
  reminderEnabled: z.boolean().default(false),
  reminderTime: z.string().default('21:00'), // HH:mm
  pinEnabled: z.boolean().default(false),
  quickSosEnabled: z.boolean().default(true),
  emrFormat: z.enum(['standard', 'soap']).default('standard'),
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
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

// Complete Health Data Payload
export const HealthDataPayloadSchema = z.object({
  conditions: z.array(ConditionSchema),
  logs: z.array(z.custom<PainLog>()),
  diaryEntries: z.array(DiaryEntrySchema),
  settings: UserSettingsSchema.optional(),
  lastUpdated: z.string().optional(),
});

export type HealthDataPayload = z.infer<typeof HealthDataPayloadSchema>;

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
