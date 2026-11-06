import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project paths
export const PROJECT_DIR = path.resolve(__dirname, '../../..');
export const REPO_ROOT = path.resolve(PROJECT_DIR, '..');
export const SRC_DIR = path.resolve(PROJECT_DIR, 'src');
export const ANDROID_DIR = path.resolve(PROJECT_DIR, 'android');
export const APK_PATH = path.resolve(REPO_ROOT, 'Bignal-v0.1.0-debug.apk');

// Colors for terminal formatting
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m',
};

// Cryptographic Constants
export const PBKDF2_ITERATIONS = 100_000;
export const KEY_LENGTH_BITS = 256;
export const IV_LENGTH_BYTES = 12;
export const SALT_LENGTH_BYTES = 16;

export function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function computeSha256Checksum(data) {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToHex(hashBuffer);
}

export async function deriveKeyFromPin(pin, salt) {
  const encoder = new TextEncoder();
  const rawKeyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    rawKeyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithPin(plaintext, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const key = await deriveKeyFromPin(pin, salt);

  const encodedData = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  return {
    v: 1,
    salt: bufferToHex(salt.buffer),
    iv: bufferToHex(iv.buffer),
    ct: bufferToBase64(ciphertextBuffer),
  };
}

export async function decryptWithPin(pkg, pin) {
  const salt = hexToBytes(pkg.salt);
  const iv = hexToBytes(pkg.iv);
  const ciphertextBuffer = base64ToBuffer(pkg.ct);
  const key = await deriveKeyFromPin(pin, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertextBuffer
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error('비밀번호/PIN이 일치하지 않거나 데이터가 손상되었습니다.');
  }
}

// Canonical Record Signature Generator (SHA-256 Audit Trail)
export async function canonicalSignPainRecord(record, prevSignature = '') {
  // Canonical string representation of vital clinical fields
  const canonicalStr = [
    record.id,
    record.conditionId,
    record.date,
    record.intensity,
    record.medication || '',
    record.postMedIntensity ?? '',
    prevSignature,
  ].join('|');
  return computeSha256Checksum(canonicalStr);
}

// Simulated In-Memory Encrypted Storage
export class InMemoryHealthStorage {
  constructor() {
    this.store = new Map();
  }

  async saveHealthData(data, pin) {
    const payload = {
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    if (pin) {
      const encrypted = await encryptWithPin(JSON.stringify(payload), pin);
      this.store.set('health_data', encrypted);
    } else {
      this.store.set('health_data', payload);
    }
  }

  async loadHealthData(pin) {
    const record = this.store.get('health_data');
    if (!record) return { data: null, isEncrypted: false };

    if (record && typeof record === 'object' && record.v === 1 && record.salt && record.ct) {
      if (!pin) {
        return { data: null, isEncrypted: true };
      }
      const decrypted = await decryptWithPin(record, pin);
      return { data: JSON.parse(decrypted), isEncrypted: true };
    }
    return { data: record, isEncrypted: false };
  }

  async clear() {
    this.store.clear();
  }
}

// Mock SSE Stream Generator
export async function* createMockSseStream(tokens) {
  for (const token of tokens) {
    const json = JSON.stringify({ choices: [{ delta: { content: token } }] });
    yield `data: ${json}\n\n`;
  }
  yield `data: [DONE]\n\n`;
}

// Parse SSE Stream into Text
export async function parseSseStream(asyncIterable, onChunk) {
  let accumulated = '';
  let buffer = '';
  for await (const chunk of asyncIterable) {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulated += delta;
            onChunk?.(delta, accumulated);
          }
        } catch {
          // ignore non-json line
        }
      }
    }
  }
  return accumulated;
}

// Read ZIP / APK central directory & local file headers
export function inspectApkEntries(apkBuffer) {
  const entries = [];
  let offset = 0;
  const len = apkBuffer.length;

  while (offset < len - 4) {
    const signature = apkBuffer.readUInt32LE(offset);
    if (signature === 0x04034b50) {
      // Local File Header
      const nameLen = apkBuffer.readUInt16LE(offset + 26);
      const extraLen = apkBuffer.readUInt16LE(offset + 28);
      const name = apkBuffer.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
      entries.push({ type: 'file', name, offset });
      offset += 30 + nameLen + extraLen;
    } else if (signature === 0x02014b50) {
      // Central Directory Header
      const nameLen = apkBuffer.readUInt16LE(offset + 28);
      const extraLen = apkBuffer.readUInt16LE(offset + 30);
      const commentLen = apkBuffer.readUInt16LE(offset + 32);
      const name = apkBuffer.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');
      entries.push({ type: 'central', name, offset });
      offset += 46 + nameLen + extraLen + commentLen;
    } else if (signature === 0x06054b50) {
      // End of Central Directory
      entries.push({ type: 'eocd', offset });
      break;
    } else {
      offset++;
    }
  }
  return entries;
}
