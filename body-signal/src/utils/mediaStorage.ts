/**
 * Encrypted Media Storage Engine
 * Strips EXIF metadata via canvas re-encoding and encrypts medical photos
 * individually with AES-GCM 256 (PIN key or AndroidKeyStore-sealed device key).
 */
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
} from './crypto';
import { getDB, getOrCreateDeviceMasterKey } from './storage';
import { DiagnosticRecord } from '../types/health';

export interface OrphanMediaCleanupResult {
  scannedCount: number;
  deletedIds: string[];
  retainedCount: number;
}

export function findOrphanMediaIds(
  storedKeys: string[],
  diagnosticRecords: DiagnosticRecord[]
): string[] {
  const referenced = new Set<string>();
  for (const rec of diagnosticRecords) {
    if (rec.deletedAt) continue;
    for (const pid of rec.photoIds || []) {
      referenced.add(pid);
    }
  }
  return storedKeys.filter((k) => k.startsWith('diag_photo_') && !referenced.has(k));
}

export async function garbageCollectOrphanMedia(
  diagnosticRecords: DiagnosticRecord[]
): Promise<OrphanMediaCleanupResult> {
  if (typeof indexedDB === 'undefined') {
    return { scannedCount: 0, deletedIds: [], retainedCount: 0 };
  }
  const db = await getDB();
  if (!db.objectStoreNames.contains('encrypted_media')) {
    return { scannedCount: 0, deletedIds: [], retainedCount: 0 };
  }
  const storedKeys = (await db.getAllKeys('encrypted_media')).map(String);
  const orphanIds = findOrphanMediaIds(storedKeys, diagnosticRecords);
  for (const id of orphanIds) {
    await db.delete('encrypted_media', id);
  }
  return {
    scannedCount: storedKeys.length,
    deletedIds: orphanIds,
    retainedCount: storedKeys.length - orphanIds.length,
  };
}

export async function exportDecryptedMediaMap(
  diagnosticRecords: DiagnosticRecord[],
  pin?: string,
  maxTotalBytes = 40 * 1024 * 1024
): Promise<{ media: Record<string, string>; skippedCount: number }> {
  if (typeof indexedDB === 'undefined') {
    return { media: {}, skippedCount: 0 };
  }
  const media: Record<string, string> = {};
  let skippedCount = 0;
  let runningBytes = 0;
  const activePhotoIds = Array.from(
    new Set(
      diagnosticRecords
        .filter((d) => !d.deletedAt)
        .flatMap((d) => d.photoIds || [])
    )
  );
  for (const pid of activePhotoIds) {
    try {
      const dataUrl = await loadEncryptedPhoto(pid, pin);
      if (!dataUrl) {
        skippedCount += 1;
        continue;
      }
      if (runningBytes + dataUrl.length > maxTotalBytes) {
        skippedCount += 1;
        continue;
      }
      media[pid] = dataUrl;
      runningBytes += dataUrl.length;
    } catch {
      skippedCount += 1;
    }
  }
  return { media, skippedCount };
}

export async function importDecryptedMediaMap(
  mediaMap: Record<string, string>,
  pin?: string
): Promise<string[]> {
  if (typeof indexedDB === 'undefined') return [];
  const restoredIds: string[] = [];
  for (const [pid, dataUrl] of Object.entries(mediaMap)) {
    if (typeof pid === 'string' && pid.trim() && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      await saveEncryptedPhoto(pid, dataUrl, pin);
      restoredIds.push(pid);
    }
  }
  return restoredIds;
}

/**
 * Resize/compress image and strip EXIF GPS/device metadata by drawing onto a canvas.
 */
export function compressAndStripExif(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('유효한 이미지 형식이 아닙니다.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('이미지 캔버스 컨텍스트를 생성할 수 없습니다.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function saveEncryptedPhoto(
  photoId: string,
  dataUrl: string,
  pin?: string
): Promise<void> {
  const db = await getDB();
  if (pin === SESSION_KEY_TOKEN) {
    const pkg = await encryptWithActiveSessionKey(dataUrl);
    await db.put('encrypted_media', { ...pkg, mode: 'pin' }, photoId);
  } else if (pin) {
    const pkg = await encryptWithPin(dataUrl, pin);
    await db.put('encrypted_media', { ...pkg, mode: 'pin' }, photoId);
  } else {
    const deviceKey = await getOrCreateDeviceMasterKey();
    const pkg = await encryptWithDeviceKey(dataUrl, deviceKey);
    await db.put('encrypted_media', { ...pkg, mode: 'device' }, photoId);
  }
}

export async function encryptDraftPhotos(
  photos: string[],
  pin?: string,
  encryptFn: typeof saveEncryptedPhoto = saveEncryptedPhoto
): Promise<string[]> {
  const photoIds: string[] = [];
  for (const dataUrl of photos) {
    const pid = `diag_photo_${crypto.randomUUID()}`;
    await encryptFn(pid, dataUrl, pin);
    photoIds.push(pid);
  }
  return photoIds;
}

export async function loadEncryptedPhoto(
  photoId: string,
  pin?: string
): Promise<string | null> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('encrypted_media')) return null;

  const pkg = (await db.get('encrypted_media', photoId)) as EncryptedPackage | undefined;
  if (!pkg || pkg.v !== 1 || !pkg.ct) return null;

  if (pin === SESSION_KEY_TOKEN) {
    try {
      return await decryptWithActiveSessionKey(pkg);
    } catch {
      if (pkg.mode === 'device') {
        const deviceKey = await getOrCreateDeviceMasterKey();
        return await decryptWithDeviceKey(pkg, deviceKey);
      }
      throw new Error('사진 복호화에 실패했습니다.');
    }
  }

  if (pin) {
    try {
      return await decryptWithPin(pkg, pin);
    } catch {
      if (pkg.mode === 'device') {
        const deviceKey = await getOrCreateDeviceMasterKey();
        return await decryptWithDeviceKey(pkg, deviceKey);
      }
      throw new Error('사진 복호화에 실패했습니다.');
    }
  }

  const deviceKey = await getOrCreateDeviceMasterKey();
  return await decryptWithDeviceKey(pkg, deviceKey);
}

export async function deleteEncryptedPhoto(photoId: string): Promise<void> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('encrypted_media')) return;
  await db.delete('encrypted_media', photoId);
}

export async function migrateMediaToSessionKey(rawPin: string): Promise<void> {
  if (!hasActiveSessionCryptoKey()) return;
  const db = await getDB();
  if (!db.objectStoreNames.contains('encrypted_media')) return;

  const keys = await db.getAllKeys('encrypted_media');
  for (const key of keys) {
    const photoId = String(key);
    const pkg = (await db.get('encrypted_media', photoId)) as EncryptedPackage | undefined;
    if (!pkg || pkg.v !== 1 || !pkg.ct) continue;
    try {
      await decryptWithActiveSessionKey(pkg);
    } catch {
      try {
        const plain =
          pkg.mode === 'device'
            ? await decryptWithDeviceKey(pkg, await getOrCreateDeviceMasterKey())
            : await decryptWithPin(pkg, rawPin);
        const reWrapped = await encryptWithActiveSessionKey(plain);
        await db.put('encrypted_media', { ...reWrapped, mode: 'pin' }, photoId);
      } catch {}
    }
  }
}

export async function reEncryptAllMedia(newPin?: string, oldPin?: string): Promise<void> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('encrypted_media')) return;

  const keys = await db.getAllKeys('encrypted_media');
  for (const key of keys) {
    const photoId = String(key);
    const pkg = (await db.get('encrypted_media', photoId)) as EncryptedPackage | undefined;
    if (!pkg || pkg.v !== 1 || !pkg.ct) continue;

    let plain: string | null = null;
    if (oldPin === SESSION_KEY_TOKEN) {
      try {
        plain = await decryptWithActiveSessionKey(pkg);
      } catch {}
    } else if (oldPin) {
      try {
        plain = await decryptWithPin(pkg, oldPin);
      } catch {}
    }
    if (!plain && hasActiveSessionCryptoKey()) {
      try {
        plain = await decryptWithActiveSessionKey(pkg);
      } catch {}
    }
    if (!plain) {
      try {
        const deviceKey = await getOrCreateDeviceMasterKey();
        plain = await decryptWithDeviceKey(pkg, deviceKey);
      } catch {}
    }

    if (plain) {
      await saveEncryptedPhoto(photoId, plain, newPin);
    }
  }
}
