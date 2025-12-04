import express from 'express';
import bcrypt from 'bcrypt';
import db from '../database.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, passwordLimiter, mfaLimiter } from '../middleware/rateLimit.js';
import { authValidators } from '../middleware/validation.js';
import { validatePassword } from '../utils/passwordValidation.js';
import { verifyToken, verifyBackupCode } from '../services/mfa.js';
import { decrypt } from '../utils/encryption.js';
import {
  logSecurityEvent,
  SecurityEventType,
  trackFailedLogin,
  clearFailedLoginTracking,
  getClientIp,
} from '../services/securityLogger.js';

const router = express.Router();

const BCRYPT_ROUNDS = 12; // Increased from 10 for better security

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * POST /api/auth/register
 * Create new user account with strong password validation
 */
router.post('/register', authLimiter, authValidators.register, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate password strength using zxcvbn
    const passwordCheck = validatePassword(password, [email, name].filter(Boolean));
    if (!passwordCheck.valid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordCheck.errors,
        warnings: passwordCheck.warnings,
        score: passwordCheck.score,
        crackTime: passwordCheck.crackTime
      });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password with increased rounds
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, name, password_changed_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(email, passwordHash, name || null);

    const userId = result.lastInsertRowid;

    // Create default user preferences
    db.prepare(`
      INSERT INTO user_preferences (user_id)
      VALUES (?)
    `).run(userId);

    // Create default watchlist
    db.prepare(`
      INSERT INTO watchlists (user_id, name, is_default)
      VALUES (?, ?, 1)
    `).run(userId, 'My Watchlist');

    // Create default portfolio
    db.prepare(`
      INSERT INTO portfolios (user_id, name, description, is_default, cash_balance)
      VALUES (?, ?, ?, 1, ?)
    `).run(userId, 'My Portfolio', 'Default portfolio', 10000);

    // Get created user (don't return sensitive fields)
    const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(userId);

    // Log successful registration
    logSecurityEvent(SecurityEventType.ACCOUNT_CREATED, {
      userId,
      userEmail: email,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      details: { name: name || null },
    });

    res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({
      error: 'Failed to create user account'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with session fixation protection and account lockout
 */
router.post('/login', authLimiter, authValidators.login, async (req, res) => {
  console.log('[Auth] Login attempt for:', req.body.email);
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'];

  try {
    const { email, password } = req.body;

    // Get user with lockout fields and MFA status
    const user = db.prepare(`
      SELECT id, email, name, password_hash, is_active, mfa_enabled,
             failed_login_attempts, locked_until, last_failed_login
      FROM users
      WHERE email = ?
    `).get(email);

    // Generic error message to prevent user enumeration
    const genericError = 'Invalid email or password';

    if (!user) {
      // Track failed login for suspicious activity detection
      trackFailedLogin(ipAddress, email);

      logSecurityEvent(SecurityEventType.LOGIN_FAILED, {
        userEmail: email,
        ipAddress,
        userAgent,
        details: { reason: 'User not found' },
      });

      return res.status(401).json({ error: genericError });
    }

    if (!user.is_active) {
      logSecurityEvent(SecurityEventType.LOGIN_BLOCKED, {
        userId: user.id,
        userEmail: email,
        ipAddress,
        userAgent,
        details: { reason: 'Account disabled' },
      });

      return res.status(401).json({ error: 'Account is disabled. Please contact support.' });
    }

    // Check if account is locked
    if (user.locked_until) {
      const lockExpiry = new Date(user.locked_until);
      if (lockExpiry > new Date()) {
        const remainingMs = lockExpiry - new Date();
        const remainingMins = Math.ceil(remainingMs / 60000);
        console.log(`[Auth] Account locked for ${email}, ${remainingMins} minutes remaining`);

        logSecurityEvent(SecurityEventType.LOGIN_BLOCKED, {
          userId: user.id,
          userEmail: email,
          ipAddress,
          userAgent,
          details: { reason: 'Account locked', remainingMinutes: remainingMins },
        });

        return res.status(423).json({
          error: `Account locked due to too many failed attempts. Try again in ${remainingMins} minutes.`,
          lockedUntil: user.locked_until,
          remainingMinutes: remainingMins
        });
      } else {
        // Lock expired - reset failed attempts
        db.prepare(`
          UPDATE users
          SET failed_login_attempts = 0, locked_until = NULL
          WHERE id = ?
        `).run(user.id);
        user.failed_login_attempts = 0;

        logSecurityEvent(SecurityEventType.ACCOUNT_UNLOCKED, {
          userId: user.id,
          userEmail: email,
          ipAddress,
          details: { reason: 'Lock expired' },
        });
      }
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Track failed login for suspicious activity detection
      const suspiciousCheck = trackFailedLogin(ipAddress, email);

      // Increment failed attempts
      const newAttempts = (user.failed_login_attempts || 0) + 1;

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        // Lock the account
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        db.prepare(`
          UPDATE users
          SET failed_login_attempts = ?,
              locked_until = ?,
              last_failed_login = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newAttempts, lockUntil.toISOString(), user.id);

        console.log(`[Auth] Account locked for ${email} after ${newAttempts} failed attempts`);

        logSecurityEvent(SecurityEventType.ACCOUNT_LOCKED, {
          userId: user.id,
          userEmail: email,
          ipAddress,
          userAgent,
          details: {
            failedAttempts: newAttempts,
            lockDurationMinutes: 30,
            lockedUntil: lockUntil.toISOString(),
          },
        });

        return res.status(423).json({
          error: 'Account locked due to too many failed attempts. Try again in 30 minutes.',
          lockedUntil: lockUntil.toISOString()
        });
      }

      // Update failed attempt count
      db.prepare(`
        UPDATE users
        SET failed_login_attempts = ?,
            last_failed_login = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newAttempts, user.id);

      const remainingAttempts = MAX_FAILED_ATTEMPTS - newAttempts;
      console.log(`[Auth] Failed login for ${email}, ${remainingAttempts} attempts remaining`);

      logSecurityEvent(SecurityEventType.LOGIN_FAILED, {
        userId: user.id,
        userEmail: email,
        ipAddress,
        userAgent,
        details: {
          reason: 'Invalid password',
          failedAttempts: newAttempts,
          remainingAttempts,
          suspiciousIp: suspiciousCheck.isSuspicious,
        },
      });

      return res.status(401).json({
        error: genericError,
        remainingAttempts
      });
    }

    // Check if MFA is enabled - require second factor before completing login
    if (user.mfa_enabled === 1) {
      console.log(`[Auth] MFA required for ${email}`);

      // Store pending MFA verification in session
      req.session.pendingMfaUserId = user.id;
      req.session.pendingMfaEmail = user.email;
      req.session.pendingMfaTimestamp = Date.now();

      return res.status(202).json({
        success: false,
        mfaRequired: true,
        message: 'MFA verification required'
      });
    }

    // Successful login - reset failed attempts and update last login
    db.prepare(`
      UPDATE users
      SET failed_login_attempts = 0,
          locked_until = NULL,
          last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);

    // Clear failed login tracking for this IP
    clearFailedLoginTracking(ipAddress);

    // Session fixation protection: regenerate session on successful login
    const oldSession = { ...req.session };

    req.session.regenerate((err) => {
      if (err) {
        console.error('[Auth] Session regeneration failed:', err);
        return res.status(500).json({ error: 'Authentication error' });
      }

      // Set new session data
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.loginTime = Date.now();

      // Save session before responding
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[Auth] Session save failed:', saveErr);
          return res.status(500).json({ error: 'Authentication error' });
        }

        console.log(`[Auth] Successful login for ${email}`);

        logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
          userId: user.id,
          userEmail: email,
          ipAddress,
          userAgent,
          sessionId: req.sessionID,
        });

        res.json({
          message: 'Login successful',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        });
      });
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroy session
 */
router.post('/logout', (req, res) => {
  const userId = req.session?.userId;
  const userEmail = req.session?.email;
  const ipAddress = getClientIp(req);

  req.session.destroy((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err);
      return res.status(500).json({
        error: 'Logout failed'
      });
    }
    console.log(`[Auth] User ${userId} logged out`);

    logSecurityEvent(SecurityEventType.LOGOUT, {
      userId,
      userEmail,
      ipAddress,
    });

    // Clear the session cookie
    res.clearCookie('stocktracker.sid');
    res.json({
      message: 'Logout successful'
    });
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, email, name, created_at, last_login_at
      FROM users
      WHERE id = ?
    `).get(req.session.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('[Auth] Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user info'
    });
  }
});

/**
 * PUT /api/auth/password
 * Change user password with session invalidation
 */
router.put('/password', requireAuth, passwordLimiter, authValidators.passwordChange, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.userId;

    // Get user's email for password validation context
    const user = db.prepare('SELECT email, name, password_hash FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Current password is incorrect'
      });
    }

    // Validate new password strength
    const passwordCheck = validatePassword(newPassword, [user.email, user.name].filter(Boolean));
    if (!passwordCheck.valid) {
      return res.status(400).json({
        error: 'New password does not meet requirements',
        details: passwordCheck.errors,
        warnings: passwordCheck.warnings,
        score: passwordCheck.score,
        crackTime: passwordCheck.crackTime
      });
    }

    // Ensure new password is different from current
    const samePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (samePassword) {
      return res.status(400).json({
        error: 'New password must be different from current password'
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and timestamp
    db.prepare(`
      UPDATE users
      SET password_hash = ?,
          password_changed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPasswordHash, userId);

    // Session invalidation: regenerate session after password change
    req.session.regenerate((err) => {
      if (err) {
        console.error('[Auth] Session regeneration after password change failed:', err);
        return res.status(500).json({ error: 'Password changed but session error occurred' });
      }

      // Restore user ID in new session
      req.session.userId = userId;
      req.session.email = user.email;
      req.session.passwordChangedAt = Date.now();

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[Auth] Session save after password change failed:', saveErr);
        }

        console.log(`[Auth] Password changed for user ${userId}`);

        logSecurityEvent(SecurityEventType.PASSWORD_CHANGED, {
          userId,
          userEmail: user.email,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
        });

        res.json({
          message: 'Password changed successfully. Other sessions have been invalidated.'
        });
      });
    });
  } catch (error) {
    console.error('[Auth] Password change error:', error);
    res.status(500).json({
      error: 'Failed to change password'
    });
  }
});

/**
 * POST /api/auth/check-password
 * Check password strength without creating account (for real-time feedback)
 * Note: This endpoint is exempt from CSRF protection as it's stateless and safe
 */
router.post('/check-password', (req, res) => {
  const { password, email, name } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const result = validatePassword(password, [email, name].filter(Boolean));

  res.json({
    valid: result.valid,
    score: result.score,
    crackTime: result.crackTime,
    errors: result.errors,
    warnings: result.warnings
  });
});

/**
 * POST /api/auth/verify-mfa
 * Complete login after MFA verification for users with MFA enabled
 */
const MFA_SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

router.post('/verify-mfa', mfaLimiter, async (req, res) => {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'];

  try {
    const { code, useBackup } = req.body;

    // Check for pending MFA session
    const pendingUserId = req.session.pendingMfaUserId;
    const pendingEmail = req.session.pendingMfaEmail;
    const pendingTimestamp = req.session.pendingMfaTimestamp;

    if (!pendingUserId) {
      return res.status(400).json({
        error: 'No pending MFA verification. Please login first.'
      });
    }

    // Check MFA session expiry (5 minutes)
    if (Date.now() - pendingTimestamp > MFA_SESSION_EXPIRY_MS) {
      // Clear pending MFA session
      delete req.session.pendingMfaUserId;
      delete req.session.pendingMfaEmail;
      delete req.session.pendingMfaTimestamp;

      logSecurityEvent(SecurityEventType.MFA_FAILED, {
        userId: pendingUserId,
        userEmail: pendingEmail,
        ipAddress,
        userAgent,
        details: { reason: 'MFA session expired' },
      });

      return res.status(401).json({
        error: 'MFA verification session expired. Please login again.'
      });
    }

    if (!code) {
      return res.status(400).json({ error: 'MFA code is required' });
    }

    // Get user with MFA secret
    const user = db.prepare(`
      SELECT id, email, name, mfa_secret, mfa_enabled
      FROM users WHERE id = ?
    `).get(pendingUserId);

    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      return res.status(400).json({ error: 'MFA is not enabled for this account' });
    }

    let isValid = false;

    if (useBackup) {
      // Verify backup code
      isValid = verifyBackupCode(pendingUserId, code);

      if (isValid) {
        logSecurityEvent(SecurityEventType.MFA_BACKUP_USED, {
          userId: pendingUserId,
          userEmail: pendingEmail,
          ipAddress,
          userAgent,
        });
      }
    } else {
      // Verify TOTP code (decrypt the stored secret first)
      const decryptedSecret = decrypt(user.mfa_secret);
      isValid = verifyToken(code, decryptedSecret);
    }

    if (!isValid) {
      logSecurityEvent(SecurityEventType.MFA_FAILED, {
        userId: pendingUserId,
        userEmail: pendingEmail,
        ipAddress,
        userAgent,
        details: { useBackup, reason: 'Invalid code' },
      });

      return res.status(401).json({ error: 'Invalid MFA code' });
    }

    // MFA verification successful - complete login
    // Reset failed attempts and update last login
    db.prepare(`
      UPDATE users
      SET failed_login_attempts = 0,
          locked_until = NULL,
          last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(pendingUserId);

    // Clear failed login tracking
    clearFailedLoginTracking(ipAddress);

    // Regenerate session for security
    req.session.regenerate((err) => {
      if (err) {
        console.error('[Auth] Session regeneration after MFA failed:', err);
        return res.status(500).json({ error: 'Authentication error' });
      }

      // Set new session data
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.loginTime = Date.now();
      req.session.mfaVerified = true;
      req.session.mfaVerifiedAt = Date.now();

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[Auth] Session save after MFA failed:', saveErr);
          return res.status(500).json({ error: 'Authentication error' });
        }

        console.log(`[Auth] MFA verification successful for ${user.email}`);

        logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
          userId: user.id,
          userEmail: user.email,
          ipAddress,
          userAgent,
          sessionId: req.sessionID,
          details: { mfaVerified: true },
        });

        res.json({
          success: true,
          message: 'MFA verification successful',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        });
      });
    });
  } catch (error) {
    console.error('[Auth] MFA verification error:', error);
    res.status(500).json({ error: 'MFA verification failed' });
  }
});

export default router;
