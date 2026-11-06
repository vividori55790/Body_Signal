/**
 * Web Crypto API based End-to-End Local Encryption Engine (AES-GCM 256-bit)
 * Uses PBKDF2 (100,000 iterations) with SHA-256 for key derivation.
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12; // Standard for AES-GCM
const SALT_LENGTH_BYTES = 16;

export interface EncryptedPackage {
  v: 1;
  salt: string; // Hex
  iv: string;   // Hex
  ct: string;   // Ciphertext in Base64
}

// Convert BufferSource to Hex string
function bufferToHex(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Base64 conversion helpers for ArrayBuffer
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user PIN / password string using PBKDF2.
 */
export async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
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
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    rawKeyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using a user PIN.
 * Returns an EncryptedPackage containing the salt, IV, and ciphertext.
 */
export async function encryptWithPin(plaintext: string, pin: string): Promise<EncryptedPackage> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const key = await deriveKeyFromPin(pin, salt);

  const encodedData = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
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

/**
 * Decrypts an EncryptedPackage using a user PIN.
 * Returns the decrypted plaintext string, or throws an error if authentication/PIN fails.
 */
export async function decryptWithPin(pkg: EncryptedPackage, pin: string): Promise<string> {
  const salt = hexToBytes(pkg.salt);
  const iv = hexToBytes(pkg.iv);
  const ciphertextBuffer = base64ToBuffer(pkg.ct);

  const key = await deriveKeyFromPin(pin, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      ciphertextBuffer
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    throw new Error('비밀번호/PIN이 일치하지 않거나 데이터가 손상되었습니다.');
  }
}

/**
 * Computes a secure salted hash of the PIN for quick verification.
 */
export async function computeSaltedPinHash(pin: string, existingSaltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = existingSaltHex ? hexToBytes(existingSaltHex) : crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const encoder = new TextEncoder();
  const rawKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 50_000,
      hash: 'SHA-256',
    },
    rawKey,
    256
  );

  return {
    hash: bufferToHex(bits),
    salt: bufferToHex(salt.buffer),
  };
}
