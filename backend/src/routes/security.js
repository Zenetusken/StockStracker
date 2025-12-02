import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  queryAuditLogs,
  getSecuritySummary,
  cleanupOldLogs,
} from '../services/securityLogger.js';

const router = express.Router();

// All security routes require authentication
router.use(requireAuth);

/**
 * GET /api/admin/security/summary
 * Get security dashboard summary
 */
router.get('/summary', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const summary = getSecuritySummary(hours);

    res.json({
      success: true,
      timeframe: `${hours} hours`,
      summary,
    });
  } catch (error) {
    console.error('[Security] Error getting summary:', error);
    res.status(500).json({ error: 'Failed to get security summary' });
  }
});

/**
 * GET /api/admin/security/logs
 * Query audit logs with filtering
 */
router.get('/logs', (req, res) => {
  try {
    const {
      eventType,
      userId,
      ipAddress,
      severity,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query;

    const logs = queryAuditLogs({
      eventType,
      userId: userId ? parseInt(userId) : undefined,
      ipAddress,
      severity,
      startDate,
      endDate,
      limit: Math.min(parseInt(limit), 500), // Cap at 500
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('[Security] Error querying logs:', error);
    res.status(500).json({ error: 'Failed to query audit logs' });
  }
});

/**
 * GET /api/admin/security/failed-logins
 * Get recent failed login attempts grouped by IP
 */
router.get('/failed-logins', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const summary = getSecuritySummary(hours);

    res.json({
      success: true,
      timeframe: `${hours} hours`,
      totalFailed: summary.failedLogins,
      topIpAddresses: summary.topIpAddresses,
    });
  } catch (error) {
    console.error('[Security] Error getting failed logins:', error);
    res.status(500).json({ error: 'Failed to get failed login data' });
  }
});

/**
 * GET /api/admin/security/critical
 * Get recent critical security events
 */
router.get('/critical', (req, res) => {
  try {
    const logs = queryAuditLogs({
      severity: 'CRITICAL',
      limit: 50,
    });

    res.json({
      success: true,
      count: logs.length,
      events: logs,
    });
  } catch (error) {
    console.error('[Security] Error getting critical events:', error);
    res.status(500).json({ error: 'Failed to get critical events' });
  }
});

/**
 * POST /api/admin/security/cleanup
 * Clean up old audit logs (maintenance operation)
 */
router.post('/cleanup', (req, res) => {
  try {
    const daysToKeep = parseInt(req.query.days) || 90;

    if (daysToKeep < 30) {
      return res.status(400).json({
        error: 'Minimum retention period is 30 days',
      });
    }

    const deleted = cleanupOldLogs(daysToKeep);

    res.json({
      success: true,
      message: `Cleaned up ${deleted} old audit log entries`,
      daysKept: daysToKeep,
      entriesDeleted: deleted,
    });
  } catch (error) {
    console.error('[Security] Error cleaning up logs:', error);
    res.status(500).json({ error: 'Failed to cleanup logs' });
  }
});

export default router;
