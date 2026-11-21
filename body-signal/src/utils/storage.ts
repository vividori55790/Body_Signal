import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  DEFAULT_USER_SETTINGS,
  CURRENT_SCHEMA_VERSION,
  Condition,
  ConditionSchema,
  DiagnosticRecord,
  DiagnosticRecordSchema,
  DiaryEntry,
  DiaryEntrySchema,
  HealthDataPayload,
  HealthDataPayloadSchema,
  PainLog,
  PainLogSchema,
  UNASSIGNED_CONDITION_ID,
  UserSettings,
  UserSettingsSchema,
} from '../types/health';
import {
  resolveBodyPartIds,
  resolvePqrstCodes,
} from './clinicalTaxonomy';
import { normalizeMedicationNameDosage } from './medication';
import {
  EncryptedPackage,
  SESSION_KEY_TOKEN,
  encryptWithPin,
  decryptWithPin,
  encryptWithActiveSessionKey,
  decryptWithActiveSessionKey,
  hasActiveSessionCryptoKey,
  encryptWithDeviceKey,
  decryptWithDeviceKey,
  generateDeviceMasterKeyHex,
  importKeyFromHex,
} from './crypto';
import SecureAuth, { isNativeAndroidSecureAuth } from './secureAuthBridge';
import { normalizeIsoTimestamp, normalizeLocalYmd, toLocalYmd } from './dateUtils';

const DB_NAME = 'bignal_mobile_db';
const DB_VERSION = 3;
const LEGACY_STORAGE_KEY = 'bs-data-v2';

interface BignalDBSchema extends DBSchema {
  app_state: {
    key: string;
    value: any;
  };
  device_key_store: {
    key: string;
    value: any;
  };
  encrypted_media: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<BignalDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<BignalDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BignalDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state');
        }
        if (!db.objectStoreNames.contains('device_key_store')) {
          db.createObjectStore('device_key_store');
        }
        if (!db.objectStoreNames.contains('encrypted_media')) {
          db.createObjectStore('encrypted_media');
        }
      },
    });
  }
  return dbPromise;
}

export const DEFAULT_SETTINGS: UserSettings = DEFAULT_USER_SETTINGS;

const EMPTY_HEALTH_DATA: HealthDataPayload = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  conditions: [],
  logs: [],
  diaryEntries: [],
  diagnosticRecords: [],
  settings: DEFAULT_SETTINGS,
  lastUpdated: new Date().toISOString(),
};

export interface PayloadRecoveryResult {
  payload: HealthDataPayload;
  recoveredWarnings: string[];
  didMigrate: boolean;
}

/**
 * Parses decrypted JSON text with emergency substring extraction fallback
 * in case trailing/leading framing corruption occurred.
 */
export function extractHealthPayloadJson(rawText: string): unknown {
  const trimmed = (rawText || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        // fall through to original error
      }
    }
    throw err;
  }
}

function normalizeConditionCandidate(raw: any): Condition | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = {
    ...raw,
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : crypto.randomUUID(),
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : '미지정',
    bodyPart: typeof raw.bodyPart === 'string' && raw.bodyPart.trim() ? raw.bodyPart.trim() : '미지정',
    onsetDate: normalizeLocalYmd(typeof raw.onsetDate === 'string' ? raw.onsetDate : undefined),
    isArchived: Boolean(raw.isArchived),
  };
  const parsed = ConditionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function normalizePainLogCandidate(raw: any): PainLog | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawInt = Number(raw.intensity);
  const clampedIntensity = Number.isFinite(rawInt)
    ? Math.max(1, Math.min(10, Math.round(rawInt)))
    : 5;
  const rawPostInt =
    raw.postMedIntensity !== undefined && raw.postMedIntensity !== null && raw.postMedIntensity !== ''
      ? Number(raw.postMedIntensity)
      : undefined;
  const clampedPostMed =
    rawPostInt !== undefined && Number.isFinite(rawPostInt)
      ? Math.max(0, Math.min(10, Math.round(rawPostInt)))
      : undefined;

  const candidate = {
    ...raw,
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : crypto.randomUUID(),
    conditionId:
      typeof raw.conditionId === 'string' && raw.conditionId.trim()
        ? raw.conditionId.trim()
        : UNASSIGNED_CONDITION_ID,
    date: normalizeIsoTimestamp(typeof raw.date === 'string' ? raw.date : undefined),
    intensity: clampedIntensity,
    medication: typeof raw.medication === 'string' ? raw.medication.slice(0, 500) : '',
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 5000) : '',
    postMedIntensity: clampedPostMed,
    signedAt: typeof raw.signedAt === 'string' ? normalizeIsoTimestamp(raw.signedAt) : undefined,
    deletedAt: typeof raw.deletedAt === 'string' ? normalizeIsoTimestamp(raw.deletedAt) : undefined,
  };
  const parsed = PainLogSchema.safeParse(candidate);
  return parsed.success ? (parsed.data as PainLog) : null;
}

function normalizeDiaryCandidate(raw: any): DiaryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = {
    ...raw,
    date: normalizeLocalYmd(typeof raw.date === 'string' ? raw.date : undefined),
    text: typeof raw.text === 'string' ? raw.text.slice(0, 5000) : '',
    updatedAt: normalizeIsoTimestamp(typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined),
  };
  const parsed = DiaryEntrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function normalizeDiagnosticCandidate(raw: any): DiagnosticRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.diagnosisName !== 'string' || !raw.diagnosisName.trim()) return null;
  const nowIso = new Date().toISOString();
  const rawAmt =
    raw.amountKrw !== undefined && raw.amountKrw !== null && raw.amountKrw !== ''
      ? Number(raw.amountKrw)
      : undefined;
  const candidate = {
    ...raw,
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : crypto.randomUUID(),
    diagnosisDate: normalizeLocalYmd(
      typeof raw.diagnosisDate === 'string' ? raw.diagnosisDate : undefined
    ),
    diagnosisName: raw.diagnosisName.trim(),
    amountKrw: rawAmt !== undefined && Number.isFinite(rawAmt) && rawAmt >= 0 ? rawAmt : undefined,
    photoIds: Array.isArray(raw.photoIds)
      ? raw.photoIds.filter((p: unknown): p is string => typeof p === 'string')
      : [],
    createdAt: normalizeIsoTimestamp(
      typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
      nowIso
    ),
    updatedAt: normalizeIsoTimestamp(
      typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
      nowIso
    ),
    signedAt: typeof raw.signedAt === 'string' ? normalizeIsoTimestamp(raw.signedAt) : undefined,
    deletedAt: typeof raw.deletedAt === 'string' ? normalizeIsoTimestamp(raw.deletedAt) : undefined,
  };
  const parsed = DiagnosticRecordSchema.safeParse(candidate);
  return parsed.success ? (parsed.data as DiagnosticRecord) : null;
}

/**
 * Validates and normalizes a decoded HealthDataPayload with record-level safeParse recovery.
 * Never locks out valid user records due to 1 malformed entry.
 */
function enrichConditionTaxonomy(c: Condition): { item: Condition; changed: boolean } {
  if (c.bodyPartIds && c.bodyPartIds.length > 0) return { item: c, changed: false };
  const inferred = resolveBodyPartIds(c.bodyPart);
  if (inferred.length === 0) return { item: c, changed: false };
  return { item: { ...c, bodyPartIds: inferred }, changed: true };
}

function enrichPainLogTaxonomy(l: PainLog): { item: PainLog; changed: boolean } {
  let changed = false;
  const next: PainLog = { ...l };
  if ((!next.bodyPartOverrideIds || next.bodyPartOverrideIds.length === 0) && next.bodyPartOverride) {
    const ids = resolveBodyPartIds(next.bodyPartOverride);
    if (ids.length > 0) {
      next.bodyPartOverrideIds = ids;
      changed = true;
    }
  }
  if ((!next.painQualityCodes || next.painQualityCodes.length === 0) && next.painQuality?.length) {
    next.painQualityCodes = resolvePqrstCodes('quality', next.painQuality);
    changed = true;
  }
  if ((!next.radiationCodes || next.radiationCodes.length === 0) && next.radiation) {
    next.radiationCodes = resolvePqrstCodes('radiation', [next.radiation]);
    changed = true;
  }
  if ((!next.triggerCodes || next.triggerCodes.length === 0) && next.triggers?.length) {
    next.triggerCodes = resolvePqrstCodes('triggers', next.triggers);
    changed = true;
  }
  if ((!next.reliefFactorCodes || next.reliefFactorCodes.length === 0) && next.reliefFactors?.length) {
    next.reliefFactorCodes = resolvePqrstCodes('reliefFactors', next.reliefFactors);
    changed = true;
  }
  if ((!next.redFlagCodes || next.redFlagCodes.length === 0) && next.redFlags?.length) {
    next.redFlagCodes = resolvePqrstCodes('redFlags', next.redFlags);
    changed = true;
  }
  return { item: changed ? next : l, changed };
}

export function recoverAndNormalizeHealthPayload(raw: unknown): PayloadRecoveryResult {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') {
    warnings.push('Empty or non-object payload recovered as empty vault.');
    return { payload: { ...EMPTY_HEALTH_DATA }, recoveredWarnings: warnings, didMigrate: true };
  }

  const obj = raw as Record<string, any>;
  const rawVersion = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1;
  let didMigrate = rawVersion < CURRENT_SCHEMA_VERSION;

  const strictCheck = HealthDataPayloadSchema.safeParse(obj);
  if (strictCheck.success) {
    // Normalize date conventions & backfill canonical taxonomy IDs while preserving signed PainLog fields
    const normalizedConditions = strictCheck.data.conditions.map((c) => {
      const ymd = normalizeLocalYmd(c.onsetDate);
      const dated = ymd === c.onsetDate ? c : { ...c, onsetDate: ymd };
      if (ymd !== c.onsetDate) didMigrate = true;
      const enriched = enrichConditionTaxonomy(dated as Condition);
      if (enriched.changed) didMigrate = true;
      return enriched.item;
    });
    const normalizedLogs = (strictCheck.data.logs as PainLog[]).map((l) => {
      const enriched = enrichPainLogTaxonomy(l);
      if (enriched.changed) didMigrate = true;
      return enriched.item;
    });
    const normalizedDiary = strictCheck.data.diaryEntries.map((d) => {
      const ymd = normalizeLocalYmd(d.date);
      if (ymd !== d.date) didMigrate = true;
      return ymd === d.date ? (d as DiaryEntry) : ({ ...d, date: ymd } as DiaryEntry);
    });
    const normalizedDiagnostics = (strictCheck.data.diagnosticRecords || []).map((d) => {
      const ymd = normalizeLocalYmd(d.diagnosisDate);
      if (ymd !== d.diagnosisDate) didMigrate = true;
      return ymd === d.diagnosisDate ? (d as DiagnosticRecord) : ({ ...d, diagnosisDate: ymd } as DiagnosticRecord);
    });

    return {
      payload: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        conditions: normalizedConditions,
        logs: normalizedLogs,
        diaryEntries: normalizedDiary,
        diagnosticRecords: normalizedDiagnostics,
        settings: strictCheck.data.settings,
        lastUpdated: strictCheck.data.lastUpdated,
      },
      recoveredWarnings: warnings,
      didMigrate,
    };
  }

  didMigrate = true;
  warnings.push('Full-payload strict validation fell back to per-record safeParse recovery.');

  const rawConditions = Array.isArray(obj.conditions) ? obj.conditions : [];
  const conditions: Condition[] = [];
  rawConditions.forEach((item, idx) => {
    const strict = ConditionSchema.safeParse(item);
    if (strict.success) {
      const ymd = normalizeLocalYmd(strict.data.onsetDate);
      const dated = (ymd === strict.data.onsetDate ? strict.data : { ...strict.data, onsetDate: ymd }) as Condition;
      conditions.push(enrichConditionTaxonomy(dated).item);
    } else {
      const salvaged = normalizeConditionCandidate(item);
      if (salvaged) {
        conditions.push(enrichConditionTaxonomy(salvaged).item);
        warnings.push(`Normalized condition[${idx}]`);
      } else {
        warnings.push(`Skipped unparseable condition[${idx}]`);
      }
    }
  });

  const rawLogs = Array.isArray(obj.logs) ? obj.logs : [];
  const logs: PainLog[] = [];
  rawLogs.forEach((item, idx) => {
    const strict = PainLogSchema.safeParse(item);
    if (strict.success) {
      logs.push(enrichPainLogTaxonomy(strict.data as PainLog).item);
    } else {
      const salvaged = normalizePainLogCandidate(item);
      if (salvaged) {
        logs.push(enrichPainLogTaxonomy(salvaged).item);
        warnings.push(`Recovered painLog[${idx}]`);
      } else {
        warnings.push(`Skipped unparseable painLog[${idx}]`);
      }
    }
  });

  const rawDiary = Array.isArray(obj.diaryEntries) ? obj.diaryEntries : [];
  const diaryEntries: DiaryEntry[] = [];
  rawDiary.forEach((item, idx) => {
    const strict = DiaryEntrySchema.safeParse(item);
    if (strict.success) {
      const ymd = normalizeLocalYmd(strict.data.date);
      diaryEntries.push((ymd === strict.data.date ? strict.data : { ...strict.data, date: ymd }) as DiaryEntry);
    } else {
      const salvaged = normalizeDiaryCandidate(item);
      if (salvaged) {
        diaryEntries.push(salvaged);
        warnings.push(`Recovered diaryEntry[${idx}]`);
      } else {
        warnings.push(`Skipped unparseable diaryEntry[${idx}]`);
      }
    }
  });

  const rawDiagnostics = Array.isArray(obj.diagnosticRecords) ? obj.diagnosticRecords : [];
  const diagnosticRecords: DiagnosticRecord[] = [];
  rawDiagnostics.forEach((item, idx) => {
    const strict = DiagnosticRecordSchema.safeParse(item);
    if (strict.success) {
      const ymd = normalizeLocalYmd(strict.data.diagnosisDate);
      diagnosticRecords.push(
        ymd === strict.data.diagnosisDate
          ? (strict.data as DiagnosticRecord)
          : ({ ...strict.data, diagnosisDate: ymd } as DiagnosticRecord)
      );
    } else {
      const salvaged = normalizeDiagnosticCandidate(item);
      if (salvaged) {
        diagnosticRecords.push(salvaged);
        warnings.push(`Recovered diagnosticRecord[${idx}]`);
      } else {
        warnings.push(`Skipped unparseable diagnosticRecord[${idx}]`);
      }
    }
  });

  let settings: UserSettings | undefined;
  if (obj.settings && typeof obj.settings === 'object') {
    const parsedSettings = UserSettingsSchema.safeParse(obj.settings);
    settings = parsedSettings.success ? parsedSettings.data : { ...DEFAULT_SETTINGS, ...obj.settings };
  }

  return {
    payload: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      conditions,
      logs,
      diaryEntries,
      diagnosticRecords,
      settings,
      lastUpdated: typeof obj.lastUpdated === 'string' ? obj.lastUpdated : new Date().toISOString(),
    },
    recoveredWarnings: warnings,
    didMigrate,
  };
}

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
          onsetDate: c.onsetDate || toLocalYmd(new Date()),
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
        diagnosticRecords: Array.isArray(data.diagnosticRecords) ? data.diagnosticRecords : [],
        settings: DEFAULT_SETTINGS,
        lastUpdated: new Date().toISOString(),
      };

      // Save migrated data to IndexedDB encrypted at rest, then purge plaintext localStorage copy
      await saveHealthData(payload);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem('bs-sync-queue-v1');
      localStorage.setItem('bs-migrated-to-idb', 'true');
      return payload;
    }
  } catch (err) {
    console.warn('Legacy data migration failed or not needed:', err);
  }
  return null;
}

let cachedDeviceMasterKey: CryptoKey | null = null;

/**
 * Retrieves the persistent device master key, or generates a new 256-bit AES-GCM key
 * and saves it into the secure local device key store.
 */
export async function getOrCreateDeviceMasterKey(): Promise<CryptoKey> {
  if (cachedDeviceMasterKey) {
    return cachedDeviceMasterKey;
  }

  const db = await getDB();
  let hexKey: string | null = null;
  if (db.objectStoreNames.contains('device_key_store')) {
    try {
      hexKey = (await db.get('device_key_store', 'master_key')) || null;
    } catch {}
  }
  if (!hexKey) {
    try {
      hexKey = (await db.get('app_state', 'device_master_key')) || null;
    } catch {}
  }
  if (!hexKey && typeof localStorage !== 'undefined') {
    hexKey = localStorage.getItem('bs-device-master-key-v1');
  }

  // Native Android: seal/retrieve device master key inside hardware-backed AndroidKeyStore
  if (isNativeAndroidSecureAuth()) {
    try {
      const res = await SecureAuth.getOrCreateDeviceMasterKeyHex({
        migrateHexKey: hexKey || undefined,
      });
      if (res?.hexKey) {
        // Purge legacy plaintext copies from WebView storage once sealed in AndroidKeyStore
        if (db.objectStoreNames.contains('device_key_store')) {
          try {
            await db.delete('device_key_store', 'master_key');
          } catch {}
        }
        try {
          await db.delete('app_state', 'device_master_key');
        } catch {}
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.removeItem('bs-device-master-key-v1');
          } catch {}
        }
        cachedDeviceMasterKey = await importKeyFromHex(res.hexKey);
        return cachedDeviceMasterKey;
      }
    } catch (err) {
      console.warn('AndroidKeyStore device key bridge fallback:', err);
    }
  }

  if (!hexKey) {
    hexKey = generateDeviceMasterKeyHex();
  }

  if (db.objectStoreNames.contains('device_key_store')) {
    try {
      await db.put('device_key_store', hexKey, 'master_key');
    } catch {}
  }
  // Remove legacy plaintext duplicates in app_state and localStorage
  try {
    await db.delete('app_state', 'device_master_key');
  } catch {}
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('bs-device-master-key-v1');
    } catch {}
  }

  cachedDeviceMasterKey = await importKeyFromHex(hexKey);
  return cachedDeviceMasterKey;
}

/**
 * Load Health Data from IndexedDB.
 * 100% on-device AES-GCM 256 encrypted at rest.
 * If user PIN is configured, decrypts with PIN key.
 * If no PIN is configured, transparently decrypts with persistent device master key.
 */
function parseAndRecoverJson(
  decryptedJson: string
): { payload: HealthDataPayload; didMigrate: boolean } {
  const parsed = extractHealthPayloadJson(decryptedJson);
  const { payload, recoveredWarnings, didMigrate } = recoverAndNormalizeHealthPayload(parsed);
  if (recoveredWarnings.length > 0) {
    console.warn('Health payload recovery warnings:', recoveredWarnings);
  }
  return { payload, didMigrate };
}

export async function loadHealthData(pin?: string): Promise<{ data: HealthDataPayload; isEncrypted: boolean }> {
  const db = await getDB();
  const record = await db.get('app_state', 'health_data');

  if (!record) {
    // Check for legacy migration
    const migrated = await migrateLegacyDataIfNeeded();
    if (migrated) {
      return { data: migrated, isEncrypted: true };
    }
    return { data: EMPTY_HEALTH_DATA, isEncrypted: false };
  }

  // Check if the record is an EncryptedPackage
  if (record && typeof record === 'object' && record.v === 1 && record.salt && record.ct) {
    const pkg = record as EncryptedPackage;
    const pinMeta = await db.get('app_state', 'pin_meta');
    const isPinActive = Boolean(pinMeta && pinMeta.hash && pinMeta.salt);

    if (isPinActive) {
      if (!pin) {
        // App is locked, PIN required to access
        return { data: EMPTY_HEALTH_DATA, isEncrypted: true };
      }
      try {
        const decryptedJson =
          pin === SESSION_KEY_TOKEN
            ? await decryptWithActiveSessionKey(pkg)
            : await decryptWithPin(pkg, pin);
        const { payload, didMigrate } = parseAndRecoverJson(decryptedJson);
        if (didMigrate) {
          await saveHealthData(payload, pin).catch(() => {});
        }
        return { data: payload, isEncrypted: true };
      } catch (err) {
        // Transition support: if saved with device key before setting PIN
        if (pkg.mode === 'device') {
          try {
            const deviceKey = await getOrCreateDeviceMasterKey();
            const decryptedJson = await decryptWithDeviceKey(pkg, deviceKey);
            const { payload } = parseAndRecoverJson(decryptedJson);
            await saveHealthData(payload, pin);
            return { data: payload, isEncrypted: true };
          } catch {}
        }
        throw err;
      }
    }

    // No PIN configured on device -> decrypt using persistent device master key
    try {
      const deviceKey = await getOrCreateDeviceMasterKey();
      const decryptedJson = await decryptWithDeviceKey(pkg, deviceKey);
      const { payload, didMigrate } = parseAndRecoverJson(decryptedJson);
      if (didMigrate) {
        await saveHealthData(payload, pin).catch(() => {});
      }
      return { data: payload, isEncrypted: true };
    } catch {
      if (pin) {
        const decryptedJson = await decryptWithPin(pkg, pin);
        const { payload, didMigrate } = parseAndRecoverJson(decryptedJson);
        if (didMigrate) {
          await saveHealthData(payload, pin).catch(() => {});
        }
        return { data: payload, isEncrypted: true };
      }
      return { data: EMPTY_HEALTH_DATA, isEncrypted: true };
    }
  }

  // Plain record migration fallback (encrypt immediately at rest)
  const { payload } = recoverAndNormalizeHealthPayload(record);
  await saveHealthData(payload, pin).catch(() => {});
  return { data: payload, isEncrypted: false };
}

/**
 * Save Health Data to IndexedDB.
 * 100% on-device AES-GCM 256 encryption at rest without cloud sync.
 * When PIN is provided, encrypts with PBKDF2 derived PIN key.
 * When no PIN is provided, encrypts with persistent device master key.
 * Never writes raw unencrypted plaintext health data into persistent storage.
 */
export async function saveHealthData(data: HealthDataPayload, pin?: string): Promise<void> {
  const db = await getDB();
  const toSave: HealthDataPayload = {
    ...data,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastUpdated: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(toSave);
  if (pin === SESSION_KEY_TOKEN) {
    const encrypted = await encryptWithActiveSessionKey(jsonStr);
    await db.put('app_state', { ...encrypted, mode: 'pin' }, 'health_data');
  } else if (pin) {
    const encrypted = await encryptWithPin(jsonStr, pin);
    await db.put('app_state', { ...encrypted, mode: 'pin' }, 'health_data');
  } else {
    const deviceKey = await getOrCreateDeviceMasterKey();
    const encrypted = await encryptWithDeviceKey(jsonStr, deviceKey);
    await db.put('app_state', { ...encrypted, mode: 'device' }, 'health_data');
  }
}

/**
 * Migrates any PIN-encrypted records (health_data, encrypted_media, totp_meta)
 * onto the PinMeta sessionSalt so the non-extractable session CryptoKey can
 * encrypt and decrypt everything without holding the raw PIN in JS state.
 */
export async function migratePinRecordsToSessionKey(rawPin: string): Promise<void> {
  if (!hasActiveSessionCryptoKey()) return;
  const db = await getDB();
  const record = await db.get('app_state', 'health_data');
  if (record && typeof record === 'object' && record.v === 1 && record.salt && record.ct) {
    const pkg = record as EncryptedPackage;
    try {
      await decryptWithActiveSessionKey(pkg);
    } catch {
      try {
        const plain =
          pkg.mode === 'device'
            ? await decryptWithDeviceKey(pkg, await getOrCreateDeviceMasterKey())
            : await decryptWithPin(pkg, rawPin);
        const reWrapped = await encryptWithActiveSessionKey(plain);
        await db.put('app_state', { ...reWrapped, mode: 'pin' }, 'health_data');
      } catch {}
    }
  }

  try {
    const { migrateMediaToSessionKey } = await import('./mediaStorage');
    await migrateMediaToSessionKey(rawPin);
  } catch {}

  try {
    const { migrateTotpToSessionKey } = await import('./totp');
    await migrateTotpToSessionKey(rawPin);
  } catch {}
}

/**
 * Re-encrypts health data when PIN is added, changed, or removed.
 */
export async function reEncryptHealthData(newPin?: string, oldPin?: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('app_state', 'health_data');
  if (record) {
    let payload: HealthDataPayload | null = null;
    if (record && typeof record === 'object' && record.v === 1 && record.salt && record.ct) {
      const pkg = record as EncryptedPackage;
      if (oldPin === SESSION_KEY_TOKEN) {
        try {
          const json = await decryptWithActiveSessionKey(pkg);
          payload = parseAndRecoverJson(json).payload;
        } catch {}
      } else if (oldPin) {
        try {
          const json = await decryptWithPin(pkg, oldPin);
          payload = parseAndRecoverJson(json).payload;
        } catch {}
      }
      if (!payload && hasActiveSessionCryptoKey()) {
        try {
          const json = await decryptWithActiveSessionKey(pkg);
          payload = parseAndRecoverJson(json).payload;
        } catch {}
      }
      if (!payload) {
        try {
          const deviceKey = await getOrCreateDeviceMasterKey();
          const json = await decryptWithDeviceKey(pkg, deviceKey);
          payload = parseAndRecoverJson(json).payload;
        } catch {}
      }
    } else {
      try {
        payload = recoverAndNormalizeHealthPayload(record).payload;
      } catch {}
    }

    if (payload) {
      await saveHealthData(payload, newPin);
    }
  }

  // Re-encrypt all stored diagnostic photos with the new active key
  try {
    const { reEncryptAllMedia } = await import('./mediaStorage');
    await reEncryptAllMedia(newPin, oldPin);
  } catch (err) {
    console.warn('Media re-encryption warning:', err);
  }

  // Re-encrypt stored TOTP 2FA secret with the new active PIN / key
  try {
    const { reEncryptTotpSecret } = await import('./totp');
    await reEncryptTotpSecret(newPin, oldPin);
  } catch (err) {
    console.warn('TOTP re-encryption warning:', err);
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
  consecutiveLockouts?: number;
  pinLength?: number;
  isOsCredentialOnly?: boolean;
  sessionSalt?: string;
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
 * Settings operations (AES-GCM 256 encrypted at rest with device master key)
 */
function normalizeSettingsMedicationPresets(settingsObj: UserSettings): UserSettings {
  if (!Array.isArray(settingsObj.medicationPresets)) return settingsObj;
  let changed = false;
  const normalized = settingsObj.medicationPresets.map((p) => {
    const split = normalizeMedicationNameDosage(p.name, p.dosage);
    if (split.name !== p.name || split.dosage !== p.dosage) {
      changed = true;
      return { ...p, name: split.name, dosage: split.dosage };
    }
    return p;
  });
  return changed ? { ...settingsObj, medicationPresets: normalized } : settingsObj;
}

export async function loadUserSettings(): Promise<UserSettings> {
  if (typeof indexedDB === 'undefined') {
    return DEFAULT_SETTINGS;
  }
  const db = await getDB();
  const stored = await db.get('app_state', 'user_settings');
  if (!stored) {
    return DEFAULT_SETTINGS;
  }

  let rawSettings: any = stored;
  if (stored && typeof stored === 'object' && stored.v === 1 && stored.salt && stored.ct) {
    try {
      const deviceKey = await getOrCreateDeviceMasterKey();
      const decryptedJson = await decryptWithDeviceKey(stored as EncryptedPackage, deviceKey);
      rawSettings = JSON.parse(decryptedJson);
    } catch {
      return DEFAULT_SETTINGS;
    }
  } else {
    // Transparently encrypt legacy plaintext user_settings (which may hold localLlm.apiKey)
    try {
      const parsed = normalizeSettingsMedicationPresets(UserSettingsSchema.parse(rawSettings));
      await saveUserSettings(parsed);
      return parsed;
    } catch {
      const merged = normalizeSettingsMedicationPresets({ ...DEFAULT_SETTINGS, ...rawSettings });
      await saveUserSettings(merged).catch(() => {});
      return merged;
    }
  }

  try {
    return normalizeSettingsMedicationPresets(UserSettingsSchema.parse(rawSettings));
  } catch {
    return normalizeSettingsMedicationPresets({ ...DEFAULT_SETTINGS, ...rawSettings });
  }
}

export interface StoragePersistenceReport {
  persisted: boolean;
  supported: boolean;
  usageBytes?: number;
  quotaBytes?: number;
  usageRatio?: number;
  isLowSpace: boolean;
}

/**
 * Requests durable IndexedDB persistence (`navigator.storage.persist`) and checks
 * remaining storage quota (`estimate()`) to defend against WebView storage eviction.
 */
export async function ensurePersistentStorage(): Promise<StoragePersistenceReport> {
  const storageApi = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storageApi) {
    return { persisted: false, supported: false, isLowSpace: false };
  }
  let persisted = false;
  try {
    if (typeof storageApi.persisted === 'function') {
      persisted = await storageApi.persisted();
    }
    if (!persisted && typeof storageApi.persist === 'function') {
      persisted = await storageApi.persist();
    }
  } catch {
    // Non-fatal in sandboxed WebViews
  }

  let usageBytes: number | undefined;
  let quotaBytes: number | undefined;
  let usageRatio: number | undefined;
  let isLowSpace = false;
  try {
    if (typeof storageApi.estimate === 'function') {
      const est = await storageApi.estimate();
      usageBytes = typeof est.usage === 'number' ? est.usage : undefined;
      quotaBytes = typeof est.quota === 'number' ? est.quota : undefined;
      if (usageBytes !== undefined && quotaBytes !== undefined && quotaBytes > 0) {
        usageRatio = Number((usageBytes / quotaBytes).toFixed(4));
        const remainingBytes = quotaBytes - usageBytes;
        isLowSpace = usageRatio >= 0.85 || remainingBytes < 50 * 1024 * 1024;
      }
    }
  } catch {
    // Non-fatal
  }

  return {
    persisted,
    supported: true,
    usageBytes,
    quotaBytes,
    usageRatio,
    isLowSpace,
  };
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const db = await getDB();
  const deviceKey = await getOrCreateDeviceMasterKey();
  const encrypted = await encryptWithDeviceKey(JSON.stringify(settings), deviceKey);
  await db.put('app_state', { ...encrypted, mode: 'device' }, 'user_settings');
}

/**
 * Clear all local data
 */
export async function resetAllData(): Promise<void> {
  if (isNativeAndroidSecureAuth()) {
    try {
      await SecureAuth.clearAllHardwareSecrets();
    } catch {}
  }
  const db = await getDB();
  await db.clear('app_state');
  if (db.objectStoreNames.contains('device_key_store')) {
    try {
      await db.clear('device_key_store');
    } catch {}
  }
  if (db.objectStoreNames.contains('encrypted_media')) {
    try {
      await db.clear('encrypted_media');
    } catch {}
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  cachedDeviceMasterKey = null;
}
