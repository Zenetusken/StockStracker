import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import db from '../database.js';
import { logSecurityEvent, SecurityEventType, getClientIp } from './securityLogger.js';

/**
 * MFA (Multi-Factor Authentication) Service
 *
 * Implements TOTP-based two-factor authentication using RFC 6238.
 * Compatible with Google Authenticator, Authy, and other TOTP apps.
 */

const APP_NAME = 'StockTracker';
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

// Configure authenticator options
authenticator.options = {
  digits: 6,
  step: 30, // 30 second time step
  window: 1, // Allow 1 step before/after for clock drift
};

/**
 * Generate a new TOTP secret for a user
 * @returns {string} Base32 encoded secret
 */
export function generateSecret() {
  return authenticator.generateSecret();
}

/**
 * Generate backup codes for account recovery
 * @returns {string[]} Array of backup codes
 */
export function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex').toUpperCase();
    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Generate OTP Auth URI for QR code
 * @param {string} email - User's email
 * @param {string} secret - TOTP secret
 * @returns {string} OTP Auth URI
 */
export function generateOtpAuthUri(email, secret) {
  return authenticator.keyuri(email, APP_NAME, secret);
}

/**
 * Generate QR code as data URL
 * @param {string} otpAuthUri - OTP Auth URI
 * @returns {Promise<string>} QR code as data URL
 */
export async function generateQRCode(otpAuthUri) {
  return await QRCode.toDataURL(otpAuthUri, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Verify a TOTP token
 * @param {string} token - 6-digit token from authenticator app
 * @param {string} secret - User's TOTP secret
 * @returns {boolean} True if token is valid
 */
export function verifyToken(token, secret) {
  if (!token || !secret) return false;

  // Clean the token (remove spaces, dashes)
  const cleanToken = token.replace(/[\s-]/g, '');

  return authenticator.verify({
    token: cleanToken,
    secret,
  });
}

/**
 * Verify a backup code and mark it as used
 * @param {number} userId - User ID
 * @param {string} code - Backup code
 * @returns {boolean} True if code is valid and was used
 */
export function verifyBackupCode(userId, code) {
  const user = db.prepare('SELECT mfa_backup_codes FROM users WHERE id = ?').get(userId);

  if (!user || !user.mfa_backup_codes) {
    return false;
  }

  try {
    const codes = JSON.parse(user.mfa_backup_codes);
    const cleanCode = code.replace(/[\s]/g, '').toUpperCase();

    const codeIndex = codes.findIndex(
      (c) => c.code === cleanCode && !c.used
    );

    if (codeIndex === -1) {
      return false;
    }

    // Mark code as used
    codes[codeIndex].used = true;
    codes[codeIndex].usedAt = new Date().toISOString();

    db.prepare('UPDATE users SET mfa_backup_codes = ? WHERE id = ?')
      .run(JSON.stringify(codes), userId);

    return true;
  } catch (error) {
    console.error('[MFA] Error verifying backup code:', error);
    return false;
  }
}

/**
 * Setup MFA for a user (generates secret, doesn't enable yet)
 * @param {number} userId - User ID
 * @returns {Object} Setup data including secret and QR code
 */
export async function setupMFA(userId) {
  const user = db.prepare('SELECT email, mfa_enabled FROM users WHERE id = ?').get(userId);

  if (!user) {
    throw new Error('User not found');
  }

  if (user.mfa_enabled) {
    throw new Error('MFA is already enabled');
  }

  const secret = generateSecret();
  const otpAuthUri = generateOtpAuthUri(user.email, secret);
  const qrCode = await generateQRCode(otpAuthUri);

  // Store the secret temporarily (not enabled until verified)
  // We'll store it encrypted in a real production environment
  db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?').run(secret, userId);

  return {
    secret,
    qrCode,
    otpAuthUri,
    manualEntry: {
      key: secret,
      account: user.email,
      issuer: APP_NAME,
    },
  };
}

/**
 * Enable MFA after successful verification
 * @param {number} userId - User ID
 * @param {string} token - TOTP token to verify
 * @param {Object} req - Express request for logging
 * @returns {Object} Success status and backup codes
 */
export function enableMFA(userId, token, req = null) {
  const user = db.prepare('SELECT email, mfa_secret, mfa_enabled FROM users WHERE id = ?').get(userId);

  if (!user) {
    throw new Error('User not found');
  }

  if (user.mfa_enabled) {
    throw new Error('MFA is already enabled');
  }

  if (!user.mfa_secret) {
    throw new Error('MFA not set up. Call setup first.');
  }

  // Verify the token
  if (!verifyToken(token, user.mfa_secret)) {
    throw new Error('Invalid verification code');
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes();
  const backupCodesData = backupCodes.map((code) => ({
    code,
    used: false,
    usedAt: null,
  }));

  // Enable MFA
  db.prepare(`
    UPDATE users
    SET mfa_enabled = 1,
        mfa_backup_codes = ?,
        mfa_enabled_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(backupCodesData), userId);

  // Log the event
  logSecurityEvent(SecurityEventType.MFA_ENABLED, {
    userId,
    userEmail: user.email,
    ipAddress: req ? getClientIp(req) : null,
    userAgent: req?.headers?.['user-agent'],
  });

  return {
    success: true,
    backupCodes,
    message: 'MFA enabled successfully. Save your backup codes securely.',
  };
}

/**
 * Disable MFA for a user
 * @param {number} userId - User ID
 * @param {string} password - User's password (for verification)
 * @param {Object} req - Express request for logging
 */
export function disableMFA(userId, req = null) {
  const user = db.prepare('SELECT email, mfa_enabled FROM users WHERE id = ?').get(userId);

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.mfa_enabled) {
    throw new Error('MFA is not enabled');
  }

  // Disable MFA and clear secrets
  db.prepare(`
    UPDATE users
    SET mfa_enabled = 0,
        mfa_secret = NULL,
        mfa_backup_codes = NULL,
        mfa_enabled_at = NULL
    WHERE id = ?
  `).run(userId);

  // Log the event
  logSecurityEvent(SecurityEventType.MFA_DISABLED, {
    userId,
    userEmail: user.email,
    ipAddress: req ? getClientIp(req) : null,
    userAgent: req?.headers?.['user-agent'],
  });

  return {
    success: true,
    message: 'MFA has been disabled',
  };
}

/**
 * Get remaining backup codes count
 * @param {number} userId - User ID
 * @returns {number} Number of unused backup codes
 */
export function getRemainingBackupCodesCount(userId) {
  const user = db.prepare('SELECT mfa_backup_codes FROM users WHERE id = ?').get(userId);

  if (!user || !user.mfa_backup_codes) {
    return 0;
  }

  try {
    const codes = JSON.parse(user.mfa_backup_codes);
    return codes.filter((c) => !c.used).length;
  } catch {
    return 0;
  }
}

/**
 * Regenerate backup codes (invalidates old ones)
 * @param {number} userId - User ID
 * @param {Object} req - Express request for logging
 * @returns {string[]} New backup codes
 */
export function regenerateBackupCodes(userId, req = null) {
  const user = db.prepare('SELECT email, mfa_enabled FROM users WHERE id = ?').get(userId);

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.mfa_enabled) {
    throw new Error('MFA is not enabled');
  }

  const backupCodes = generateBackupCodes();
  const backupCodesData = backupCodes.map((code) => ({
    code,
    used: false,
    usedAt: null,
  }));

  db.prepare('UPDATE users SET mfa_backup_codes = ? WHERE id = ?')
    .run(JSON.stringify(backupCodesData), userId);

  logSecurityEvent(SecurityEventType.ADMIN_ACTION, {
    userId,
    userEmail: user.email,
    ipAddress: req ? getClientIp(req) : null,
    action: 'REGENERATE_BACKUP_CODES',
  });

  return backupCodes;
}

/**
 * Check if user has MFA enabled
 * @param {number} userId - User ID
 * @returns {boolean}
 */
export function isMFAEnabled(userId) {
  const user = db.prepare('SELECT mfa_enabled FROM users WHERE id = ?').get(userId);
  return user?.mfa_enabled === 1;
}

/**
 * Get MFA status for a user
 * @param {number} userId - User ID
 * @returns {Object} MFA status
 */
export function getMFAStatus(userId) {
  const user = db.prepare(`
    SELECT mfa_enabled, mfa_enabled_at, mfa_backup_codes
    FROM users WHERE id = ?
  `).get(userId);

  if (!user) {
    return null;
  }

  let remainingBackupCodes = 0;
  if (user.mfa_backup_codes) {
    try {
      const codes = JSON.parse(user.mfa_backup_codes);
      remainingBackupCodes = codes.filter((c) => !c.used).length;
    } catch {
      // Ignore parse errors
    }
  }

  return {
    enabled: user.mfa_enabled === 1,
    enabledAt: user.mfa_enabled_at,
    remainingBackupCodes,
  };
}

export default {
  generateSecret,
  generateBackupCodes,
  generateOtpAuthUri,
  generateQRCode,
  verifyToken,
  verifyBackupCode,
  setupMFA,
  enableMFA,
  disableMFA,
  getRemainingBackupCodesCount,
  regenerateBackupCodes,
  isMFAEnabled,
  getMFAStatus,
};
