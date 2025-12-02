import db from '../database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Security Event Logger Service
 *
 * Provides centralized logging for all security-relevant events.
 * Events are stored in database for audit trails and optionally to file.
 */

// Security event types
export const SecurityEventType = {
  // Authentication events
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_BLOCKED: 'LOGIN_BLOCKED',
  LOGOUT: 'LOGOUT',

  // Account events
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',

  // Password events
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  WEAK_PASSWORD_REJECTED: 'WEAK_PASSWORD_REJECTED',

  // Session events
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_DESTROYED: 'SESSION_DESTROYED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_REGENERATED: 'SESSION_REGENERATED',

  // MFA events
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  MFA_VERIFIED: 'MFA_VERIFIED',
  MFA_FAILED: 'MFA_FAILED',
  MFA_BACKUP_USED: 'MFA_BACKUP_USED',

  // Access events
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  FORBIDDEN_ACCESS: 'FORBIDDEN_ACCESS',
  CSRF_VIOLATION: 'CSRF_VIOLATION',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Suspicious activity
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  BRUTE_FORCE_DETECTED: 'BRUTE_FORCE_DETECTED',
  MULTIPLE_FAILED_LOGINS: 'MULTIPLE_FAILED_LOGINS',

  // Admin events
  ADMIN_ACTION: 'ADMIN_ACTION',
  API_KEY_CREATED: 'API_KEY_CREATED',
  API_KEY_DELETED: 'API_KEY_DELETED',
  CONFIG_CHANGED: 'CONFIG_CHANGED',
};

// Severity levels
export const Severity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
};

// Map event types to default severity
const eventSeverityMap = {
  [SecurityEventType.LOGIN_SUCCESS]: Severity.INFO,
  [SecurityEventType.LOGIN_FAILED]: Severity.WARNING,
  [SecurityEventType.LOGIN_BLOCKED]: Severity.WARNING,
  [SecurityEventType.LOGOUT]: Severity.INFO,
  [SecurityEventType.ACCOUNT_CREATED]: Severity.INFO,
  [SecurityEventType.ACCOUNT_LOCKED]: Severity.WARNING,
  [SecurityEventType.ACCOUNT_UNLOCKED]: Severity.INFO,
  [SecurityEventType.ACCOUNT_DISABLED]: Severity.WARNING,
  [SecurityEventType.PASSWORD_CHANGED]: Severity.INFO,
  [SecurityEventType.PASSWORD_RESET_REQUESTED]: Severity.INFO,
  [SecurityEventType.PASSWORD_RESET_COMPLETED]: Severity.INFO,
  [SecurityEventType.WEAK_PASSWORD_REJECTED]: Severity.WARNING,
  [SecurityEventType.SESSION_CREATED]: Severity.INFO,
  [SecurityEventType.SESSION_DESTROYED]: Severity.INFO,
  [SecurityEventType.SESSION_EXPIRED]: Severity.INFO,
  [SecurityEventType.SESSION_REGENERATED]: Severity.INFO,
  [SecurityEventType.MFA_ENABLED]: Severity.INFO,
  [SecurityEventType.MFA_DISABLED]: Severity.WARNING,
  [SecurityEventType.MFA_VERIFIED]: Severity.INFO,
  [SecurityEventType.MFA_FAILED]: Severity.WARNING,
  [SecurityEventType.MFA_BACKUP_USED]: Severity.WARNING,
  [SecurityEventType.UNAUTHORIZED_ACCESS]: Severity.WARNING,
  [SecurityEventType.FORBIDDEN_ACCESS]: Severity.WARNING,
  [SecurityEventType.CSRF_VIOLATION]: Severity.ERROR,
  [SecurityEventType.RATE_LIMIT_EXCEEDED]: Severity.WARNING,
  [SecurityEventType.SUSPICIOUS_ACTIVITY]: Severity.ERROR,
  [SecurityEventType.BRUTE_FORCE_DETECTED]: Severity.CRITICAL,
  [SecurityEventType.MULTIPLE_FAILED_LOGINS]: Severity.WARNING,
  [SecurityEventType.ADMIN_ACTION]: Severity.INFO,
  [SecurityEventType.API_KEY_CREATED]: Severity.INFO,
  [SecurityEventType.API_KEY_DELETED]: Severity.WARNING,
  [SecurityEventType.CONFIG_CHANGED]: Severity.INFO,
};

// In-memory tracking for suspicious activity detection
const failedLoginTracker = new Map(); // IP -> { count, firstAttempt, lastAttempt }
const FAILED_LOGIN_THRESHOLD = 10; // Max failed logins per IP in time window
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Initialize audit_logs table if it doesn't exist
 */
export function initializeAuditTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'INFO',
      user_id INTEGER,
      user_email TEXT,
      ip_address TEXT,
      user_agent TEXT,
      resource TEXT,
      action TEXT,
      details TEXT,
      session_id TEXT,
      request_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for efficient querying
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  `);

  console.log('[SecurityLogger] Audit logs table initialized');
}

/**
 * Log a security event
 * @param {string} eventType - Type of security event
 * @param {Object} options - Event details
 */
export function logSecurityEvent(eventType, options = {}) {
  const {
    userId = null,
    userEmail = null,
    ipAddress = null,
    userAgent = null,
    resource = null,
    action = null,
    details = null,
    sessionId = null,
    requestId = null,
    severity = eventSeverityMap[eventType] || Severity.INFO,
  } = options;

  const detailsJson = details ? JSON.stringify(details) : null;

  try {
    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO audit_logs (
        event_type, severity, user_id, user_email, ip_address, user_agent,
        resource, action, details, session_id, request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      eventType,
      severity,
      userId,
      userEmail,
      ipAddress,
      userAgent,
      resource,
      action,
      detailsJson,
      sessionId,
      requestId
    );

    // Console logging for real-time monitoring
    const logMessage = formatLogMessage(eventType, severity, {
      userId,
      userEmail,
      ipAddress,
      resource,
      action,
      details,
    });

    if (severity === Severity.CRITICAL) {
      console.error(`[SECURITY CRITICAL] ${logMessage}`);
    } else if (severity === Severity.ERROR) {
      console.error(`[SECURITY ERROR] ${logMessage}`);
    } else if (severity === Severity.WARNING) {
      console.warn(`[SECURITY WARNING] ${logMessage}`);
    } else {
      console.log(`[SECURITY] ${logMessage}`);
    }

    // File logging for persistent records
    logToFile(eventType, severity, options);

  } catch (error) {
    console.error('[SecurityLogger] Failed to log security event:', error);
    // Don't throw - security logging failures shouldn't break the app
  }
}

/**
 * Format log message for console output
 */
function formatLogMessage(eventType, severity, details) {
  const parts = [eventType];

  if (details.userEmail) {
    parts.push(`user=${details.userEmail}`);
  } else if (details.userId) {
    parts.push(`userId=${details.userId}`);
  }

  if (details.ipAddress) {
    parts.push(`ip=${details.ipAddress}`);
  }

  if (details.resource) {
    parts.push(`resource=${details.resource}`);
  }

  if (details.action) {
    parts.push(`action=${details.action}`);
  }

  if (details.details) {
    const detailStr = typeof details.details === 'string'
      ? details.details
      : JSON.stringify(details.details);
    if (detailStr.length < 100) {
      parts.push(`details=${detailStr}`);
    }
  }

  return parts.join(' | ');
}

/**
 * Log to file for persistent audit trail
 */
function logToFile(eventType, severity, options) {
  try {
    const logDir = path.join(__dirname, '../../logs');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `security-${today}.log`);

    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      ...options,
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    // Silent fail for file logging - don't break the app
    console.warn('[SecurityLogger] File logging failed:', error.message);
  }
}

/**
 * Track failed login attempt and detect suspicious patterns
 * @param {string} ipAddress - IP address of the requester
 * @param {string} email - Attempted email
 * @returns {Object} - { isSuspicious, failedCount }
 */
export function trackFailedLogin(ipAddress, email) {
  const now = Date.now();

  // Get or create tracker for this IP
  let tracker = failedLoginTracker.get(ipAddress);

  if (!tracker || (now - tracker.firstAttempt > FAILED_LOGIN_WINDOW_MS)) {
    // Start new tracking window
    tracker = {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
      emails: new Set([email]),
    };
    failedLoginTracker.set(ipAddress, tracker);
  } else {
    tracker.count++;
    tracker.lastAttempt = now;
    tracker.emails.add(email);
  }

  // Check if suspicious
  const isSuspicious = tracker.count >= FAILED_LOGIN_THRESHOLD;

  if (isSuspicious) {
    logSecurityEvent(SecurityEventType.BRUTE_FORCE_DETECTED, {
      ipAddress,
      severity: Severity.CRITICAL,
      details: {
        failedAttempts: tracker.count,
        timeWindowMinutes: Math.round(FAILED_LOGIN_WINDOW_MS / 60000),
        targetedEmails: Array.from(tracker.emails).slice(0, 5), // First 5 emails
        message: `${tracker.count} failed login attempts from IP ${ipAddress} in ${Math.round(FAILED_LOGIN_WINDOW_MS / 60000)} minutes`,
      },
    });
  } else if (tracker.count >= 5) {
    logSecurityEvent(SecurityEventType.MULTIPLE_FAILED_LOGINS, {
      ipAddress,
      details: {
        failedAttempts: tracker.count,
        threshold: FAILED_LOGIN_THRESHOLD,
      },
    });
  }

  return {
    isSuspicious,
    failedCount: tracker.count,
    targetedEmailCount: tracker.emails.size,
  };
}

/**
 * Clear failed login tracking for an IP (called on successful login)
 */
export function clearFailedLoginTracking(ipAddress) {
  failedLoginTracker.delete(ipAddress);
}

/**
 * Get client IP address from request
 */
export function getClientIp(req) {
  // Check various headers for proxy scenarios
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Take the first IP if there are multiple (client IP is first)
    return forwarded.split(',')[0].trim();
  }

  return req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || req.ip
    || 'unknown';
}

/**
 * Query audit logs with filtering
 */
export function queryAuditLogs(filters = {}) {
  const {
    eventType,
    userId,
    ipAddress,
    severity,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = filters;

  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (eventType) {
    query += ' AND event_type = ?';
    params.push(eventType);
  }

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  if (ipAddress) {
    query += ' AND ip_address = ?';
    params.push(ipAddress);
  }

  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }

  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

/**
 * Get security summary for dashboard/monitoring
 */
export function getSecuritySummary(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const summary = {
    totalEvents: 0,
    bySeverity: {},
    byEventType: {},
    recentCritical: [],
    topIpAddresses: [],
    failedLogins: 0,
    successfulLogins: 0,
  };

  // Total events by severity
  const severityCounts = db.prepare(`
    SELECT severity, COUNT(*) as count
    FROM audit_logs
    WHERE created_at >= ?
    GROUP BY severity
  `).all(since);

  for (const row of severityCounts) {
    summary.bySeverity[row.severity] = row.count;
    summary.totalEvents += row.count;
  }

  // Events by type
  const typeCounts = db.prepare(`
    SELECT event_type, COUNT(*) as count
    FROM audit_logs
    WHERE created_at >= ?
    GROUP BY event_type
    ORDER BY count DESC
    LIMIT 10
  `).all(since);

  for (const row of typeCounts) {
    summary.byEventType[row.event_type] = row.count;
  }

  // Recent critical events
  summary.recentCritical = db.prepare(`
    SELECT * FROM audit_logs
    WHERE severity = 'CRITICAL' AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(since);

  // Top IP addresses with failed logins
  summary.topIpAddresses = db.prepare(`
    SELECT ip_address, COUNT(*) as count
    FROM audit_logs
    WHERE event_type = 'LOGIN_FAILED' AND created_at >= ? AND ip_address IS NOT NULL
    GROUP BY ip_address
    ORDER BY count DESC
    LIMIT 10
  `).all(since);

  // Login statistics
  const loginStats = db.prepare(`
    SELECT
      SUM(CASE WHEN event_type = 'LOGIN_SUCCESS' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN event_type = 'LOGIN_FAILED' THEN 1 ELSE 0 END) as failed
    FROM audit_logs
    WHERE created_at >= ?
  `).get(since);

  summary.successfulLogins = loginStats?.successful || 0;
  summary.failedLogins = loginStats?.failed || 0;

  return summary;
}

/**
 * Clean up old audit logs (for maintenance)
 */
export function cleanupOldLogs(daysToKeep = 90) {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare(`
    DELETE FROM audit_logs WHERE created_at < ?
  `).run(cutoff);

  console.log(`[SecurityLogger] Cleaned up ${result.changes} audit log entries older than ${daysToKeep} days`);

  return result.changes;
}

// Initialize on module load
initializeAuditTable();

export default {
  SecurityEventType,
  Severity,
  logSecurityEvent,
  trackFailedLogin,
  clearFailedLoginTracking,
  getClientIp,
  queryAuditLogs,
  getSecuritySummary,
  cleanupOldLogs,
};
