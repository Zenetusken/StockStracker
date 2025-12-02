/**
 * Encryption utilities for sensitive data at rest
 * Uses AES-256-GCM for authenticated encryption
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Cache the encryption key
let encryptionKey = null;

/**
 * Get or initialize the encryption key from environment
 * @returns {Buffer|null} The encryption key buffer or null if not configured
 */
export function getEncryptionKey() {
  if (encryptionKey) {
    return encryptionKey;
  }

  const keyHex = process.env.DB_ENCRYPTION_KEY;

  if (!keyHex) {
    // In development, encryption is optional
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }
    console.warn('WARNING: DB_ENCRYPTION_KEY not set. API keys will be stored in plaintext.');
    return null;
  }

  if (keyHex.length !== 64) {
    throw new Error('DB_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }

  encryptionKey = Buffer.from(keyHex, 'hex');
  return encryptionKey;
}

/**
 * Check if encryption is enabled
 * @returns {boolean}
 */
export function isEncryptionEnabled() {
  return getEncryptionKey() !== null;
}

/**
 * Encrypt a plaintext string
 * @param {string} plaintext - The string to encrypt
 * @returns {string} Encrypted string in format: iv:authTag:ciphertext (all hex)
 */
export function encrypt(plaintext) {
  const key = getEncryptionKey();

  if (!key) {
    // Return plaintext if encryption is not configured
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} ciphertext - The encrypted string in format: iv:authTag:ciphertext
 * @returns {string} The decrypted plaintext
 */
export function decrypt(ciphertext) {
  const key = getEncryptionKey();

  if (!key) {
    // Return as-is if encryption is not configured
    return ciphertext;
  }

  // Check if this looks like an encrypted value (contains two colons)
  if (!ciphertext || !ciphertext.includes(':')) {
    // Likely a plaintext value from before encryption was enabled
    return ciphertext;
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    // Not in expected format, return as-is (might be plaintext)
    return ciphertext;
  }

  const [ivHex, authTagHex, encrypted] = parts;

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      // Invalid format, return as-is
      return ciphertext;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Decryption failed - might be plaintext or wrong key
    console.warn('Decryption failed, returning value as-is:', error.message);
    return ciphertext;
  }
}

/**
 * Check if a value appears to be encrypted
 * @param {string} value - The value to check
 * @returns {boolean}
 */
export function isEncrypted(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const parts = value.split(':');
  if (parts.length !== 3) {
    return false;
  }

  const [ivHex, authTagHex] = parts;

  // Check if parts are valid hex of expected lengths
  return (
    ivHex.length === IV_LENGTH * 2 &&
    authTagHex.length === AUTH_TAG_LENGTH * 2 &&
    /^[0-9a-fA-F]+$/.test(ivHex) &&
    /^[0-9a-fA-F]+$/.test(authTagHex)
  );
}
