import db from '../database.js';

/**
 * Authentication middleware
 * Protects routes that require a logged-in user
 * Validates:
 * 1. User has a valid session (userId set)
 * 2. User is not in the middle of an incomplete MFA flow (defense-in-depth)
 * 3. MFA-enabled users have completed MFA verification
 * 4. Session was created after the user's last password change
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  // Defense-in-depth: Reject sessions with incomplete MFA flow
  // This prevents any code path that accidentally sets userId before MFA verification
  if (req.session.pendingMfaUserId) {
    return res.status(401).json({
      error: 'MFA verification required',
      message: 'Please complete MFA verification to continue'
    });
  }

  // H2: Check password change + MFA verification status
  const user = db.prepare('SELECT password_changed_at, mfa_enabled FROM users WHERE id = ?').get(req.session.userId);

  if (user && user.password_changed_at && req.session.loginTime) {
    const passwordChangedAt = new Date(user.password_changed_at).getTime();
    const sessionLoginTime = req.session.loginTime;

    // If password was changed after this session was created, invalidate the session
    if (passwordChangedAt > sessionLoginTime) {
      req.session.destroy((err) => {
        if (err) console.error('[Auth] Session destroy error:', err);
      });
      return res.status(401).json({
        error: 'Session expired',
        message: 'Your password was changed. Please log in again.'
      });
    }
  }

  // Defense-in-depth: Verify MFA was completed for MFA-enabled users
  // This catches any edge case where userId is set without proper MFA verification
  if (user && user.mfa_enabled === 1 && !req.session.mfaVerified) {
    return res.status(401).json({
      error: 'MFA verification required',
      message: 'Your session requires MFA verification'
    });
  }

  next();
}

/**
 * Optional authentication middleware
 * Adds user info to request if logged in, but doesn't require it
 */
export function optionalAuth(req, res, next) {
  // User info is available in req.session.userId if logged in
  next();
}
