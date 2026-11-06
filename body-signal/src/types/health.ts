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

// Pain Log schema & type
export const PainLogSchema = z.object({
  id: z.string().min(1),
  conditionId: z.string().min(1),
  date: z.string(), // ISO string
  intensity: z.number().int().min(1).max(10),
  medication: z.string().max(500).optional().default(''),
  notes: z.string().max(5000).optional().default(''),
  bodyPartOverride: z.string().optional(),
});

export type PainLog = z.infer<typeof PainLogSchema>;

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

// User Settings
export const UserSettingsSchema = z.object({
  language: z.enum(['ko', 'en']).default('ko'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  hapticsEnabled: z.boolean().default(true),
  reminderEnabled: z.boolean().default(false),
  reminderTime: z.string().default('21:00'), // HH:mm
  pinEnabled: z.boolean().default(false),
  medicationPresets: z.array(MedicationPresetSchema).default([
    { id: '1', name: '타이레놀 500mg' },
    { id: '2', name: '이부프로펜 400mg' },
    { id: '3', name: '소염진통제' },
    { id: '4', name: '위장약' },
  ]),
  symptomPresets: z.array(z.string()).default([
    '욱신거림', '찌르는 듯한 통증', '뻐근함', '타는 듯한 느낌', '저림', '두통', '관절통'
  ]),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

// Complete Health Data Payload
export const HealthDataPayloadSchema = z.object({
  conditions: z.array(ConditionSchema),
  logs: z.array(PainLogSchema),
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
  }[];
  bodyPartDistribution: Record<string, { count: number; maxIntensity: number }>;
  medicationResponse: {
    medication: string;
    logCount: number;
    avgIntensityWhenTaken: number;
    nextDayAvgIntensity: number | null;
  }[];
}
