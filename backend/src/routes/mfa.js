import express from 'express';
import bcrypt from 'bcrypt';
import db from '../database.js';
import { requireAuth } from '../middleware/auth.js';
import {
  setupMFA,
  enableMFA,
  disableMFA,
  verifyToken,
  verifyBackupCode,
  getMFAStatus,
  regenerateBackupCodes,
} from '../services/mfa.js';
import { decrypt } from '../utils/encryption.js';
import {
  logSecurityEvent,
  SecurityEventType,
  getClientIp,
} from '../services/securityLogger.js';

const router = express.Router();

// All MFA routes require authentication
router.use(requireAuth);

/**
 * GET /api/mfa/status
 * Get MFA status for current user
 */
router.get('/status', (req, res) => {
  try {
    const status = getMFAStatus(req.session.userId);

    if (!status) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('[MFA] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get MFA status' });
  }
});

/**
 * POST /api/mfa/setup
 * Start MFA setup - generates secret and QR code
 */
router.post('/setup', async (req, res) => {
  try {
    const setupData = await setupMFA(req.session.userId);

    res.json({
      success: true,
      qrCode: setupData.qrCode,
      manualEntry: setupData.manualEntry,
      message: 'Scan the QR code with your authenticator app, then verify with a code',
    });
  } catch (error) {
    console.error('[MFA] Setup error:', error);

    if (error.message === 'MFA is already enabled') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to set up MFA' });
  }
});

/**
 * POST /api/mfa/enable
 * Enable MFA after verifying with a code
 */
router.post('/enable', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = await enableMFA(req.session.userId, code, req);

    res.json({
      success: true,
      backupCodes: result.backupCodes,
      message: result.message,
      warning: 'Save these backup codes securely. They will only be shown once.',
    });
  } catch (error) {
    console.error('[MFA] Enable error:', error);

    if (error.message === 'Invalid verification code') {
      logSecurityEvent(SecurityEventType.MFA_FAILED, {
        userId: req.session.userId,
        userEmail: req.session.email,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        details: { reason: 'Invalid verification code during enable' },
      });

      return res.status(400).json({ error: error.message });
    }

    if (['MFA is already enabled', 'MFA not set up. Call setup first.'].includes(error.message)) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to enable MFA' });
  }
});

/**
 * POST /api/mfa/disable
 * Disable MFA (requires current password for security)
 */
router.post('/disable', async (req, res) => {
  try {
    const { password, code } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to disable MFA' });
    }

    // Verify password
    const user = db.prepare('SELECT password_hash, mfa_enabled, mfa_secret FROM users WHERE id = ?')
      .get(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Also verify MFA code if MFA is enabled
    if (user.mfa_enabled && user.mfa_secret) {
      if (!code) {
        return res.status(400).json({ error: 'MFA code is required to disable MFA' });
      }

      const decryptedSecret = decrypt(user.mfa_secret);
      if (!verifyToken(code, decryptedSecret)) {
        logSecurityEvent(SecurityEventType.MFA_FAILED, {
          userId: req.session.userId,
          userEmail: req.session.email,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          details: { reason: 'Invalid code during disable' },
        });

        return res.status(400).json({ error: 'Invalid MFA code' });
      }
    }

    const result = disableMFA(req.session.userId, req);

    res.json(result);
  } catch (error) {
    console.error('[MFA] Disable error:', error);

    if (error.message === 'MFA is not enabled') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

/**
 * POST /api/mfa/verify
 * Verify an MFA code (for login flow or other verification)
 */
router.post('/verify', (req, res) => {
  try {
    const { code, useBackup } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const user = db.prepare('SELECT mfa_enabled, mfa_secret FROM users WHERE id = ?')
      .get(req.session.userId);

    if (!user || !user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is not enabled for this account' });
    }

    let isValid = false;

    if (useBackup) {
      // Verify backup code
      isValid = verifyBackupCode(req.session.userId, code);

      if (isValid) {
        logSecurityEvent(SecurityEventType.MFA_BACKUP_USED, {
          userId: req.session.userId,
          userEmail: req.session.email,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
        });
      }
    } else {
      // Verify TOTP code (decrypt the stored secret first)
      const decryptedSecret = decrypt(user.mfa_secret);
      isValid = verifyToken(code, decryptedSecret);
    }

    if (!isValid) {
      logSecurityEvent(SecurityEventType.MFA_FAILED, {
        userId: req.session.userId,
        userEmail: req.session.email,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        details: { useBackup },
      });

      return res.status(400).json({ error: 'Invalid code' });
    }

    logSecurityEvent(SecurityEventType.MFA_VERIFIED, {
      userId: req.session.userId,
      userEmail: req.session.email,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      details: { useBackup },
    });

    // Mark session as MFA verified
    req.session.mfaVerified = true;
    req.session.mfaVerifiedAt = Date.now();

    res.json({
      success: true,
      message: 'MFA verification successful',
    });
  } catch (error) {
    console.error('[MFA] Verify error:', error);
    res.status(500).json({ error: 'Failed to verify MFA code' });
  }
});

/**
 * POST /api/mfa/backup-codes/regenerate
 * Regenerate backup codes (invalidates old ones)
 */
router.post('/backup-codes/regenerate', async (req, res) => {
  try {
    const { password, code } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Verify password
    const user = db.prepare('SELECT password_hash, mfa_enabled, mfa_secret FROM users WHERE id = ?')
      .get(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Verify MFA code
    if (!code) {
      return res.status(400).json({ error: 'MFA code is required' });
    }

    const decryptedSecret = decrypt(user.mfa_secret);
    if (!verifyToken(code, decryptedSecret)) {
      return res.status(400).json({ error: 'Invalid MFA code' });
    }

    const newCodes = regenerateBackupCodes(req.session.userId, req);

    res.json({
      success: true,
      backupCodes: newCodes,
      message: 'New backup codes generated. Old codes are no longer valid.',
      warning: 'Save these backup codes securely. They will only be shown once.',
    });
  } catch (error) {
    console.error('[MFA] Regenerate backup codes error:', error);

    if (error.message === 'MFA is not enabled') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to regenerate backup codes' });
  }
});

export default router;
