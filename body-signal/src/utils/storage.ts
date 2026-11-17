import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { HealthDataPayload, HealthDataPayloadSchema, UserSettings, UserSettingsSchema } from '../types/health';
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

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'ko',
  theme: 'system',
  logoVariant: 'cube-3d',
  hapticsEnabled: true,
  reminderEnabled: false,
  reminderTime: '21:00',
  pinEnabled: false,
  quickSosEnabled: false,
  showDiagnosticsTab: false,
  defaultQuickLoggerOpen: true,
  defaultBodyMapOpen: true,
  quickLoggerUnusedCloseCount: 0,
  bodyMapUnusedCloseCount: 0,
  emrFormat: 'standard',
  localLlm: {
    enabled: false,
    endpoint: 'http://localhost:11434/v1',
    model: 'llama3.2',
    apiKey: '',
    temperature: 0.3,
    maxTokens: 1024,
  },
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
  diagnosticRecords: [],
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
        const parsed = JSON.parse(decryptedJson);
        const validated = HealthDataPayloadSchema.parse(parsed);
        return { data: validated, isEncrypted: true };
      } catch (err) {
        // Transition support: if saved with device key before setting PIN
        if (pkg.mode === 'device') {
          try {
            const deviceKey = await getOrCreateDeviceMasterKey();
            const decryptedJson = await decryptWithDeviceKey(pkg, deviceKey);
            const parsed = JSON.parse(decryptedJson);
            const validated = HealthDataPayloadSchema.parse(parsed);
            await saveHealthData(validated, pin);
            return { data: validated, isEncrypted: true };
          } catch {}
        }
        throw err;
      }
    }

    // No PIN configured on device -> decrypt using persistent device master key
    try {
      const deviceKey = await getOrCreateDeviceMasterKey();
      const decryptedJson = await decryptWithDeviceKey(pkg, deviceKey);
      const parsed = JSON.parse(decryptedJson);
      const validated = HealthDataPayloadSchema.parse(parsed);
      return { data: validated, isEncrypted: true };
    } catch {
      if (pin) {
        const decryptedJson = await decryptWithPin(pkg, pin);
        const parsed = JSON.parse(decryptedJson);
        const validated = HealthDataPayloadSchema.parse(parsed);
        return { data: validated, isEncrypted: true };
      }
      return { data: EMPTY_HEALTH_DATA, isEncrypted: true };
    }
  }

  // Plain record migration fallback (encrypt immediately at rest)
  try {
    const validated = HealthDataPayloadSchema.parse(record);
    await saveHealthData(validated, pin);
    return { data: validated, isEncrypted: false };
  } catch {
    return { data: record as HealthDataPayload, isEncrypted: false };
  }
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
  const toSave = {
    ...data,
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
          payload = JSON.parse(json);
        } catch {}
      } else if (oldPin) {
        try {
          const json = await decryptWithPin(pkg, oldPin);
          payload = JSON.parse(json);
        } catch {}
      }
      if (!payload && hasActiveSessionCryptoKey()) {
        try {
          const json = await decryptWithActiveSessionKey(pkg);
          payload = JSON.parse(json);
        } catch {}
      }
      if (!payload) {
        try {
          const deviceKey = await getOrCreateDeviceMasterKey();
          const json = await decryptWithDeviceKey(pkg, deviceKey);
          payload = JSON.parse(json);
        } catch {}
      }
    } else {
      try {
        payload = HealthDataPayloadSchema.parse(record);
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
export async function loadUserSettings(): Promise<UserSettings> {
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
      const parsed = UserSettingsSchema.parse(rawSettings);
      await saveUserSettings(parsed);
      return parsed;
    } catch {
      const merged = { ...DEFAULT_SETTINGS, ...rawSettings };
      await saveUserSettings(merged).catch(() => {});
      return merged;
    }
  }

  try {
    return UserSettingsSchema.parse(rawSettings);
  } catch {
    return { ...DEFAULT_SETTINGS, ...rawSettings };
  }
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
