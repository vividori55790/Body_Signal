import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { HealthDataPayload, HealthDataPayloadSchema, UserSettings, UserSettingsSchema } from '../types/health';
import { EncryptedPackage, encryptWithPin, decryptWithPin, computeSaltedPinHash } from './crypto';

const DB_NAME = 'bignal_mobile_db';
const DB_VERSION = 1;
const LEGACY_STORAGE_KEY = 'bs-data-v2';

interface BignalDBSchema extends DBSchema {
  app_state: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<BignalDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<BignalDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BignalDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state');
        }
      },
    });
  }
  return dbPromise;
}

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'ko',
  theme: 'system',
  hapticsEnabled: true,
  reminderEnabled: false,
  reminderTime: '21:00',
  pinEnabled: false,
  medicationPresets: [
    { id: '1', name: '타이레놀 500mg' },
    { id: '2', name: '이부프로펜 400mg' },
    { id: '3', name: '소염진통제' },
    { id: '4', name: '위장약' },
  ],
  symptomPresets: [
    '욱신거림', '찌르는 듯한 통증', '뻐근함', '타는 듯한 느낌', '저림', '두통', '관절통'
  ],
};

const EMPTY_HEALTH_DATA: HealthDataPayload = {
  conditions: [],
  logs: [],
  diaryEntries: [],
  settings: DEFAULT_SETTINGS,
  lastUpdated: new Date().toISOString(),
};

/**
 * Migrate legacy data from localStorage if present
 */
export async function migrateLegacyDataIfNeeded(): Promise<HealthDataPayload | null> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const data = parsed?.data || parsed;
    if (data && Array.isArray(data.conditions) && Array.isArray(data.logs)) {
      const payload: HealthDataPayload = {
        conditions: data.conditions.map((c: any) => ({
          id: c.id || crypto.randomUUID(),
          label: c.label || '미지정',
          bodyPart: c.bodyPart || '미지정',
          onsetDate: c.onsetDate || new Date().toISOString().split('T')[0],
          isArchived: Boolean(c.isArchived),
        })),
        logs: data.logs.map((l: any) => ({
          id: l.id || crypto.randomUUID(),
          conditionId: l.conditionId,
          date: l.date || new Date().toISOString(),
          intensity: Number(l.intensity) || 5,
          medication: l.medication || '',
          notes: l.notes || '',
        })),
        diaryEntries: Array.isArray(data.diaryEntries) ? data.diaryEntries : [],
        settings: DEFAULT_SETTINGS,
        lastUpdated: new Date().toISOString(),
      };

      // Save migrated data to IndexedDB
      const db = await getDB();
      await db.put('app_state', payload, 'health_data');
      // Mark migration complete, don't delete localStorage immediately for safety
      localStorage.setItem('bs-migrated-to-idb', 'true');
      return payload;
    }
  } catch (err) {
    console.warn('Legacy data migration failed or not needed:', err);
  }
  return null;
}

/**
 * Load Health Data from IndexedDB.
 * If data is encrypted, the caller must supply the PIN.
 */
export async function loadHealthData(pin?: string): Promise<{ data: HealthDataPayload; isEncrypted: boolean }> {
  const db = await getDB();
  const record = await db.get('app_state', 'health_data');

  if (!record) {
    // Check for legacy migration
    const migrated = await migrateLegacyDataIfNeeded();
    if (migrated) {
      return { data: migrated, isEncrypted: false };
    }
    return { data: EMPTY_HEALTH_DATA, isEncrypted: false };
  }

  // Check if the record is an EncryptedPackage
  if (record && typeof record === 'object' && record.v === 1 && record.salt && record.ct) {
    if (!pin) {
      return { data: EMPTY_HEALTH_DATA, isEncrypted: true };
    }
    const decryptedJson = await decryptWithPin(record as EncryptedPackage, pin);
    const parsed = JSON.parse(decryptedJson);
    const validated = HealthDataPayloadSchema.parse(parsed);
    return { data: validated, isEncrypted: true };
  }

  // Plain record
  try {
    const validated = HealthDataPayloadSchema.parse(record);
    return { data: validated, isEncrypted: false };
  } catch {
    return { data: record as HealthDataPayload, isEncrypted: false };
  }
}

/**
 * Save Health Data to IndexedDB.
 * If PIN is provided or pinEnabled is true, encrypts the payload before storing.
 */
export async function saveHealthData(data: HealthDataPayload, pin?: string): Promise<void> {
  const db = await getDB();
  const toSave = {
    ...data,
    lastUpdated: new Date().toISOString(),
  };

  if (pin) {
    const jsonStr = JSON.stringify(toSave);
    const encrypted = await encryptWithPin(jsonStr, pin);
    await db.put('app_state', encrypted, 'health_data');
  } else {
    await db.put('app_state', toSave, 'health_data');
  }
}

/**
 * Security Metadata operations
 */
export interface PinMeta {
  salt: string;
  hash: string;
  failedAttempts: number;
  lockoutUntil: number; // timestamp
}

export async function getPinMeta(): Promise<PinMeta | null> {
  const db = await getDB();
  return (await db.get('app_state', 'pin_meta')) || null;
}

export async function savePinMeta(meta: PinMeta | null): Promise<void> {
  const db = await getDB();
  if (meta === null) {
    await db.delete('app_state', 'pin_meta');
  } else {
    await db.put('app_state', meta, 'pin_meta');
  }
}

/**
 * Settings operations
 */
export async function loadUserSettings(): Promise<UserSettings> {
  const db = await getDB();
  const settings = await db.get('app_state', 'user_settings');
  if (!settings) {
    return DEFAULT_SETTINGS;
  }
  try {
    return UserSettingsSchema.parse(settings);
  } catch {
    return { ...DEFAULT_SETTINGS, ...settings };
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const db = await getDB();
  await db.put('app_state', settings, 'user_settings');
}

/**
 * Clear all local data
 */
export async function resetAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('app_state');
  localStorage.clear();
}
